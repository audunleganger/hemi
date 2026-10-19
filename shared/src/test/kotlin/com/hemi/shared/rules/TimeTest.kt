package com.hemi.shared.rules

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class TimeTest {
    private val cutoff = DayCutoff.DEFAULT

    @Test
    fun `before the cutoff belongs to the day before`() {
        assertEquals(day("2026-10-18"), cutoff.dayOf(at("2026-10-19T00:00")))
        assertEquals(day("2026-10-18"), cutoff.dayOf(at("2026-10-19T03:59")))
        assertEquals(day("2026-10-19"), cutoff.dayOf(at("2026-10-19T04:00")))
        assertEquals(day("2026-10-19"), cutoff.dayOf(at("2026-10-19T23:59")))
    }

    @Test
    fun `a cutoff of midnight is the calendar day`() {
        assertEquals(day("2026-10-19"), DayCutoff(0).dayOf(at("2026-10-19T00:00")))
    }

    @Test
    fun `a moment keeps the local time it happened`() {
        val summer = at("2026-07-01T12:00")
        assertEquals(120, summer.offset)
        val winter = at("2026-12-01T12:00")
        assertEquals(60, winter.offset)
        assertEquals("2026-07-01T12:00", summer.local.toString())
        // The same instant seen from New York keeps its own offset.
        val ny = Moment.of(summer.at, java.time.ZoneId.of("America/New_York"))
        assertEquals("2026-07-01T06:00", ny.local.toString())
        assertEquals(day("2026-07-01"), cutoff.dayOf(ny))
    }

    @Test
    fun `days start at the cutoff in the user's zone, also across DST`() {
        // 25 October 2026: clocks go back from 03:00 to 02:00 in Oslo; the day after is 25 h from 04:00 to 04:00.
        val start = cutoff.startOf(day("2026-10-25"), OSLO)
        assertEquals(at("2026-10-25T04:00").at, start)
        assertEquals(25 * HOUR, cutoff.startOf(day("2026-10-25"), OSLO) - cutoff.startOf(day("2026-10-24"), OSLO))
    }

    @Test
    fun `clock times parse and format`() {
        assertEquals(240, parseClock("04:00"))
        assertEquals(240, parseClock("4:00"))
        assertEquals("08:05", formatClock(485))
        assertNull(parseClock("24:00"))
        assertNull(parseClock("8"))
    }
}
