package com.hemi.shared

import com.hemi.shared.api.AttackStatus
import com.hemi.shared.api.AttackUpdate
import com.hemi.shared.api.LogAfterwardsInput
import com.hemi.shared.api.Nausea
import com.hemi.shared.api.PainSide
import com.hemi.shared.api.StartAttackInput
import com.hemi.shared.rules.at
import com.hemi.shared.service.CalendarFeed
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** X-3. */
class CalendarFeedTest {
    @Test
    fun `text is escaped and long lines folded at 75 octets`() {
        assertEquals("a\\, b\\; c\\\\ d\\ne",CalendarFeed.escape("a, b; c\\ d\ne"))
        val folded = CalendarFeed.fold("DESCRIPTION:" + "ø".repeat(60))
        assertTrue(folded.split("\r\n").all { it.toByteArray().size <= 75 })
        assertEquals("DESCRIPTION:" + "ø".repeat(60), folded.replace("\r\n ", ""))
    }

    @Test
    fun `one event per attack, without not-migraine ones, in the user's language`() {
        val t = TestDb("nb")
        t.now("2026-10-19T12:00")
        val logged = t.attacks().logAfterwards(LogAfterwardsInput(start = at("2026-10-16T14:00"), end = at("2026-10-16T20:00"), peakSeverity = 3))
        t.attacks().update(logged.summary.id, AttackUpdate(AttackStatus.MIGRAINE, nausea = Nausea.VOMITED, painSide = PainSide.LEFT, triggerIds = listOf(t.triggers().list().first().id)))
        t.attacks().logAfterwards(LogAfterwardsInput(start = at("2026-10-15T14:00"), status = AttackStatus.NOT_MIGRAINE))
        t.attacks().logAfterwards(LogAfterwardsInput(start = at("2026-10-13T14:00"), status = AttackStatus.UNSURE))
        t.attacks().start(StartAttackInput(at = at("2026-10-19T10:00")))
        val raw = CalendarFeed(t.db, t.userId) { t.clock }.render()
        val text = raw.replace("\r\n ", "")
        assertEquals(3, Regex("BEGIN:VEVENT").findAll(text).count())
        assertTrue("SUMMARY:Migrene · grad 3" in text)
        assertTrue("SUMMARY:Mulig migrene" in text)
        assertTrue("DESCRIPTION:Kvalme: kastet opp\\nSmerteside: venstre\\nUtløsere: Dårlig søvn" in text, text)
        // The ongoing attack lasts until now: 10:00 to 12:00 Oslo time.
        assertTrue("DTSTART:20261019T080000Z\r\nDTEND:20261019T100000Z" in text)
        assertFalse("2026-10-15" in text)
    }
}
