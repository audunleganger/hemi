package com.hemi.shared.service

import com.hemi.db.Dose
import com.hemi.db.HemiDatabase
import com.hemi.shared.api.DoseDto
import com.hemi.shared.api.DoseInput
import com.hemi.shared.api.DosePreview
import com.hemi.shared.api.DosePreviewInput
import com.hemi.shared.api.LimitEffectDto
import com.hemi.shared.api.MedicationKind
import com.hemi.shared.api.PendingRating
import com.hemi.shared.api.RateInput
import com.hemi.shared.api.RatingSuggestion
import com.hemi.shared.api.code
import com.hemi.shared.domain.cleanOptionalText
import com.hemi.shared.domain.notFound
import com.hemi.shared.domain.validation
import com.hemi.shared.rules.Limits
import com.hemi.shared.rules.Moment
import com.hemi.shared.rules.Rating
import com.hemi.shared.rules.RatingPrefill
import java.time.LocalDate

/** Filters for the dose list (V-6). Null means any. */
data class DoseFilter(
    val medicationId: Long? = null,
    val ingredientId: Long? = null,
    val rated: Boolean? = null,
    val withAttack: Boolean? = null,
    val from: LocalDate? = null,
    val to: LocalDate? = null,
)

/** Doses, their effect on the limits, and their ratings (DO-1 … DO-8, LI-4). */
class DoseService(private val db: HemiDatabase, private val userId: Long, private val now: () -> Long = System::currentTimeMillis) {
    private val queries = db.diaryQueries

    private fun snapshot() = Snapshot(db, userId, now())

    fun get(id: Long): DoseDto {
        val snapshot = snapshot()
        return snapshot.doseDto(snapshot.doses.firstOrNull { it.id == id } ?: notFound("Dose"))
    }

    /** Newest first (V-6). */
    fun list(filter: DoseFilter = DoseFilter()): List<DoseDto> {
        val snapshot = snapshot()
        val cutoff = snapshot.settings.cutoff
        return snapshot.doses
            .filter { filter.medicationId == null || it.medication_id == filter.medicationId }
            .filter { d -> filter.ingredientId == null || snapshot.medications[d.medication_id]?.ingredients?.any { it.ingredientId == filter.ingredientId } == true }
            .filter { filter.rated == null || (it.rating != null) == filter.rated }
            .filter { filter.withAttack == null || (it.attack_id != null) == filter.withAttack }
            .filter { filter.from == null || cutoff.dayOf(Moment(it.taken_at, it.taken_offset.toInt())) >= filter.from }
            .filter { filter.to == null || cutoff.dayOf(Moment(it.taken_at, it.taken_offset.toInt())) <= filter.to }
            .sortedByDescending { it.taken_at }
            .map(snapshot::doseDto)
    }

    /**
     * Logs a dose (DO-1). Without an attack id it joins the ongoing attack, if any. In an attack, the current
     * [DoseInput.severity] is stored as a reading at the dose's time (DO-2). Going over a limit is allowed and
     * marked (LI-4); clients warn with [preview] first.
     */
    fun create(input: DoseInput): DoseDto = db.transactionWithResult {
        val snapshot = snapshot()
        val medication = snapshot.medications[input.medicationId] ?: notFound("Medication")
        val quantity = checkQuantity(input.quantity ?: medication.row.default_quantity)
        val at = input.at?.let { checkMoment(it, "The time", now()) } ?: snapshot.nowMoment
        val attackId = input.attackId?.also { if (it !in snapshot.attacks) notFound("Attack") }
            ?: snapshot.ongoing?.id?.takeIf { input.autoAttack }
        val over = preview(snapshot, input.medicationId, quantity, at, null).over
        val time = now()
        queries.insertDose(userId, input.medicationId, attackId, quantity, at.at, at.offset.toLong(), cleanOptionalText(input.note), null, null, false, over, time, time)
        val id = db.appUserQueries.lastInsertRowId().executeAsOne()
        if (attackId != null && input.severity != null) {
            AttackService(db, userId, now).addReadingTo(snapshot, snapshot.attacks.getValue(attackId), at, input.severity)
        }
        get(id)
    }

    /** A dose logged with an attack afterwards (AT-14): never asked to be rated, but may be rated now. */
    internal fun createPast(medicationId: Long, quantity: Double?, at: Moment, attackId: Long, rating: Rating?): DoseDto {
        val snapshot = snapshot()
        val medication = snapshot.medications[medicationId] ?: notFound("Medication")
        val amount = checkQuantity(quantity ?: medication.row.default_quantity)
        checkMoment(at, "The dose's time", now())
        val over = preview(snapshot, medicationId, amount, at, null).over
        val time = now()
        queries.insertDose(userId, medicationId, attackId, amount, at.at, at.offset.toLong(), null, rating?.code(), rating?.let { time }, true, over, time, time)
        return get(db.appUserQueries.lastInsertRowId().executeAsOne())
    }

