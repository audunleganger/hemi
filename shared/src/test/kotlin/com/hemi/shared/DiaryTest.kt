package com.hemi.shared

import com.hemi.shared.api.AttackStatus
import com.hemi.shared.api.AttackUpdate
import com.hemi.shared.api.DoseInput
import com.hemi.shared.api.DosePreviewInput
import com.hemi.shared.api.EndInput
import com.hemi.shared.api.ErrorCodes
import com.hemi.shared.api.IngredientInput
import com.hemi.shared.api.LimitInput
import com.hemi.shared.api.LogAfterwardsInput
import com.hemi.shared.api.MedicationIngredientInput
import com.hemi.shared.api.MedicationInput
import com.hemi.shared.api.PastDoseInput
import com.hemi.shared.api.QuickDoseInput
import com.hemi.shared.api.RateInput
import com.hemi.shared.api.ReadingInput
import com.hemi.shared.api.StartAttackInput
import com.hemi.shared.domain.AppException
import com.hemi.shared.rules.LimitKind
import com.hemi.shared.rules.LimitState
import com.hemi.shared.rules.Rating
import com.hemi.shared.rules.WorkImpact
import com.hemi.shared.rules.at
import com.hemi.shared.service.DoseFilter
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Attacks, doses, ratings and the views built from them, through the services. */
class DiaryTest {
    private val month = 30 * 24 * 60L

    /** A user with sumatriptan (6 days / 30 days, 2 doses / 24 h, 2 h apart), Imigran tablets and a cold pack. */
    private class Setup(val t: TestDb = TestDb()) {
        val sumatriptan = t.ingredients().create(IngredientInput("Sumatriptan", "mg"))
        val imigran = t.medications().create(
            MedicationInput("Imigran 50 mg", doseUnit = "tablet", doseUnitPlural = "tablets", ingredients = listOf(MedicationIngredientInput(sumatriptan.id, 50.0))),
        )
        val coldPack = t.medications().create(MedicationInput("Cold pack", doseUnit = "use"))
        val days = t.limits().create(LimitInput(sumatriptan.id, LimitKind.DAYS, 6.0, 30 * 24 * 60L))
        val doses = t.limits().create(LimitInput(sumatriptan.id, LimitKind.DOSES, 2.0, 24 * 60L))
        val interval = t.limits().create(LimitInput(sumatriptan.id, LimitKind.MIN_INTERVAL, 0.0, 120))
    }

    @Test
    fun `starting an attack is one call, and only one can be ongoing (AT-1)`() {
        val s = Setup()
        val result = s.t.attacks().start(StartAttackInput())
        val attack = result.attack.summary
        assertTrue(attack.ongoing)
        assertEquals(1, attack.peak)
        assertEquals(AttackStatus.MIGRAINE, attack.status)
        assertNull(result.recurrenceOf)
        assertEquals(ErrorCodes.ATTACK_ONGOING, assertFailsWith<AppException> { s.t.attacks().start(StartAttackInput()) }.code)
        assertEquals(attack.id, s.t.home().home().ongoing?.summary?.id)
    }

    @Test
    fun `start with the usual medication logs the dose too`() {
        val s = Setup()
        val result = s.t.attacks().start(StartAttackInput(severity = 2, dose = QuickDoseInput(s.imigran.id)))
        assertEquals(result.attack.summary.id, result.dose?.attackId)
        assertEquals(1, s.t.attacks().get(result.attack.summary.id).doses.size)
    }

    @Test
    fun `woke up with it marks the start as unknown (AT-2)`() {
        val s = Setup()
        val attack = s.t.attacks().start(StartAttackInput(at = at("2026-10-19T07:00"), wokeUp = true, severity = 2)).attack
        assertTrue(attack.episodes.single().startUnknown)
        assertEquals(at("2026-10-19T07:00"), attack.summary.start)
    }

