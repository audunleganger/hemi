package com.hemi.shared.service

import com.hemi.db.HemiDatabase
import com.hemi.shared.api.AttackStatus
import com.hemi.shared.api.Nausea
import com.hemi.shared.api.PainSide
import com.hemi.shared.domain.Languages
import com.hemi.shared.rules.Moment
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * The read-only iCalendar feed (X-3): one event per *Migraine* or *Unsure* attack, from its first episode's start
 * to its last one's end (ongoing: until now). An attack logged afterwards without an end is an all-day event on
 * its start day (AT-15). *Not migraine* attacks are left out.
 */
class CalendarFeed(private val db: HemiDatabase, private val userId: Long, private val now: () -> Long = System::currentTimeMillis) {
    private class Words(
        val migraine: String,
        val severity: String,
        val possible: String,
        val doses: String,
        val nausea: Map<Nausea, String>,
        val painSide: Map<PainSide, String>,
        val nauseaLabel: String,
        val painSideLabel: String,
        val triggers: String,
        val calendarName: String,
    )

    private val words = mapOf(
        "en" to Words(
            "Migraine", "severity", "Possible migraine", "Doses",
            mapOf(Nausea.NONE to "none", Nausea.NAUSEOUS to "nauseous", Nausea.VOMITED to "vomited"),
            mapOf(PainSide.LEFT to "left", PainSide.RIGHT to "right", PainSide.BOTH to "both sides"),
            "Nausea", "Pain side", "Triggers", "Migraine attacks",
        ),
        "nb" to Words(
            "Migrene", "grad", "Mulig migrene", "Inntak",
            mapOf(Nausea.NONE to "ingen", Nausea.NAUSEOUS to "kvalm", Nausea.VOMITED to "kastet opp"),
            mapOf(PainSide.LEFT to "venstre", PainSide.RIGHT to "høyre", PainSide.BOTH to "begge sider"),
            "Kvalme", "Smerteside", "Utløsere", "Migreneanfall",
        ),
    )

    fun render(): String {
        val snapshot = Snapshot(db, userId, now())
        val w = words[Languages.of(snapshot.user.locale)] ?: words.getValue("en")
        val triggerNames = snapshot.triggers.associate { it.id to it.name }
        val lines = mutableListOf("BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hemi//Migraine diary//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:${escape(w.calendarName)}")
        snapshot.attacks.values.sortedBy { snapshot.timelines.getValue(it.id).start?.at }.forEach { attack ->
            val status = snapshot.status(attack)
            if (status == AttackStatus.NOT_MIGRAINE) return@forEach
            val timeline = snapshot.timelines.getValue(attack.id)
            val start = timeline.start ?: return@forEach
            val title = when {
                status == AttackStatus.UNSURE -> w.possible
                timeline.peak != null -> "${w.migraine} · ${w.severity} ${timeline.peak}"
                else -> w.migraine
            }
            val description = buildList {
                val doses = snapshot.dosesByAttack[attack.id].orEmpty()
                if (doses.isNotEmpty()) {
                    add("${w.doses}: " + doses.joinToString(", ") { dose ->
                        val medication = snapshot.medications.getValue(dose.medication_id)
                        val time = Moment(dose.taken_at, dose.taken_offset.toInt()).local.toLocalTime().format(CLOCK)
                        "${medication.row.name} ${formatQuantity(dose.quantity)} ${medication.unitLabel(dose.quantity)} $time"
                    })
                }
                attack.nausea?.let { add("${w.nauseaLabel}: ${w.nausea.getValue(enumOfNausea(it))}") }
                attack.pain_side?.let { add("${w.painSideLabel}: ${w.painSide.getValue(enumOfPainSide(it))}") }
                snapshot.attackTriggers[attack.id].orEmpty().mapNotNull(triggerNames::get).takeIf { it.isNotEmpty() }?.let { add("${w.triggers}: ${it.joinToString(", ")}") }
            }
            lines += "BEGIN:VEVENT"
            lines += "UID:attack-${attack.id}@hemi"
            lines += "DTSTAMP:${utc(attack.updated_at)}"
            val end = timeline.end
            when {
                timeline.ongoing -> {
                    lines += "DTSTART:${utc(start.at)}"
                    lines += "DTEND:${utc(maxOf(snapshot.now, start.at))}"
                }
                end != null -> {
                    lines += "DTSTART:${utc(start.at)}"
                    lines += "DTEND:${utc(end.at)}"
                }
                else -> {
                    val day = snapshot.settings.cutoff.dayOf(start)
                    lines += "DTSTART;VALUE=DATE:${day.format(DATE)}"
                    lines += "DTEND;VALUE=DATE:${day.plusDays(1).format(DATE)}"
                }
            }
            lines += "SUMMARY:${escape(title)}"
            if (description.isNotEmpty()) lines += "DESCRIPTION:${escape(description.joinToString("\n"))}"
            lines += "END:VEVENT"
        }
        lines += "END:VCALENDAR"
        return lines.joinToString("") { fold(it) + "\r\n" }
    }

    private fun enumOfNausea(code: String) = com.hemi.shared.api.enumOfCode<Nausea>(code)

    private fun enumOfPainSide(code: String) = com.hemi.shared.api.enumOfCode<PainSide>(code)

    companion object {
        private val UTC_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC)
        private val DATE = DateTimeFormatter.ofPattern("yyyyMMdd")
        private val CLOCK = DateTimeFormatter.ofPattern("HH:mm")

        private fun utc(millis: Long) = UTC_FORMAT.format(Instant.ofEpochMilli(millis))

        private fun formatQuantity(quantity: Double) = if (quantity % 1.0 == 0.0) quantity.toLong().toString() else quantity.toString()

        /** RFC 5545 text escaping. */
        internal fun escape(text: String) = text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")

        /** RFC 5545 folds lines longer than 75 octets, continuing with a space; never inside a UTF-8 sequence. */
        internal fun fold(line: String): String {
            val out = StringBuilder()
            var octets = 0
            for (ch in line) {
                val size = ch.toString().toByteArray().size
                if (octets + size > 75) {
                    out.append("\r\n ")
                    octets = 1
                }
                out.append(ch)
                octets += size
            }
            return out.toString()
        }
    }
}