    /** DO-8. The attack is as given: null takes the dose out of its attack (DO-1). */
    fun update(id: Long, input: DoseInput): DoseDto = db.transactionWithResult {
        val snapshot = snapshot()
        val dose = snapshot.doses.firstOrNull { it.id == id } ?: notFound("Dose")
        val medication = snapshot.medications[input.medicationId] ?: notFound("Medication")
        val quantity = checkQuantity(input.quantity ?: medication.row.default_quantity)
        val at = input.at?.let { checkMoment(it, "The time", now()) } ?: Moment(dose.taken_at, dose.taken_offset.toInt())
        input.attackId?.let { if (it !in snapshot.attacks) notFound("Attack") }
        val over = preview(snapshot, input.medicationId, quantity, at, id).over
        queries.updateDose(input.medicationId, input.attackId, quantity, at.at, at.offset.toLong(), cleanOptionalText(input.note), over, now(), id, userId)
        get(id)
    }

    fun delete(id: Long) {
        get(id)
        queries.deleteDose(id, userId)
    }

    /** What the dose would do to every affected limit (LI-4). */
    fun preview(input: DosePreviewInput): DosePreview {
        val snapshot = snapshot()
        val medication = snapshot.medications[input.medicationId] ?: notFound("Medication")
        val quantity = checkQuantity(input.quantity ?: medication.row.default_quantity)
        val at = input.at?.let { checkMoment(it, "The time", now()) } ?: snapshot.nowMoment
        return preview(snapshot, input.medicationId, quantity, at, input.doseId)
    }

    internal fun preview(snapshot: Snapshot, medicationId: Long, quantity: Double, at: Moment, excludeDoseId: Long?): DosePreview {
        val medication = snapshot.medications.getValue(medicationId)
        val effects = medication.ingredients.flatMap { link ->
            val doses = snapshot.countedDoses(link.ingredientId, excludeDoseId)
            snapshot.limits.filter { it.ingredient_id == link.ingredientId }.map { limit ->
                val rule = snapshot.rule(limit)
                val effect = Limits.effect(rule, doses, at, link.amountPerUnit?.let { it * quantity }, snapshot.settings.cutoff)
                LimitEffectDto(limit.id, link.ingredientName, link.measureUnit, rule.kind, rule.windowMinutes, effect.before, effect.after, effect.max, effect.over, effect.nextAllowedAt, effect.amountUnknown)
            }
        }
        return DosePreview(effects, effects.any { it.over })
    }

    /**
     * Rates a dose (DO-5). In an attack, the current severity is stored as a reading at the rating's time;
     * a 0 while the attack is ongoing ends the episode (AT-6).
     */
    fun rate(id: Long, input: RateInput): DoseDto = db.transactionWithResult {
        val snapshot = snapshot()
        val dose = snapshot.doses.firstOrNull { it.id == id } ?: notFound("Dose")
        val at = input.at?.let { checkMoment(it, "The time", now()) } ?: snapshot.nowMoment
        if (at.at < dose.taken_at) validation("A dose can't be rated before it was taken")
        if (dose.attack_id != null && input.severity != null) {
            AttackService(db, userId, now).addReadingTo(snapshot, snapshot.attacks.getValue(dose.attack_id), at, input.severity)
        }
        queries.rateDose(input.rating.code(), at.at, now(), id, userId)
        get(id)
    }

    /** Stops asking for a rating (DO-6); the dose can still be rated later. */
    fun dismiss(id: Long): DoseDto {
        get(id)
        queries.dismissRating(now(), id, userId)
        return get(id)
    }

    /** The rating suggested if the severity now is [severity] (DO-5). */
    fun suggestion(id: Long, severity: Int, at: Long = now()): RatingSuggestion {
        if (severity !in 0..3) validation("Severity is 0, 1, 2 or 3")
        val snapshot = snapshot()
        val dose = snapshot.doses.firstOrNull { it.id == id } ?: notFound("Dose")
        return suggestion(snapshot, dose, severity, at)
    }

    internal fun suggestion(snapshot: Snapshot, dose: Dose, severity: Int, at: Long): RatingSuggestion {
        val before = dose.attack_id?.let { snapshot.timelines[it]?.severityAt(dose.taken_at, snapshot.now) }
        val otherBetween = snapshot.doses.any { other ->
            other.id != dose.id && other.taken_at > dose.taken_at && other.taken_at <= at &&
                snapshot.medications[other.medication_id]?.kind == MedicationKind.ACUTE
        }
        return RatingSuggestion(RatingPrefill.suggest(before, severity, otherBetween), before)
    }

    /** Doses due for rating, oldest first (DO-6). */
    fun pending(): List<PendingRating> {
        val snapshot = snapshot()
        return pending(snapshot)
    }

    internal fun pending(snapshot: Snapshot): List<PendingRating> = snapshot.doses
        .mapNotNull { dose -> snapshot.dueAt(dose)?.takeIf { it <= snapshot.now }?.let { dose to it } }
        .sortedBy { it.second }
        .map { (dose, _) ->
            val last = snapshot.readings[dose.attack_id].orEmpty().lastOrNull()?.severity?.toInt()
            PendingRating(snapshot.doseDto(dose), last)
        }

    private fun checkQuantity(quantity: Double): Double {
        if (!quantity.isFinite() || quantity <= 0) validation("The quantity must be a positive number")
        return quantity
    }
}
