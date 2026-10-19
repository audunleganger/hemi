package com.hemi.shared.service

import com.hemi.db.App_user
import com.hemi.db.Attack
import com.hemi.db.Dose
import com.hemi.db.Episode
import com.hemi.db.HemiDatabase
import com.hemi.db.Intake_limit
import com.hemi.db.Reading
import com.hemi.db.SelectMedications
import com.hemi.shared.api.AttackDto
import com.hemi.shared.api.AttackStatus
import com.hemi.shared.api.AttackSummary
import com.hemi.shared.api.DoseDto
import com.hemi.shared.api.EpisodeDto
import com.hemi.shared.api.LimitDto
import com.hemi.shared.api.LimitStatusDto
import com.hemi.shared.api.MedicationDto
import com.hemi.shared.api.MedicationIngredientDto
import com.hemi.shared.api.MedicationKind
import com.hemi.shared.api.Nausea
import com.hemi.shared.api.PainSide
import com.hemi.shared.api.ReadingDto
import com.hemi.shared.api.enumOfCode
import com.hemi.shared.rules.AttackTimeline
import com.hemi.shared.rules.CountedDose
import com.hemi.shared.rules.DayCutoff
import com.hemi.shared.rules.EpisodeTimes
import com.hemi.shared.rules.LimitKind
import com.hemi.shared.rules.LimitRule
import com.hemi.shared.rules.Limits
import com.hemi.shared.rules.MINUTE
import com.hemi.shared.rules.Moment
import com.hemi.shared.rules.Rating
import com.hemi.shared.rules.SeverityReading
import com.hemi.shared.rules.WorkImpact
import com.hemi.shared.rules.WorkWeek
import java.time.DateTimeException
import java.time.LocalDate
import java.time.ZoneId

/** The settings the rules need, from the user row (S-1 … S-5). */
internal class UserSettings(user: App_user) {
    val cutoff = DayCutoff(user.day_cutoff.toInt())
    val zone: ZoneId = user.time_zone?.let { runCatching { ZoneId.of(it) }.getOrNull() } ?: ZoneId.systemDefault()
    val followUpMinutes = user.follow_up_minutes.toInt()
    val workWeek = WorkWeek(parseWorkdays(user.workdays), user.work_start.toInt(), user.work_end.toInt())
    val usualMedicationId = user.usual_medication_id

    companion object {
        fun parseWorkdays(value: String): Set<Int> = value.split(',').mapNotNullTo(LinkedHashSet()) { it.trim().toIntOrNull() }

        fun zoneOrNull(value: String?): ZoneId? = try {
            value?.let(ZoneId::of)
        } catch (e: DateTimeException) {
            null
        }
    }
}

internal class MedicationDef(val row: SelectMedications, val ingredients: List<MedicationIngredientDto>) {
    val id get() = row.id
    val kind: MedicationKind get() = enumOfCode(row.kind)
    val isRemedy get() = ingredients.isEmpty()

    fun unitLabel(quantity: Double): String = if (quantity == 1.0 || row.dose_unit_plural.isEmpty()) row.dose_unit else row.dose_unit_plural
}

/**
 * One user's diary, loaded once per request; every derived value (§6 "Derived") is computed from it. A
 * personal diary is small enough for this even after years (NF-1), and it keeps the rules in one place.
 */
internal class Snapshot(private val db: HemiDatabase, val userId: Long, val now: Long) {
    val user: App_user by lazy { db.appUserQueries.selectById(userId).executeAsOne() }
    val settings by lazy { UserSettings(user) }
    val nowMoment: Moment get() = Moment.of(now, settings.zone)
    val today: LocalDate get() = settings.cutoff.dayOf(nowMoment)

    val ingredients by lazy { db.medicationQueries.selectIngredients(userId).executeAsList().associateBy { it.id } }

    val medications: Map<Long, MedicationDef> by lazy {
        val links = db.medicationQueries.selectMedicationIngredients(userId).executeAsList().groupBy { it.medication_id }
        db.medicationQueries.selectMedications(userId).executeAsList().associate { row ->
            row.id to MedicationDef(
                row,
                links[row.id].orEmpty().mapNotNull { link ->
                    ingredients[link.ingredient_id]?.let { MedicationIngredientDto(it.id, it.name, it.measure_unit, link.amount_per_unit) }
                }.sortedBy { it.ingredientName.lowercase() },
            )
        }
    }

