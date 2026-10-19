package com.hemi.shared.rules

import java.time.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** NF-4: every limit kind, rolling windows (also across DST), states and previews (LI-1 … LI-5). */
class LimitsTest {
    private val cutoff = DayCutoff.DEFAULT
    private var nextId = 1L

    private fun dose(local: String, amount: Double? = null) = CountedDose(nextId++, at(local), amount)

    private val per24h = 24 * 60L
    private val month = 30 * 24 * 60L

    @Test
    fun `states are ok below 80 percent, near from 80, reached at max, over above`() {
        assertEquals(LimitState.OK, Limits.state(3.0, 6.0))
        assertEquals(LimitState.NEAR, Limits.state(4.8, 6.0))
        assertEquals(LimitState.NEAR, Limits.state(5.0, 6.0))
        assertEquals(LimitState.REACHED, Limits.state(6.0, 6.0))
        assertEquals(LimitState.OVER, Limits.state(7.0, 6.0))
        assertEquals(LimitState.NEAR, Limits.state(3200.0, 4000.0))
    }

    @Test
    fun `amount limits sum the ingredient over a rolling window`() {
        val rule = LimitRule(LimitKind.AMOUNT, 4000.0, per24h)
        val doses = listOf(
            dose("2026-10-18T09:00", 1000.0), // more than 24 h ago
            dose("2026-10-18T13:00", 1000.0),
            dose("2026-10-19T08:00", 1000.0),
            dose("2026-10-19T11:00", 500.0),
        )
        val usage = Limits.usage(rule, doses, at("2026-10-19T12:00"), cutoff)
        assertEquals(2500.0, usage.used)
        assertEquals(LimitState.OK, usage.state)
        // The 13:00 dose leaves the window 24 h later.
        assertEquals(at("2026-10-19T13:00").at, usage.freesUpAt)
    }

    @Test
    fun `amount limits leave out doses with an unknown amount, and count them`() {
        val rule = LimitRule(LimitKind.AMOUNT, 4000.0, per24h)
        val usage = Limits.usage(rule, listOf(dose("2026-10-19T08:00", 1000.0), dose("2026-10-19T09:00", null)), at("2026-10-19T12:00"), cutoff)
        assertEquals(1000.0, usage.used)
        assertEquals(1, usage.unknownAmounts)
    }

    @Test
    fun `dose limits count doses, whatever the amount`() {
        val rule = LimitRule(LimitKind.DOSES, 2.0, per24h)
        val doses = listOf(dose("2026-10-19T08:00", 20.0), dose("2026-10-19T10:00", 50.0))
        val usage = Limits.usage(rule, doses, at("2026-10-19T12:00"), cutoff)
        assertEquals(2.0, usage.used)
        assertEquals(LimitState.REACHED, usage.state)
    }

    @Test
    fun `doses in the future aren't counted yet`() {
        val rule = LimitRule(LimitKind.DOSES, 2.0, per24h)
        assertEquals(1.0, Limits.usage(rule, listOf(dose("2026-10-19T08:00"), dose("2026-10-19T18:00")), at("2026-10-19T12:00"), cutoff).used)
    }

    @Test
    fun `days limits count days by cutoff in a window of whole days`() {
        val rule = LimitRule(LimitKind.DAYS, 6.0, month)
        val doses = listOf(
            dose("2026-09-19T12:00"), // 30 days before today: outside
            dose("2026-09-20T12:00"), // the first day of the window
            dose("2026-09-20T18:00"), // same day, counted once
            dose("2026-10-01T02:00"), // before the cutoff: 30 September
            dose("2026-10-10T12:00"),
            dose("2026-10-19T09:00"),
        )
        val usage = Limits.usage(rule, doses, at("2026-10-19T12:00"), cutoff)
        assertEquals(4.0, usage.used)
        assertEquals(LimitState.OK, usage.state)
        // 20 September leaves the window on 20 October.
        assertEquals(LocalDate.parse("2026-10-20"), usage.freesUpOn)
    }

    @Test
    fun `days limits use the cutoff for today too`() {
        val rule = LimitRule(LimitKind.DAYS, 1.0, per24h)
        // At 02:00 it's still the 18th, the day of the dose at 20:00.
        assertEquals(1.0, Limits.usage(rule, listOf(dose("2026-10-18T20:00")), at("2026-10-19T02:00"), cutoff).used)
        assertEquals(0.0, Limits.usage(rule, listOf(dose("2026-10-18T20:00")), at("2026-10-19T05:00"), cutoff).used)
    }

