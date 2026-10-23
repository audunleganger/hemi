package com.hemi.shared.service

import com.hemi.db.HemiDatabase
import com.hemi.shared.api.WarningSignDto
import com.hemi.shared.api.WarningSignInput
import com.hemi.shared.domain.cleanOptionalText
import com.hemi.shared.domain.notFound
import java.time.LocalDate

/** Warning signs (WS-1 … WS-6): symptoms without pain, logged without starting an attack. */
class SignService(private val db: HemiDatabase, private val userId: Long, private val now: () -> Long = System::currentTimeMillis) {
    private val queries = db.signsQueries

    private fun snapshot() = Snapshot(db, userId, now())

    /** Newest first (V-4); [from] and [to] are days by cutoff. */
    fun list(from: LocalDate? = null, to: LocalDate? = null): List<WarningSignDto> {
        val snapshot = snapshot()
        val cutoff = snapshot.settings.cutoff
        return snapshot.signs
            .filter { from == null || cutoff.dayOf(snapshot.signMoment(it)) >= from }
            .filter { to == null || cutoff.dayOf(snapshot.signMoment(it)) <= to }
            .map(snapshot::signDto)
            .sortedByDescending { it.at.at }
    }

    fun get(id: Long): WarningSignDto {
        val snapshot = snapshot()
        return snapshot.signDto(snapshot.signs.firstOrNull { it.id == id } ?: notFound("Warning sign"))
    }

    fun create(input: WarningSignInput): WarningSignDto = db.transactionWithResult {
        val time = now()
        val at = input.at?.let { checkMoment(it, "The time", time) } ?: snapshot().nowMoment
        queries.insertSign(userId, at.at, at.offset.toLong(), cleanOptionalText(input.note), time, time)
        val id = db.appUserQueries.lastInsertRowId().executeAsOne()
        writeSymptoms(id, input.symptomIds)
        get(id)
    }

    /** Replaces all fields; a missing time keeps the current one. */
    fun update(id: Long, input: WarningSignInput): WarningSignDto = db.transactionWithResult {
        val current = get(id)
        val time = now()
        val at = input.at?.let { checkMoment(it, "The time", time) } ?: current.at
        queries.updateSign(at.at, at.offset.toLong(), cleanOptionalText(input.note), time, id, userId)
        writeSymptoms(id, input.symptomIds)
        get(id)
    }

    fun delete(id: Long) = db.transaction {
        get(id)
        queries.deleteSign(id, userId)
    }

    private fun writeSymptoms(signId: Long, symptomIds: List<Long>) {
        val known = queries.selectSymptoms(userId).executeAsList().map { it.id }.toSet()
        if (symptomIds.any { it !in known }) notFound("Symptom")
        queries.deleteSignSymptoms(signId)
        symptomIds.distinct().forEach { queries.insertSignSymptom(signId, it) }
    }
}