    val limits: List<Intake_limit> by lazy { db.medicationQueries.selectLimits(userId).executeAsList() }
    val triggers by lazy { db.diaryQueries.selectTriggers(userId).executeAsList() }
    val attacks: Map<Long, Attack> by lazy { db.diaryQueries.selectAttacks(userId).executeAsList().associateBy { it.id } }
    val episodes: Map<Long, List<Episode>> by lazy { db.diaryQueries.selectEpisodes(userId).executeAsList().groupBy { it.attack_id } }
    val readings: Map<Long, List<Reading>> by lazy { db.diaryQueries.selectReadings(userId).executeAsList().groupBy { it.attack_id } }
    val attackTriggers: Map<Long, List<Long>> by lazy {
        db.diaryQueries.selectAttackTriggers(userId).executeAsList().groupBy({ it.attack_id }, { it.trigger_id })
    }
    val doses: List<Dose> by lazy { db.diaryQueries.selectDoses(userId).executeAsList() }
    val dosesByAttack: Map<Long, List<Dose>> by lazy { doses.filter { it.attack_id != null }.groupBy { it.attack_id!! } }
    val overrides: Map<LocalDate, WorkImpact> by lazy {
        db.diaryQueries.selectOverrides(userId).executeAsList().associate { LocalDate.parse(it.day) to enumOfCode<WorkImpact>(it.impact) }
    }

    // Attacks

    fun status(attack: Attack): AttackStatus = enumOfCode(attack.status)

    fun timeline(attackId: Long): AttackTimeline {
        val attack = attacks.getValue(attackId)
        return AttackTimeline(
            episodes[attackId].orEmpty().map { it.times() },
            readings[attackId].orEmpty().map { SeverityReading(Moment(it.at, it.at_offset.toInt()), it.severity.toInt()) },
            attack.logged_afterwards,
        )
    }

    val timelines: Map<Long, AttackTimeline> by lazy { attacks.keys.associateWith(::timeline) }

    /** The ongoing attack (AT-6); at most one. */
    val ongoing: Attack? get() = attacks.values.filter { timelines.getValue(it.id).ongoing }.maxByOrNull { timelines.getValue(it.id).start?.at ?: 0 }

    fun summary(attack: Attack): AttackSummary {
        val timeline = timelines.getValue(attack.id)
        val start = timeline.start ?: Moment.of(attack.created_at, settings.zone)
        val end = timeline.end
        return AttackSummary(
            id = attack.id,
            status = status(attack),
            loggedAfterwards = attack.logged_afterwards,
            start = start,
            wokeUp = episodes[attack.id].orEmpty().firstOrNull()?.start_unknown == true,
            end = end,
            ongoing = timeline.ongoing,
            peak = timeline.peak,
            painSide = attack.pain_side?.let { enumOfCode<PainSide>(it) },
            nausea = attack.nausea?.let { enumOfCode<Nausea>(it) },
            triggerIds = attackTriggers[attack.id].orEmpty().sorted(),
            doseCount = dosesByAttack[attack.id].orEmpty().size,
            episodeCount = episodes[attack.id].orEmpty().size,
            durationMillis = when {
                timeline.ongoing -> now - start.at
                end != null -> end.at - start.at
                else -> null
            },
        )
    }

    fun attackDto(attack: Attack) = AttackDto(
        summary = summary(attack),
        note = attack.note,
        episodes = episodes[attack.id].orEmpty().map { EpisodeDto(it.id, Moment(it.started_at, it.started_offset.toInt()), it.endMoment(), it.start_unknown, it.is_recurrence) },
        readings = readings[attack.id].orEmpty().map { it.toDto() },
        doses = dosesByAttack[attack.id].orEmpty().map(::doseDto),
        createdAt = attack.created_at,
        updatedAt = attack.updated_at,
    )

    // Medications and doses

