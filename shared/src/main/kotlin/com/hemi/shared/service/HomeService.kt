package com.hemi.shared.service

import com.hemi.db.HemiDatabase
import com.hemi.shared.api.AcuteMedicationDays
import com.hemi.shared.api.AttackStatus
import com.hemi.shared.api.CalendarDay
import com.hemi.shared.api.CalendarView
import com.hemi.shared.api.DayReading
import com.hemi.shared.api.DayView
import com.hemi.shared.api.HomeView
import com.hemi.shared.api.MedicationKind
import com.hemi.shared.api.StaleAttack
import com.hemi.shared.api.WorkImpactDto
import com.hemi.shared.api.code
import com.hemi.shared.domain.parseDate
import com.hemi.shared.domain.validation
import com.hemi.shared.rules.CountedDose
import com.hemi.shared.rules.DAY
import com.hemi.shared.rules.LimitKind
import com.hemi.shared.rules.LimitRule
import com.hemi.shared.rules.LimitState
import com.hemi.shared.rules.Limits
import com.hemi.shared.rules.Moment
import com.hemi.shared.rules.WorkImpact
import com.hemi.shared.rules.WorkImpactProposal
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** The front page, the calendar and the selected day (V-1 … V-3, DS-2, DS-3), and work impact (WI-1 … WI-3). */
class HomeService(private val db: HemiDatabase, private val userId: Long, private val now: () -> Long = System::currentTimeMillis) {
    private fun snapshot() = Snapshot(db, userId, now())

    fun home(): HomeView {
        val snapshot = snapshot()
        val ongoing = snapshot.ongoing
        val usual = usualMedication(snapshot)
        val stateOrder = listOf(LimitState.OVER, LimitState.REACHED, LimitState.NEAR, LimitState.OK)
        return HomeView(
            today = snapshot.today.toString(),
            ongoing = ongoing?.let(snapshot::attackDto),
            pendingRatings = DoseService(db, userId, now).pending(snapshot),
            staleAttack = staleAttack(snapshot),
            limits = snapshot.activeLimits.map(snapshot::limitStatus).sortedBy { stateOrder.indexOf(it.state) },
            acuteMedicationDays = acuteMedicationDays(snapshot),
            usualMedication = usual?.let(snapshot::medicationDto),
            usualDosePreview = usual?.let { DoseService(db, userId, now).preview(snapshot, it.id, it.row.default_quantity, snapshot.nowMoment, null) },
        )
    }

    /**
     * Days from [from] to [to] (by cutoff) with an attack, a dose or a warning sign (V-2, V-3, DS-9). *Unsure* attacks only
     * when [includeUnsure]; *Not migraine* never (AT-4).
     */
    fun calendar(from: String, to: String, includeUnsure: Boolean = false): CalendarView {
        val first = parseDate(from)
        val last = parseDate(to)
        if (last < first) validation("'to' is before 'from'")
        if (ChronoUnit.DAYS.between(first, last) > 400) validation("At most 400 days at a time")
        val snapshot = snapshot()
        val cutoff = snapshot.settings.cutoff
        val zone = snapshot.settings.zone
        val statuses = if (includeUnsure) setOf(AttackStatus.MIGRAINE, AttackStatus.UNSURE) else setOf(AttackStatus.MIGRAINE)
        val attacks = snapshot.attacks.values.filter { snapshot.status(it) in statuses }
        val attackDays = attacks.associate { it.id to snapshot.timelines.getValue(it.id).days(cutoff, snapshot.now, zone) }
        val doseDays = snapshot.doses.mapTo(HashSet()) { cutoff.dayOf(Moment(it.taken_at, it.taken_offset.toInt())) }
        val signDays = snapshot.signs.mapTo(HashSet()) { cutoff.dayOf(snapshot.signMoment(it)) }
        val days = generateSequence(first) { it.plusDays(1) }.takeWhile { it <= last }.mapNotNull { day ->
            val onDay = attacks.filter { day in attackDays.getValue(it.id) }
            if (onDay.isEmpty() && day !in doseDays && day !in signDays) return@mapNotNull null
            CalendarDay(
                date = day.toString(),
                severity = onDay.mapNotNull { snapshot.timelines.getValue(it.id).daySeverity(day, cutoff, snapshot.now, zone) }.maxOrNull(),
                attack = onDay.isNotEmpty(),
                unsure = onDay.isNotEmpty() && onDay.all { snapshot.status(it) == AttackStatus.UNSURE },
                medication = day in doseDays,
                signs = day in signDays,
                ongoing = onDay.any { snapshot.timelines.getValue(it.id).ongoing } && day == snapshot.today,
                workImpact = workImpact(snapshot, day)?.effective,
            )
        }.toList()
        return CalendarView(first.toString(), last.toString(), snapshot.today.toString(), days)
    }

