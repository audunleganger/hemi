package com.hemi.shared.service

import com.hemi.db.HemiDatabase
import com.hemi.shared.api.TriggerDto
import com.hemi.shared.api.TriggerOrderInput
import com.hemi.shared.domain.Languages
import com.hemi.shared.domain.notFound
import com.hemi.shared.domain.validation
import com.hemi.shared.normalizeName

/** The user's own triggers, in their own order (TR-1 … TR-3). */
class TriggerService(private val db: HemiDatabase, private val userId: Long) {
    private val queries = db.diaryQueries

    fun list(includeArchived: Boolean = false): List<TriggerDto> {
        val counts = queries.selectAttackTriggers(userId).executeAsList().groupingBy { it.trigger_id }.eachCount()
        return queries.selectTriggers(userId).executeAsList()
            .filter { includeArchived || !it.archived }
            .map { TriggerDto(it.id, it.name, it.sort_order.toInt(), it.archived, counts[it.id] ?: 0) }
    }

    fun get(id: Long): TriggerDto = list(includeArchived = true).firstOrNull { it.id == id } ?: notFound("Trigger")

    /** New triggers go last. */
    fun create(name: String): TriggerDto = db.transactionWithResult {
        val rows = queries.selectTriggers(userId).executeAsList()
        val clean = NameRules.cleanUnique(name, null, rows.associate { it.id to it.name_norm }, "trigger")
        queries.insertTrigger(userId, clean, normalizeName(clean), (rows.maxOfOrNull { it.sort_order } ?: -1) + 1, false)
        get(db.appUserQueries.lastInsertRowId().executeAsOne())
    }

    fun rename(id: Long, name: String): TriggerDto = db.transactionWithResult {
        get(id)
        val clean = NameRules.cleanUnique(name, id, queries.selectTriggers(userId).executeAsList().associate { it.id to it.name_norm }, "trigger")
        queries.updateTrigger(clean, normalizeName(clean), id, userId)
        get(id)
    }

    /** [TriggerOrderInput.ids] must list all the user's triggers. */
    fun reorder(input: TriggerOrderInput): List<TriggerDto> = db.transactionWithResult {
        val ids = queries.selectTriggers(userId).executeAsList().map { it.id }.toSet()
        if (input.ids.toSet() != ids || input.ids.size != ids.size) validation("The order must list each trigger once")
        input.ids.forEachIndexed { index, id -> queries.setTriggerOrder(index.toLong(), id, userId) }
        list(includeArchived = true)
    }

    /** Archived triggers are hidden from the toggles but stay on old attacks (TR-3). */
    fun setArchived(id: Long, archived: Boolean): TriggerDto {
        get(id)
        queries.setTriggerArchived(archived, id, userId)
        return get(id)
    }

    /** Removes it from its attacks too (TR-3); clients confirm first with [TriggerDto.attackCount]. */
    fun delete(id: Long) {
        get(id)
        queries.deleteTrigger(id, userId)
    }
}

/** What every new user starts with (IN-2, TR-2): a short list of triggers in their language, and nothing else. */
object Seeder {
    private val starterTriggers = mapOf(
        "en" to listOf("Poor sleep", "Alcohol", "Stress", "Skipped meal", "Dehydration", "Screen time"),
        "nb" to listOf("Dårlig søvn", "Alkohol", "Stress", "Hoppet over måltid", "For lite væske", "Skjermtid"),
    )

    fun seed(db: HemiDatabase, userId: Long, locale: String?) = db.transaction {
        if (db.diaryQueries.selectTriggers(userId).executeAsList().isNotEmpty()) return@transaction
        val names = starterTriggers[Languages.of(locale)] ?: starterTriggers.getValue("en")
        names.forEachIndexed { index, name -> db.diaryQueries.insertTrigger(userId, name, normalizeName(name), index.toLong(), false) }
    }
}
