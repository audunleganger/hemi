package com.hemi.shared.service

import com.hemi.db.HemiDatabase
import com.hemi.shared.api.SymptomDto
import com.hemi.shared.api.SymptomOrderInput
import com.hemi.shared.domain.notFound
import com.hemi.shared.domain.validation
import com.hemi.shared.normalizeName

/** The user's own symptoms for warning signs, in their own order (WS-2); they work like triggers (TR-1, TR-3). */
class SymptomService(private val db: HemiDatabase, private val userId: Long) {
    private val queries = db.signsQueries

    fun list(includeArchived: Boolean = false): List<SymptomDto> {
        val counts = queries.selectSignSymptoms(userId).executeAsList().groupingBy { it.symptom_id }.eachCount()
        return queries.selectSymptoms(userId).executeAsList()
            .filter { includeArchived || !it.archived }
            .map { SymptomDto(it.id, it.name, it.sort_order.toInt(), it.archived, counts[it.id] ?: 0) }
    }

    fun get(id: Long): SymptomDto = list(includeArchived = true).firstOrNull { it.id == id } ?: notFound("Symptom")

    /** New symptoms go last. */
    fun create(name: String): SymptomDto = db.transactionWithResult {
        val rows = queries.selectSymptoms(userId).executeAsList()
        val clean = NameRules.cleanUnique(name, null, rows.associate { it.id to it.name_norm }, "symptom")
        queries.insertSymptom(userId, clean, normalizeName(clean), (rows.maxOfOrNull { it.sort_order } ?: -1) + 1, false)
        get(db.appUserQueries.lastInsertRowId().executeAsOne())
    }

    fun rename(id: Long, name: String): SymptomDto = db.transactionWithResult {
        get(id)
        val clean = NameRules.cleanUnique(name, id, queries.selectSymptoms(userId).executeAsList().associate { it.id to it.name_norm }, "symptom")
        queries.updateSymptom(clean, normalizeName(clean), id, userId)
        get(id)
    }

    /** [SymptomOrderInput.ids] must list all the user's symptoms. */
    fun reorder(input: SymptomOrderInput): List<SymptomDto> = db.transactionWithResult {
        val ids = queries.selectSymptoms(userId).executeAsList().map { it.id }.toSet()
        if (input.ids.toSet() != ids || input.ids.size != ids.size) validation("The order must list each symptom once")
        input.ids.forEachIndexed { index, id -> queries.setSymptomOrder(index.toLong(), id, userId) }
        list(includeArchived = true)
    }

    /** Archived symptoms are hidden from the toggles but stay on old warning signs. */
    fun setArchived(id: Long, archived: Boolean): SymptomDto {
        get(id)
        queries.setSymptomArchived(archived, id, userId)
        return get(id)
    }

    /** Removes it from its warning signs too; clients confirm first with [SymptomDto.signCount]. */
    fun delete(id: Long) {
        get(id)
        queries.deleteSymptom(id, userId)
    }
}