    @Test
    fun `a reading of 0 ends the episode, and a new attack within 48 h is a recurrence (AT-6, AT-7)`() {
        val s = Setup()
        s.t.now("2026-10-19T08:00")
        val first = s.t.attacks().start(StartAttackInput(severity = 2)).attack.summary.id
        s.t.now("2026-10-19T12:00")
        val ended = s.t.attacks().addReading(first, ReadingInput(severity = 0))
        assertFalse(ended.summary.ongoing)
        assertEquals(at("2026-10-19T12:00"), ended.summary.end)

        s.t.now("2026-10-20T20:00")
        val again = s.t.attacks().start(StartAttackInput(severity = 1))
        assertEquals(first, again.recurrenceOf)
        assertEquals(2, again.attack.episodes.size)
        assertTrue(again.attack.episodes.last().isRecurrence)

        // Undo: the recurrence becomes its own attack, with its reading.
        val split = s.t.attacks().split(first, again.episodeId)
        assertTrue(split.summary.id != first)
        assertEquals(listOf(1), split.readings.map { it.severity })
        assertEquals(1, s.t.attacks().get(first).episodes.size)
        assertEquals(listOf(2, 0), s.t.attacks().get(first).readings.map { it.severity })
    }

    @Test
    fun `more than 48 h later is a new attack`() {
        val s = Setup()
        s.t.now("2026-10-15T08:00")
        val first = s.t.attacks().start(StartAttackInput()).attack.summary.id
        s.t.attacks().end(first, EndInput())
        s.t.now("2026-10-17T08:01")
        assertNull(s.t.attacks().start(StartAttackInput()).recurrenceOf)
    }

    @Test
    fun `a dose joins the ongoing attack and records the current severity (DO-1, DO-2)`() {
        val s = Setup()
        s.t.now("2026-10-19T08:00")
        val attack = s.t.attacks().start(StartAttackInput()).attack.summary.id
        s.t.now("2026-10-19T09:00")
        val dose = s.t.doses().create(DoseInput(s.imigran.id, severity = 3))
        assertEquals(attack, dose.attackId)
        assertEquals("tablet", dose.doseUnit)
        assertEquals(3, s.t.attacks().get(attack).summary.peak)
        // Without an attack, e.g. for back pain (DO-3); it still counts toward limits (LI-6).
        val loose = s.t.doses().create(DoseInput(s.imigran.id, quantity = 2.0, attackId = null, autoAttack = false))
        assertNull(loose.attackId)
        assertEquals("tablets", loose.doseUnit)
        assertEquals(2.0, s.t.home().home().limits.first { it.limit.kind == LimitKind.DOSES }.used)
    }

    @Test
    fun `the preview warns before going over a limit, and the dose is marked (LI-4)`() {
        val s = Setup()
        for (day in 13..18) {
            s.t.now("2026-10-${day}T09:00")
            s.t.doses().create(DoseInput(s.imigran.id))
        }
        s.t.now("2026-10-19T09:00")
        val preview = s.t.doses().preview(DosePreviewInput(s.imigran.id))
        val days = preview.effects.first { it.kind == LimitKind.DAYS }
        assertEquals(6.0, days.before)
        assertEquals(7.0, days.after)
        assertTrue(preview.over)
        val dose = s.t.doses().create(DoseInput(s.imigran.id))
        assertTrue(dose.overLimit)
        assertEquals(LimitState.OVER, s.t.home().home().limits.first().state)
    }

    @Test
    fun `remedies never count toward limits or acute medication days (ME-2, ST-7)`() {
        val s = Setup()
        s.t.doses().create(DoseInput(s.coldPack.id))
        assertTrue(s.t.doses().preview(DosePreviewInput(s.coldPack.id)).effects.isEmpty())
        assertEquals(0, s.t.home().home().acuteMedicationDays.count)
        s.t.doses().create(DoseInput(s.imigran.id))
        assertEquals(1, s.t.home().home().acuteMedicationDays.count)
    }

