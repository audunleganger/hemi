package com.hemi.shared.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.LocalDate
import java.time.ZoneId

/** One continuous stretch of pain (glossary). [end] is null while it's ongoing, or when it was never recorded (AT-15). */
data class EpisodeTimes(val id: Long, val start: Moment, val end: Moment?, val isRecurrence: Boolean = false)

data class SeverityReading(val at: Moment, val severity: Int)

/**
 * An attack's times and readings, from which everything about its course is derived (§6 "Derived"). A
 * [loggedAfterwards] attack (AT-14) without an end is over, never ongoing (AT-15).
 */
data class AttackTimeline(
    val episodes: List<EpisodeTimes>,
    val readings: List<SeverityReading>,
    val loggedAfterwards: Boolean = false,
) {
    private val sortedEpisodes = episodes.sortedBy { it.start.at }
    private val sortedReadings = readings.sortedBy { it.at.at }

    val start: Moment? get() = sortedEpisodes.firstOrNull()?.start

    /** The end of the last episode; null while ongoing or when not recorded. */
    val end: Moment? get() = sortedEpisodes.lastOrNull()?.end

    /** Live attacks only: an episode without an end (AT-6). */
    val ongoing: Boolean get() = !loggedAfterwards && sortedEpisodes.any { it.end == null }

    /** The highest reading (AT-3), or null when there are none (AT-15). */
    val peak: Int? get() = readings.maxOfOrNull { it.severity }

    /**
     * Where an episode effectively ends for counting: its end; now while ongoing; and for an attack logged
     * afterwards without an end, its last reading or start, so it counts as its start day (AT-15).
     */
    private fun effectiveEnd(episode: EpisodeTimes, now: Long): Long = episode.end?.at ?: when {
        loggedAfterwards -> maxOf(episode.start.at, sortedReadings.lastOrNull { it.at.at >= episode.start.at }?.at?.at ?: episode.start.at)
        else -> maxOf(now, episode.start.at)
    }

    private fun episodeAt(t: Long, now: Long): EpisodeTimes? =
        sortedEpisodes.lastOrNull { it.start.at <= t && (t < effectiveEnd(it, now) || (t == it.start.at)) }

    /**
     * The severity at [t] as a step curve (AT-3, WI-2): the last reading in the episode at or before [t].
     * 0 outside the attack's episodes; null inside an episode before its first reading (not known).
     */
    fun severityAt(t: Long, now: Long): Int? {
        val episode = episodeAt(t, now) ?: return 0
        return sortedReadings.lastOrNull { it.at.at in episode.start.at..t }?.severity
    }

    /** The days (by cutoff) on which an episode is ongoing (glossary "Migraine day"). */
    fun days(cutoff: DayCutoff, now: Long, zone: ZoneId): Set<LocalDate> = sortedEpisodes.flatMapTo(HashSet()) { episode ->
        val first = cutoff.dayOf(episode.start)
        // Logged afterwards without an end: only its start day (AT-15).
        val last = when {
            episode.end != null -> cutoff.dayOf(episode.end)
            loggedAfterwards -> first
            else -> cutoff.dayOf(Moment.of(maxOf(now, episode.start.at), zone))
        }.let { if (it < first) first else it }
        generateSequence(first) { it.plusDays(1) }.takeWhile { it <= last }.toList()
    }

    /**
     * The day's peak severity (DS-9): the highest reading that day, or the severity carried into the day
     * from the evening before. Null when nothing is known about the day.
     */
    fun daySeverity(day: LocalDate, cutoff: DayCutoff, now: Long, zone: ZoneId): Int? {
        if (day !in days(cutoff, now, zone)) return null
        val dayStart = cutoff.startOf(day, zone)
        val carried = severityAt(dayStart, now)?.takeIf { episodeAt(dayStart, now) != null }
        val that = sortedReadings.filter { cutoff.dayOf(it.at) == day }.maxOfOrNull { it.severity }
        return listOfNotNull(carried, that).maxOrNull()
    }

    /** Whether any reading tells the severity on [day]: one that day, or one carried into it (AT-15, WI-2). */
    fun hasReadingsOn(day: LocalDate, cutoff: DayCutoff, now: Long, zone: ZoneId): Boolean {
        if (sortedReadings.any { cutoff.dayOf(it.at) == day }) return true
        val dayStart = cutoff.startOf(day, zone)
        return episodeAt(dayStart, now) != null && severityAt(dayStart, now) != null
    }

    /** DO-7: a *Pain free* dose is sustained unless the attack has a recurrence after it. */
    fun sustained(doseAt: Long): Boolean = sortedEpisodes.none { it.isRecurrence && it.start.at > doseAt }
}