    /** One day (by cutoff): its attacks, readings, doses, warning signs and work impact (DS-2). */
    fun day(date: String): DayView {
        val day = parseDate(date)
        val snapshot = snapshot()
        val cutoff = snapshot.settings.cutoff
        val zone = snapshot.settings.zone
        val attacks = snapshot.attacks.values.filter { day in snapshot.timelines.getValue(it.id).days(cutoff, snapshot.now, zone) }
        return DayView(
            date = day.toString(),
            attacks = attacks.map(snapshot::summary).sortedBy { it.start.at },
            readings = attacks.flatMap { attack ->
                snapshot.readings[attack.id].orEmpty().filter { cutoff.dayOf(Moment(it.at, it.at_offset.toInt())) == day }.map { DayReading(attack.id, it.toDto()) }
            }.sortedBy { it.reading.at.at },
            doses = snapshot.doses.filter { cutoff.dayOf(Moment(it.taken_at, it.taken_offset.toInt())) == day }.map(snapshot::doseDto),
            signs = snapshot.signs.filter { cutoff.dayOf(snapshot.signMoment(it)) == day }.map(snapshot::signDto),
            workImpact = workImpact(snapshot, day),
        )
    }

    /** Overrides the proposed work impact for [date], or with null goes back to the proposal (WI-3). */
    fun setWorkImpact(date: String, impact: WorkImpact?): DayView {
        val day = parseDate(date)
        if (impact == null) db.diaryQueries.deleteOverride(userId, day.toString()) else db.diaryQueries.upsertOverride(userId, day.toString(), impact.code())
        return day(date)
    }

    /** Proposed and overridden work impact for every migraine day from [from] to [to] (WI-4). */
    internal fun workImpacts(snapshot: Snapshot, from: LocalDate, to: LocalDate): Map<LocalDate, WorkImpactDto> {
        val days = migraineDays(snapshot).filter { it in from..to }
        return days.associateWith { workImpact(snapshot, it)!! }
    }

    /** The days with an ongoing episode of a *Migraine* attack (glossary). */
    internal fun migraineDays(snapshot: Snapshot): Set<LocalDate> = snapshot.attacks.values
        .filter { snapshot.status(it) == AttackStatus.MIGRAINE }
        .flatMapTo(HashSet()) { snapshot.timelines.getValue(it.id).days(snapshot.settings.cutoff, snapshot.now, snapshot.settings.zone) }

    private fun workImpact(snapshot: Snapshot, day: LocalDate): WorkImpactDto? {
        val cutoff = snapshot.settings.cutoff
        val zone = snapshot.settings.zone
        val migraine = snapshot.attacks.values
            .filter { snapshot.status(it) == AttackStatus.MIGRAINE }
            .map { snapshot.timelines.getValue(it.id) }
            .filter { day in it.days(cutoff, snapshot.now, zone) }
        if (migraine.isEmpty()) return null
        val proposed = WorkImpactProposal.propose(day, snapshot.settings.workWeek, migraine, cutoff, snapshot.now, zone)
        val override = snapshot.overrides[day]
        return WorkImpactDto(proposed, override, override ?: proposed)
    }

    /**
     * ST-7: days (by cutoff) with a dose of an acute medication that has an active ingredient, today and the 29
     * days before; whatever attack the dose belongs to, or none. Remedies don't count.
     */
    internal fun acuteMedicationDays(snapshot: Snapshot): AcuteMedicationDays {
        val counted = snapshot.doses
            .filter { snapshot.medications[it.medication_id]?.let { m -> m.kind == MedicationKind.ACUTE && !m.isRemedy } == true }
            .map { CountedDose(it.id, Moment(it.taken_at, it.taken_offset.toInt()), null) }
        val rule = LimitRule(LimitKind.DAYS, 1.0, ACUTE_DAYS_WINDOW * DAY / 60_000)
        val usage = Limits.usage(rule, counted, snapshot.nowMoment, snapshot.settings.cutoff)
        return AcuteMedicationDays(usage.used.toInt(), ACUTE_DAYS_WINDOW, usage.freesUpOn?.toString())
    }

    /** The usual medication (S-3): the one set, else the most used, else the first acute one. */
    private fun usualMedication(snapshot: Snapshot): MedicationDef? {
        val active = snapshot.medications.values.filter { !it.row.archived && it.kind == MedicationKind.ACUTE }
        snapshot.settings.usualMedicationId?.let { id -> active.firstOrNull { it.id == id }?.let { return it } }
        return active.maxByOrNull { snapshot.doseCounts[it.id] ?: 0 }?.takeIf { (snapshot.doseCounts[it.id] ?: 0) > 0 }
            ?: active.minByOrNull { it.row.name.lowercase() }
    }

    /** AT-6: an attack started live, open for over 24 h without a new reading. */
    private fun staleAttack(snapshot: Snapshot): StaleAttack? {
        val attack = snapshot.ongoing ?: return null
        val timeline = snapshot.timelines.getValue(attack.id)
        val last = snapshot.readings[attack.id].orEmpty().lastOrNull()
        val since = maxOf(last?.at ?: 0, timeline.start?.at ?: 0)
        if (snapshot.now - since <= DAY) return null
        return StaleAttack(attack.id, timeline.start!!, last?.toDto())
    }

    companion object {
        const val ACUTE_DAYS_WINDOW = 30
    }
}
