package com.hemi.shared

import com.hemi.shared.api.EpisodeInput
import com.hemi.shared.api.EndInput
import com.hemi.shared.api.LogAfterwardsInput
import com.hemi.shared.api.SettingsInput
import com.hemi.shared.api.StartAttackInput
import com.hemi.shared.api.SymptomOrderInput
import com.hemi.shared.api.WarningSignInput
import com.hemi.shared.domain.AppException
import com.hemi.shared.rules.OSLO
import com.hemi.shared.rules.at
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Warning signs and their symptoms (WS-1 … WS-6), through the services. */
class SignsTest {
    @Test
    fun `a new user starts with symptoms in their language (WS-2)`() {
        assertEquals(listOf("Visual aura", "Light sensitivity", "Stiff neck", "Yawning", "Tiredness", "Food cravings", "Mood change"), TestDb().symptoms().list().map { it.name })
        assertEquals("Synsaura", TestDb("nb-NO").symptoms().list().first().name)
    }

    @Test
    fun `symptoms work like triggers (WS-2)`() {
        val t = TestDb()
        val symptoms = t.symptoms()
        val dizzy = symptoms.create("Dizziness")
        assertFailsWith<AppException> { symptoms.create(" dizziness ") }
        assertEquals("Dizzy", symptoms.rename(dizzy.id, "Dizzy").name)
        val ids = symptoms.list().map { it.id }
        assertEquals(dizzy.id, symptoms.reorder(SymptomOrderInput(listOf(dizzy.id) + ids.dropLast(1))).first().id)
        val sign = t.signs().create(WarningSignInput(symptomIds = listOf(dizzy.id)))
        assertEquals(1, symptoms.get(dizzy.id).signCount)
        symptoms.setArchived(dizzy.id, true)
        assertFalse(symptoms.list().any { it.id == dizzy.id })
        assertEquals(listOf(dizzy.id), t.signs().get(sign.id).symptomIds)
        symptoms.delete(dizzy.id)
        assertEquals(emptyList(), t.signs().get(sign.id).symptomIds)
    }

    @Test
    fun `a warning sign is logged, edited and deleted without starting an attack (WS-1, WS-5)`() {
        val t = TestDb()
        t.now("2026-10-19T09:00")
        val yawning = t.symptoms().list().first { it.name == "Yawning" }
        val sign = t.signs().create(WarningSignInput(symptomIds = listOf(yawning.id), note = "  odd  "))
        assertEquals(at("2026-10-19T09:00"), sign.at)
        assertEquals("odd", sign.note)
        assertNull(t.home().home().ongoing)
        assertEquals(emptyList(), t.attacks().list())

        val moved = t.signs().update(sign.id, WarningSignInput(at("2026-10-19T08:30"), emptyList(), null))
        assertEquals(at("2026-10-19T08:30"), moved.at)
        assertEquals(emptyList(), moved.symptomIds)
        assertNull(moved.note)
        assertFailsWith<AppException> { t.signs().create(WarningSignInput(at("2026-10-19T12:00"))) }
        assertFailsWith<AppException> { t.signs().create(WarningSignInput(symptomIds = listOf(999))) }

        t.signs().delete(sign.id)
        assertEquals(emptyList(), t.signs().list())
    }

    @Test
    fun `a sign belongs to the first attack starting within the window (WS-3, S-6)`() {
        val t = TestDb()
        t.now("2026-10-19T08:00")
        val early = t.signs().create(WarningSignInput(at("2026-10-18T20:00")))
        val close = t.signs().create(WarningSignInput(at("2026-10-19T07:00")))
        t.now("2026-10-19T10:00")
        val attack = t.attacks().start(StartAttackInput()).attack
        assertEquals(listOf(close.id), attack.signs.map { it.id })
        assertNull(t.signs().get(early.id).attackId)
        assertEquals(at("2026-10-19T10:00"), t.signs().get(close.id).attackStart)

        // 14 h before is within a 24 h window.
        t.settings().update(SettingsInput(timeZone = OSLO.id, signWindowHours = 24))
        assertEquals(listOf(early.id, close.id), t.attacks().get(attack.summary.id).signs.map { it.id })
        assertFailsWith<AppException> { t.settings().update(SettingsInput(timeZone = OSLO.id, signWindowHours = 49)) }

        // Moving the attack's start moves the link: it's derived.
        val episode = attack.episodes.single()
        t.attacks().updateEpisode(attack.summary.id, episode.id, EpisodeInput(at("2026-10-19T06:00")))
        assertEquals(listOf(early.id), t.attacks().get(attack.summary.id).signs.map { it.id })
    }

    @Test
    fun `a sign before a recurrence belongs to that attack (WS-3)`() {
        val t = TestDb()
        t.now("2026-10-19T10:00")
        val attack = t.attacks().start(StartAttackInput()).attack.summary
        t.now("2026-10-19T14:00")
        t.attacks().end(attack.id, EndInput())
        t.now("2026-10-20T09:00")
        val sign = t.signs().create(WarningSignInput())
        t.now("2026-10-20T11:00")
        val again = t.attacks().start(StartAttackInput())
        assertEquals(attack.id, again.recurrenceOf)
        assertEquals(attack.id, t.signs().get(sign.id).attackId)
    }

    @Test
    fun `signs show in the calendar and the day, not in migraine days (WS-6, DS-9)`() {
        val t = TestDb()
        t.now("2026-10-19T12:00")
        t.signs().create(WarningSignInput(at("2026-10-17T09:00")))
        t.signs().create(WarningSignInput(at("2026-10-18T09:00")))
        t.attacks().logAfterwards(LogAfterwardsInput(at("2026-10-18T10:00"), at("2026-10-18T16:00"), peakSeverity = 2))
        val days = t.home().calendar("2026-10-16", "2026-10-19").days.associateBy { it.date }
        val onlySign = days.getValue("2026-10-17")
        assertTrue(onlySign.signs)
        assertFalse(onlySign.attack)
        assertNull(onlySign.workImpact)
        assertTrue(days.getValue("2026-10-18").signs && days.getValue("2026-10-18").attack)
        assertEquals(1, t.home().day("2026-10-17").signs.size)
        assertEquals(setOf(java.time.LocalDate.parse("2026-10-18")), t.home().migraineDays(snapshotOf(t)))
    }

    private fun snapshotOf(t: TestDb) = com.hemi.shared.service.Snapshot(t.db, t.userId, t.clock)
}