    @Test
    fun `doses are due for rating after the follow-up delay, with a prefilled suggestion (DO-5, DO-6)`() {
        val s = Setup()
        s.t.now("2026-10-19T08:00")
        val attack = s.t.attacks().start(StartAttackInput(severity = 3, dose = QuickDoseInput(s.imigran.id))).attack.summary.id
        val dose = s.t.attacks().get(attack).doses.single()
        s.t.now("2026-10-19T09:59")
        assertTrue(s.t.home().home().pendingRatings.isEmpty())
        s.t.now("2026-10-19T10:00")
        val pending = s.t.home().home().pendingRatings.single()
        assertEquals(dose.id, pending.dose.id)
        assertEquals(3, pending.lastSeverity)

        assertEquals(Rating.RELIEVED, s.t.doses().suggestion(dose.id, 1).rating)
        assertEquals(Rating.PAIN_FREE, s.t.doses().suggestion(dose.id, 0).rating)
        val rated = s.t.doses().rate(dose.id, RateInput(Rating.PAIN_FREE, severity = 0))
        assertEquals(Rating.PAIN_FREE, rated.rating)
        assertEquals(true, rated.sustained)
        // The 0 ended the attack.
        assertFalse(s.t.attacks().get(attack).summary.ongoing)
        assertTrue(s.t.home().home().pendingRatings.isEmpty())

        // A recurrence the next day makes it "pain free, not sustained" (DO-7).
        s.t.now("2026-10-20T10:00")
        s.t.attacks().start(StartAttackInput())
        assertEquals(false, s.t.doses().get(dose.id).sustained)
    }

    @Test
    fun `no prefill when another dose came in between`() {
        val s = Setup()
        s.t.now("2026-10-19T08:00")
        val attack = s.t.attacks().start(StartAttackInput(severity = 3, dose = QuickDoseInput(s.imigran.id))).attack
        s.t.now("2026-10-19T09:00")
        s.t.doses().create(DoseInput(s.coldPack.id))
        s.t.now("2026-10-19T10:00")
        assertNull(s.t.doses().suggestion(attack.doses.single().id, 1).rating)
    }

    @Test
    fun `dismissed ratings stop asking`() {
        val s = Setup()
        s.t.now("2026-10-19T08:00")
        s.t.attacks().start(StartAttackInput(dose = QuickDoseInput(s.imigran.id)))
        s.t.now("2026-10-19T11:00")
        val pending = s.t.home().home().pendingRatings.single()
        s.t.doses().dismiss(pending.dose.id)
        assertTrue(s.t.home().home().pendingRatings.isEmpty())
    }

    @Test
    fun `logging afterwards needs only a start, and its doses are never pending (AT-14, AT-15)`() {
        val s = Setup()
        s.t.now("2026-10-19T12:00")
        val bare = s.t.attacks().logAfterwards(LogAfterwardsInput(start = at("2026-10-18T14:00")))
        assertFalse(bare.summary.ongoing)
        assertNull(bare.summary.peak)
        assertNull(bare.summary.end)
        assertNull(bare.summary.durationMillis)

        val full = s.t.attacks().logAfterwards(
            LogAfterwardsInput(
                start = at("2026-10-16T14:00"),
                end = at("2026-10-16T22:00"),
                peakSeverity = 3,
                doses = listOf(PastDoseInput(s.imigran.id, at = at("2026-10-16T14:30")), PastDoseInput(s.coldPack.id, at = at("2026-10-16T15:00"), rating = Rating.RELIEVED)),
            ),
        )
        assertEquals(3, full.summary.peak)
        assertTrue(full.readings.single().estimated)
        assertEquals(listOf(null, Rating.RELIEVED), full.doses.map { it.rating })
        s.t.now("2026-10-19T20:00")
        assertTrue(s.t.home().home().pendingRatings.isEmpty())
        // A day with a dose but no readings: not a known severity (AT-15).
        val calendar = s.t.home().calendar("2026-10-01", "2026-10-31")
        assertEquals(listOf("2026-10-16", "2026-10-18"), calendar.days.map { it.date })
        assertEquals(listOf(3, null), calendar.days.map { it.severity })
    }

    @Test
    fun `unsure attacks are left out of the calendar unless asked for, not migraine always (AT-4)`() {
        val s = Setup()
        s.t.now("2026-10-19T12:00")
        val unsure = s.t.attacks().logAfterwards(LogAfterwardsInput(start = at("2026-10-17T14:00"), status = AttackStatus.UNSURE, peakSeverity = 1))
        s.t.attacks().logAfterwards(LogAfterwardsInput(start = at("2026-10-18T14:00"), status = AttackStatus.NOT_MIGRAINE, peakSeverity = 1))
        assertTrue(s.t.home().calendar("2026-10-01", "2026-10-31").days.isEmpty())
        val included = s.t.home().calendar("2026-10-01", "2026-10-31", includeUnsure = true).days.single()
        assertEquals("2026-10-17", included.date)
        assertTrue(included.unsure)
        // Their doses still count toward limits (LI-6).
        s.t.attacks().update(unsure.summary.id, AttackUpdate(AttackStatus.UNSURE))
        s.t.doses().create(DoseInput(s.imigran.id, attackId = unsure.summary.id))
        assertEquals(1.0, s.t.home().home().limits.first { it.limit.kind == LimitKind.DAYS }.used)
    }