    fun medicationDto(medication: MedicationDef) = MedicationDto(
        id = medication.id,
        name = medication.row.name,
        kind = medication.kind,
        doseUnit = medication.row.dose_unit,
        doseUnitPlural = medication.row.dose_unit_plural,
        defaultQuantity = medication.row.default_quantity,
        followUpMinutes = medication.row.follow_up_minutes?.toInt(),
        effectiveFollowUpMinutes = followUp(medication),
        ingredients = medication.ingredients,
        isRemedy = medication.isRemedy,
        archived = medication.row.archived,
        imageVersion = medication.row.image_version,
        doseCount = doseCounts[medication.id] ?: 0,
    )

    val doseCounts: Map<Long, Int> by lazy { doses.groupingBy { it.medication_id }.eachCount() }

    fun followUp(medication: MedicationDef): Int = medication.row.follow_up_minutes?.toInt() ?: settings.followUpMinutes

    /** When a dose is due for rating (DO-5): its follow-up delay after it, if it belongs to an attack and is still unrated. */
    fun dueAt(dose: Dose): Long? {
        if (dose.attack_id == null || dose.rating != null || dose.rating_dismissed) return null
        val medication = medications[dose.medication_id] ?: return null
        return dose.taken_at + followUp(medication) * MINUTE
    }

    fun doseDto(dose: Dose): DoseDto {
        val medication = medications.getValue(dose.medication_id)
        val rating = dose.rating?.let { enumOfCode<Rating>(it) }
        return DoseDto(
            id = dose.id,
            medicationId = dose.medication_id,
            medicationName = medication.row.name,
            doseUnit = medication.unitLabel(dose.quantity),
            quantity = dose.quantity,
            at = Moment(dose.taken_at, dose.taken_offset.toInt()),
            note = dose.note,
            attackId = dose.attack_id,
            rating = rating,
            ratedAt = dose.rated_at,
            ratingDismissed = dose.rating_dismissed,
            overLimit = dose.over_limit,
            dueAt = dueAt(dose),
            sustained = if (rating == Rating.PAIN_FREE && dose.attack_id != null) timelines[dose.attack_id]?.sustained(dose.taken_at) else null,
            isRemedy = medication.isRemedy,
            imageVersion = medication.row.image_version,
        )
    }

    // Limits

    fun rule(limit: Intake_limit) = LimitRule(enumOfCode<LimitKind>(limit.kind), limit.max_value, limit.window_minutes)

    /** The doses that count toward an ingredient's limits, with their amount of it (LI-6, ME-2). */
    fun countedDoses(ingredientId: Long, excludeDoseId: Long? = null): List<CountedDose> = doses.mapNotNull { dose ->
        if (dose.id == excludeDoseId) return@mapNotNull null
        val link = medications[dose.medication_id]?.ingredients?.firstOrNull { it.ingredientId == ingredientId } ?: return@mapNotNull null
        CountedDose(dose.id, Moment(dose.taken_at, dose.taken_offset.toInt()), link.amountPerUnit?.let { it * dose.quantity })
    }

    fun limitDto(limit: Intake_limit) = LimitDto(limit.id, limit.ingredient_id!!, enumOfCode(limit.kind), limit.max_value, limit.window_minutes)

    fun limitStatus(limit: Intake_limit): LimitStatusDto {
        val ingredient = ingredients.getValue(limit.ingredient_id!!)
        val usage = Limits.usage(rule(limit), countedDoses(ingredient.id), nowMoment, settings.cutoff)
        return LimitStatusDto(
            limit = limitDto(limit),
            ingredientName = ingredient.name,
            measureUnit = ingredient.measure_unit,
            used = usage.used,
            max = usage.max,
            state = usage.state,
            freesUpAt = usage.freesUpAt,
            freesUpOn = usage.freesUpOn?.toString(),
            nextAllowedAt = usage.nextAllowedAt,
            unknownAmounts = usage.unknownAmounts,
        )
    }

    /** Limits of active ingredients only; archived ones keep counting but aren't shown on the front page. */
    val activeLimits: List<Intake_limit> get() = limits.filter { it.ingredient_id != null && ingredients[it.ingredient_id]?.archived == false }
}

internal fun Episode.times() = EpisodeTimes(id, Moment(started_at, started_offset.toInt()), endMoment(), is_recurrence)

internal fun Episode.endMoment(): Moment? = ended_at?.let { Moment(it, (ended_offset ?: 0).toInt()) }

internal fun Reading.toDto() = ReadingDto(id, Moment(at, at_offset.toInt()), severity.toInt(), estimated)