    @Test
    fun `minimum interval tells when the next dose is allowed`() {
        val rule = LimitRule(LimitKind.MIN_INTERVAL, 0.0, 2 * 60L)
        val waiting = Limits.usage(rule, listOf(dose("2026-10-19T14:40")), at("2026-10-19T15:00"), cutoff)
        assertEquals(LimitState.REACHED, waiting.state)
        assertEquals(at("2026-10-19T16:40").at, waiting.nextAllowedAt)
        val free = Limits.usage(rule, listOf(dose("2026-10-19T12:00")), at("2026-10-19T15:00"), cutoff)
        assertEquals(LimitState.OK, free.state)
        assertNull(free.nextAllowedAt)
    }

    @Test
    fun `rolling windows are exact across a DST change`() {
        // Clocks go back at 03:00 on 25 October 2026, so 24 h before 12:00 on the 25th is 13:00 on the 24th.
        val rule = LimitRule(LimitKind.DOSES, 3.0, per24h)
        val doses = listOf(dose("2026-10-24T12:30"), dose("2026-10-24T13:30"))
        assertEquals(1.0, Limits.usage(rule, doses, at("2026-10-25T12:00"), cutoff).used)
        // And in spring, 24 h before 12:00 on 29 March is 11:00 on the 28th.
        val spring = listOf(dose("2026-03-28T10:30"), dose("2026-03-28T11:30"))
        assertEquals(1.0, Limits.usage(rule, spring, at("2026-03-29T12:00"), cutoff).used)
    }

    @Test
    fun `previews show the effect of one more dose`() {
        val days = LimitRule(LimitKind.DAYS, 6.0, month)
        val history = (1..5).map { dose("2026-10-${10 + it}T12:00") }
        val effect = Limits.effect(days, history, at("2026-10-19T12:00"), null, cutoff)
        assertEquals(5.0, effect.before)
        assertEquals(6.0, effect.after)
        assertFalse(effect.over)
        // A second dose the same day doesn't add a day.
        val sameDay = Limits.effect(days, history + dose("2026-10-19T08:00"), at("2026-10-19T12:00"), null, cutoff)
        assertEquals(6.0, sameDay.after)
        assertFalse(sameDay.over)
        // A dose on a seventh day goes over.
        assertTrue(Limits.effect(days, history + dose("2026-10-18T08:00"), at("2026-10-19T12:00"), null, cutoff).over)
    }

    @Test
    fun `amount previews add the dose's amount, and flag an unknown one`() {
        val rule = LimitRule(LimitKind.AMOUNT, 4000.0, per24h)
        val history = listOf(dose("2026-10-19T08:00", 3000.0))
        val effect = Limits.effect(rule, history, at("2026-10-19T12:00"), 1500.0, cutoff)
        assertEquals(4500.0, effect.after)
        assertTrue(effect.over)
        val unknown = Limits.effect(rule, history, at("2026-10-19T12:00"), null, cutoff)
        assertEquals(3000.0, unknown.after)
        assertTrue(unknown.amountUnknown)
    }

    @Test
    fun `minimum interval previews check the doses before and after`() {
        val rule = LimitRule(LimitKind.MIN_INTERVAL, 0.0, 2 * 60L)
        val tooSoon = Limits.effect(rule, listOf(dose("2026-10-19T14:40")), at("2026-10-19T15:00"), null, cutoff)
        assertTrue(tooSoon.over)
        assertEquals(at("2026-10-19T16:40").at, tooSoon.nextAllowedAt)
        // Logged afterwards, an hour before a later dose.
        assertTrue(Limits.effect(rule, listOf(dose("2026-10-19T16:00")), at("2026-10-19T15:00"), null, cutoff).over)
        assertFalse(Limits.effect(rule, listOf(dose("2026-10-19T12:00")), at("2026-10-19T15:00"), null, cutoff).over)
    }

    @Test
    fun `window days round up`() {
        assertEquals(1, LimitRule(LimitKind.DAYS, 1.0, 60).windowDays)
        assertEquals(30, LimitRule(LimitKind.DAYS, 1.0, month).windowDays)
        assertEquals(7, LimitRule(LimitKind.DAYS, 1.0, 7 * 24 * 60L).windowDays)
    }
}