    @Test
    fun `the day view proposes a work impact, which the user can override (WI-2, WI-3)`() {
        val s = Setup()
        // Monday 19 October.
        s.t.now("2026-10-19T07:30")
        val attack = s.t.attacks().start(StartAttackInput(severity = 2)).attack.summary.id
        s.t.now("2026-10-19T18:00")
        s.t.attacks().addReading(attack, ReadingInput(severity = 0))
        val day = s.t.home().day("2026-10-19")
        assertEquals(WorkImpact.MISSED, day.workImpact?.proposed)
        assertEquals(listOf(2, 0), day.readings.map { it.reading.severity })
        val overridden = s.t.home().setWorkImpact("2026-10-19", WorkImpact.NONE)
        assertEquals(WorkImpact.NONE, overridden.workImpact?.effective)
        assertEquals(WorkImpact.MISSED, overridden.workImpact?.proposed)
        // Days without a migraine attack have no work impact.
        assertNull(s.t.home().day("2026-10-20").workImpact)
    }

    @Test
    fun `an attack open for more than 24 h without a reading is asked about (AT-6)`() {
        val s = Setup()
        s.t.now("2026-10-18T21:30")
        val attack = s.t.attacks().start(StartAttackInput(severity = 2)).attack.summary.id
        s.t.now("2026-10-19T21:00")
        assertNull(s.t.home().home().staleAttack)
        s.t.now("2026-10-19T21:31")
        val stale = assertNotNull(s.t.home().home().staleAttack)
        assertEquals(attack, stale.attackId)
        assertEquals(2, stale.lastReading?.severity)
        s.t.attacks().end(attack, EndInput(stale.lastReading!!.at))
        assertNull(s.t.home().home().staleAttack)
    }

    @Test
    fun `deleting an attack keeps its doses (AT-12)`() {
        val s = Setup()
        val attack = s.t.attacks().start(StartAttackInput(dose = QuickDoseInput(s.imigran.id))).attack.summary.id
        s.t.attacks().delete(attack)
        assertNull(s.t.doses().list().single().attackId)
        assertEquals(1, s.t.doses().list(DoseFilter(withAttack = false)).size)
    }

    @Test
    fun `users only see their own diary (A-1)`() {
        val s = Setup()
        s.t.attacks().start(StartAttackInput(dose = QuickDoseInput(s.imigran.id)))
        s.t.db.appUserQueries.insertUser("kari", "x", false, "nb", 0)
        val kari = s.t.db.appUserQueries.lastInsertRowId().executeAsOne()
        assertTrue(s.t.attacks(kari).list().isEmpty())
        assertTrue(s.t.medications(kari).list().isEmpty())
        assertFailsWith<AppException> { s.t.doses(kari).create(DoseInput(s.imigran.id)) }
        assertFailsWith<AppException> { s.t.attacks(kari).get(s.t.attacks().list().single().id) }
    }

    @Test
    fun `the usual medication is the one set, else the most used, with a preview for the front page (S-3, DS-3)`() {
        val s = Setup()
        s.t.doses().create(DoseInput(s.coldPack.id))
        assertEquals(s.coldPack.id, s.t.home().home().usualMedication?.id)
        val settings = s.t.settings().get()
        s.t.settings().update(com.hemi.shared.api.SettingsInput(timeZone = settings.timeZone, usualMedicationId = s.imigran.id))
        val home = s.t.home().home()
        assertEquals(s.imigran.id, home.usualMedication?.id)
        assertFalse(home.usualDosePreview!!.over)
    }

    @Test
    fun `month windows are 30 days`() {
        assertEquals(30, com.hemi.shared.rules.LimitRule(LimitKind.DAYS, 6.0, month).windowDays)
    }
}