/** AT-7: a new attack within this long of the previous one ending is a recurrence of it. */
const val RECURRENCE_WINDOW = 48 * HOUR

object Recurrence {
    /** An earlier attack and when its last episode ended (null: ongoing, or no end recorded, AT-15). */
    data class Candidate(val attackId: Long, val end: Long?)

    /**
     * The attack a new attack starting at [start] joins as a recurrence (AT-7): the one that ended last,
     * at or before [start] and at most 48 h before it. Attacks without an end are never joined (AT-15).
     */
    fun target(candidates: List<Candidate>, start: Long): Long? =
        candidates
            .filter { it.end != null && it.end <= start && start - it.end <= RECURRENCE_WINDOW }
            .maxByOrNull { it.end!! }
            ?.attackId
}

/** How well a dose worked (DO-5). */
@Serializable
enum class Rating {
    @SerialName("pain_free") PAIN_FREE,
    @SerialName("relieved") RELIEVED,
    @SerialName("no_effect") NO_EFFECT,
    @SerialName("unsure") UNSURE,
}

object RatingPrefill {
    /**
     * The rating suggested from the readings (DO-5): the severity at the dose [before] and now [after].
     * None without a reading at the dose (AT-15), or when another dose was taken in between, since the
     * effect can't be attributed.
     */
    fun suggest(before: Int?, after: Int, otherDoseBetween: Boolean): Rating? = when {
        before == null || otherDoseBetween -> null
        after == 0 -> Rating.PAIN_FREE
        after < before -> Rating.RELIEVED
        else -> Rating.NO_EFFECT
    }
}

/** What a migraine day did to the working day (WI-1). */
@Serializable
enum class WorkImpact {
    @SerialName("missed") MISSED,
    @SerialName("home_early") HOME_EARLY,
    @SerialName("none") NONE,
    @SerialName("not_workday") NOT_WORKDAY,
}

/** The user's working week (S-5): ISO days of week (1 = Monday) and the work window in minutes since midnight. */
data class WorkWeek(val workdays: Set<Int>, val startMinutes: Int, val endMinutes: Int) {
    companion object {
        val DEFAULT = WorkWeek(setOf(1, 2, 3, 4, 5), 8 * 60, 14 * 60)
    }
}

object WorkImpactProposal {
    /**
     * The work impact proposed for [day] from the attacks' readings (WI-2):
     * not a workday → *Not a workday*; severity ≥ 2 when work starts → *Missed work*; ≥ 2 at some point in the work
     * window → *Went home early*; otherwise *No impact*. Severity is the step curve, carried over from the day
     * before. Nothing is proposed for a workday no reading tells anything about (AT-15).
     */
    fun propose(day: LocalDate, week: WorkWeek, attacks: List<AttackTimeline>, cutoff: DayCutoff, now: Long, zone: ZoneId): WorkImpact? {
        if (day.dayOfWeek.value !in week.workdays) return WorkImpact.NOT_WORKDAY
        if (attacks.none { it.hasReadingsOn(day, cutoff, now, zone) }) return null
        val workStart = Moment.of(day, java.time.LocalTime.of(week.startMinutes / 60, week.startMinutes % 60), zone).at
        val workEnd = Moment.of(day, java.time.LocalTime.of(week.endMinutes / 60, week.endMinutes % 60), zone).at
        fun severity(t: Long): Int? = attacks.mapNotNull { it.severityAt(t, now) }.maxOrNull()
        if ((severity(workStart) ?: 0) >= 2) return WorkImpact.MISSED
        // The step curve only changes at readings, so checking them covers the whole window.
        val changes = attacks.flatMap { it.readings }.map { it.at.at }.filter { it in workStart until workEnd }
        if (changes.any { (severity(it) ?: 0) >= 2 }) return WorkImpact.HOME_EARLY
        return WorkImpact.NONE
    }
}
