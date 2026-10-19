package com.hemi.shared.rules

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** NF-4: step curve, days, recurrences (AT-7), sustained (DO-7), rating prefill (DO-5), missing data (AT-15). */
class AttacksTest {
    private val cutoff = DayCutoff.DEFAULT
    private val now = at("2026-10-20T12:00").at

    private fun episode(start: String, end: String?, recurrence: Boolean = false, id: Long = 1) =
        EpisodeTimes(id, at(start), end?.let(::at), recurrence)

    private fun reading(local: String, severity: Int) = SeverityReading(at(local), severity)

    @Test
    fun `severity is a step curve inside episodes`() {
        val attack = AttackTimeline(
            listOf(episode("2026-10-19T07:00", "2026-10-19T15:00")),
            listOf(reading("2026-10-19T07:00", 1), reading("2026-10-19T09:00", 3), reading("2026-10-19T15:00", 0)),
        )
        assertEquals(0, attack.severityAt(at("2026-10-19T06:00").at, now))
        assertEquals(1, attack.severityAt(at("2026-10-19T08:59").at, now))
        assertEquals(3, attack.severityAt(at("2026-10-19T09:00").at, now))
        assertEquals(3, attack.severityAt(at("2026-10-19T14:59").at, now))
        assertEquals(0, attack.severityAt(at("2026-10-19T15:00").at, now))
        assertEquals(3, attack.peak)
    }

    @Test
    fun `severity is unknown in an episode before its first reading`() {
        val attack = AttackTimeline(listOf(episode("2026-10-19T07:00", null)), listOf(reading("2026-10-19T10:00", 2)))
        assertNull(attack.severityAt(at("2026-10-19T08:00").at, now))
        assertEquals(2, attack.severityAt(at("2026-10-19T11:00").at, now))
    }

    @Test
    fun `an attack without readings has no peak (AT-15)`() {
        assertNull(AttackTimeline(listOf(episode("2026-10-19T07:00", "2026-10-19T09:00")), emptyList()).peak)
    }

    @Test
    fun `an ongoing attack lasts until now, across the cutoff`() {
        val attack = AttackTimeline(listOf(episode("2026-10-18T22:00", null)), listOf(reading("2026-10-18T22:00", 2)))
        assertTrue(attack.ongoing)
        assertEquals(setOf(day("2026-10-18"), day("2026-10-19"), day("2026-10-20")), attack.days(cutoff, now, OSLO))
        // Carried over into the next days.
        assertEquals(2, attack.daySeverity(day("2026-10-19"), cutoff, now, OSLO))
    }

    @Test
    fun `an attack past midnight but before the cutoff is one day`() {
        val attack = AttackTimeline(listOf(episode("2026-10-18T20:00", "2026-10-19T02:30")), listOf(reading("2026-10-18T20:00", 2)))
        assertEquals(setOf(day("2026-10-18")), attack.days(cutoff, now, OSLO))
    }

    @Test
    fun `logged afterwards without an end is over, and only its start day (AT-15)`() {
        val attack = AttackTimeline(
            listOf(episode("2026-10-18T14:00", null)),
            listOf(reading("2026-10-18T14:00", 3), reading("2026-10-19T09:00", 1)),
            loggedAfterwards = true,
        )
        assertFalse(attack.ongoing)
        assertNull(attack.end)
        assertEquals(setOf(day("2026-10-18")), attack.days(cutoff, now, OSLO))
    }

    @Test
    fun `day severity is the day's highest reading, or what's carried in`() {
        val attack = AttackTimeline(
            listOf(episode("2026-10-18T20:00", "2026-10-19T18:00")),
            listOf(reading("2026-10-18T20:00", 3), reading("2026-10-19T08:00", 1), reading("2026-10-19T18:00", 0)),
        )
        assertEquals(3, attack.daySeverity(day("2026-10-18"), cutoff, now, OSLO))
        // 3 is carried into the 19th from the evening before.
        assertEquals(3, attack.daySeverity(day("2026-10-19"), cutoff, now, OSLO))
        assertNull(attack.daySeverity(day("2026-10-20"), cutoff, now, OSLO))
    }

    @Test
    fun `a new attack within 48 h of the last one ending is a recurrence of it`() {
        val candidates = listOf(
            Recurrence.Candidate(1, at("2026-10-12T20:00").at),
            Recurrence.Candidate(2, at("2026-10-17T20:00").at),
        )
        assertEquals(2, Recurrence.target(candidates, at("2026-10-19T19:59").at))
        assertEquals(2, Recurrence.target(candidates, at("2026-10-19T20:00").at))
        assertNull(Recurrence.target(candidates, at("2026-10-19T20:01").at))
        // Not before it ended.
        assertNull(Recurrence.target(listOf(Recurrence.Candidate(2, at("2026-10-19T20:00").at)), at("2026-10-19T19:00").at))
    }

    @Test
    fun `attacks without an end are never joined (AT-15)`() {
        assertNull(Recurrence.target(listOf(Recurrence.Candidate(1, null)), at("2026-10-19T12:00").at))
    }

    @Test
    fun `a pain free dose is sustained unless a recurrence follows it (DO-7)`() {
        val dose = at("2026-10-19T08:00").at
        val single = AttackTimeline(listOf(episode("2026-10-19T07:00", "2026-10-19T10:00")), emptyList())
        assertTrue(single.sustained(dose))
        val recurred = AttackTimeline(
            listOf(episode("2026-10-19T07:00", "2026-10-19T10:00"), episode("2026-10-20T09:00", null, recurrence = true, id = 2)),
            emptyList(),
        )
        assertFalse(recurred.sustained(dose))
        // A dose in the recurrence itself is not affected by it.
        assertTrue(recurred.sustained(at("2026-10-20T09:30").at))
    }

    @Test
    fun `ratings are prefilled from the readings (DO-5)`() {
        assertEquals(Rating.PAIN_FREE, RatingPrefill.suggest(2, 0, otherDoseBetween = false))
        assertEquals(Rating.RELIEVED, RatingPrefill.suggest(3, 2, otherDoseBetween = false))
        assertEquals(Rating.NO_EFFECT, RatingPrefill.suggest(2, 2, otherDoseBetween = false))
        assertEquals(Rating.NO_EFFECT, RatingPrefill.suggest(1, 3, otherDoseBetween = false))
        // Another dose in between: can't be attributed.
        assertNull(RatingPrefill.suggest(3, 0, otherDoseBetween = true))
        // No reading at the dose (AT-15).
        assertNull(RatingPrefill.suggest(null, 0, otherDoseBetween = false))
    }
}
