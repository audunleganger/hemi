package com.hemi.shared.rules

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** NF-4: work impact proposals (WI-2). 19 October 2026 is a Monday. */
class WorkImpactTest {
    private val cutoff = DayCutoff.DEFAULT
    private val week = WorkWeek.DEFAULT
    private val now = at("2026-10-21T12:00").at

    private fun attack(start: String, end: String?, vararg readings: Pair<String, Int>) = AttackTimeline(
        listOf(EpisodeTimes(1, at(start), end?.let(::at))),
        readings.map { (time, severity) -> SeverityReading(at(time), severity) },
    )

    private fun propose(date: String, vararg attacks: AttackTimeline) =
        WorkImpactProposal.propose(day(date), week, attacks.toList(), cutoff, now, OSLO)

    @Test
    fun `weekends are not workdays`() {
        assertEquals(WorkImpact.NOT_WORKDAY, propose("2026-10-18", attack("2026-10-18T07:00", null, "2026-10-18T07:00" to 3)))
    }

    @Test
    fun `moderate or worse when work starts is missed work`() {
        assertEquals(WorkImpact.MISSED, propose("2026-10-19", attack("2026-10-19T06:00", "2026-10-19T20:00", "2026-10-19T06:00" to 2)))
    }

    @Test
    fun `moderate or worse during the work window is going home early`() {
        assertEquals(
            WorkImpact.HOME_EARLY,
            propose("2026-10-19", attack("2026-10-19T07:00", "2026-10-19T20:00", "2026-10-19T07:00" to 1, "2026-10-19T11:00" to 2)),
        )
        // An attack that starts at work.
        assertEquals(WorkImpact.HOME_EARLY, propose("2026-10-19", attack("2026-10-19T10:00", "2026-10-19T20:00", "2026-10-19T10:00" to 3)))
    }

    @Test
    fun `mild only, or moderate only after the work window, is no impact`() {
        assertEquals(WorkImpact.NONE, propose("2026-10-19", attack("2026-10-19T07:00", "2026-10-19T20:00", "2026-10-19T07:00" to 1)))
        assertEquals(
            WorkImpact.NONE,
            propose("2026-10-19", attack("2026-10-19T12:00", "2026-10-19T22:00", "2026-10-19T12:00" to 1, "2026-10-19T14:00" to 3)),
        )
    }

    @Test
    fun `severity is carried over from the evening before`() {
        assertEquals(WorkImpact.MISSED, propose("2026-10-20", attack("2026-10-19T21:00", "2026-10-20T12:00", "2026-10-19T21:00" to 2)))
    }

    @Test
    fun `without readings nothing is proposed (AT-15)`() {
        assertNull(propose("2026-10-19", attack("2026-10-19T07:00", "2026-10-19T20:00")))
    }

    @Test
    fun `the user's own workdays and window apply`() {
        val custom = WorkWeek(setOf(7), 10 * 60, 18 * 60)
        val sunday = attack("2026-10-18T09:00", "2026-10-18T22:00", "2026-10-18T09:00" to 2)
        assertEquals(WorkImpact.MISSED, WorkImpactProposal.propose(day("2026-10-18"), custom, listOf(sunday), cutoff, now, OSLO))
        assertEquals(WorkImpact.NOT_WORKDAY, WorkImpactProposal.propose(day("2026-10-19"), custom, listOf(sunday), cutoff, now, OSLO))
    }
}
