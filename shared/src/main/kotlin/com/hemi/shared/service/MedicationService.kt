package com.hemi.shared.service

import com.hemi.db.HemiDatabase
import com.hemi.shared.api.ErrorCodes
import com.hemi.shared.api.IngredientDto
import com.hemi.shared.api.IngredientInput
import com.hemi.shared.api.LimitDto
import com.hemi.shared.api.LimitInput
import com.hemi.shared.api.MedicationDto
import com.hemi.shared.api.MedicationImageData
import com.hemi.shared.api.MedicationInput
import com.hemi.shared.api.MedicationKind
import com.hemi.shared.api.code
import com.hemi.shared.domain.AppException
import com.hemi.shared.domain.ImageRules
import com.hemi.shared.domain.MAX_NAME_LENGTH
import com.hemi.shared.domain.StoredImage
import com.hemi.shared.domain.cleanName
import com.hemi.shared.domain.notFound
import com.hemi.shared.domain.requirePositive
import com.hemi.shared.domain.validation
import com.hemi.shared.normalizeName
import com.hemi.shared.rules.LimitKind

/** Active ingredients (IN-1 … IN-5). */
class IngredientService(private val db: HemiDatabase, private val userId: Long, private val now: () -> Long = System::currentTimeMillis) {
    private val queries = db.medicationQueries

    fun list(includeArchived: Boolean = false): List<IngredientDto> {
        val snapshot = Snapshot(db, userId, now())
        return snapshot.ingredients.values.filter { includeArchived || !it.archived }.map { toDto(snapshot, it.id) }
    }

    fun get(id: Long): IngredientDto {
        val snapshot = Snapshot(db, userId, now())
        if (id !in snapshot.ingredients) notFound("Ingredient")
        return toDto(snapshot, id)
    }

    fun create(input: IngredientInput): IngredientDto = db.transactionWithResult {
        val name = NameRules.cleanUnique(input.name, null, taken(), "ingredient")
        queries.insertIngredient(userId, name, normalizeName(name), cleanUnit(input.measureUnit), false, now())
        get(db.appUserQueries.lastInsertRowId().executeAsOne())
    }

    fun update(id: Long, input: IngredientInput): IngredientDto = db.transactionWithResult {
        get(id)
        val name = NameRules.cleanUnique(input.name, id, taken(), "ingredient")
        queries.updateIngredient(name, normalizeName(name), cleanUnit(input.measureUnit), id, userId)
        get(id)
    }

    /** Archived ingredients are hidden from pickers but kept in history (IN-5). */
    fun setArchived(id: Long, archived: Boolean): IngredientDto {
        get(id)
        queries.setIngredientArchived(archived, id, userId)
        return get(id)
    }

    /** Only when no medication contains it; otherwise archive it (IN-5). */
    fun delete(id: Long) = db.transaction {
        val ingredient = get(id)
        if (ingredient.medicationIds.isNotEmpty()) {
            throw AppException(ErrorCodes.REFERENCED, "Ingredient is in medications", 409, mapOf("medications" to ingredient.medicationIds.size.toLong()))
        }
        queries.deleteIngredient(id, userId)
    }

    private fun taken() = queries.selectIngredients(userId).executeAsList().associate { it.id to it.name_norm }

    private fun toDto(snapshot: Snapshot, id: Long): IngredientDto {
        val row = snapshot.ingredients.getValue(id)
        return IngredientDto(
            id = row.id,
            name = row.name,
            measureUnit = row.measure_unit,
            archived = row.archived,
            medicationIds = snapshot.medications.values.filter { m -> m.ingredients.any { it.ingredientId == id } }.map { it.id },
            limits = snapshot.limits.filter { it.ingredient_id == id }.map(snapshot::limitStatus),
        )
    }

    private fun cleanUnit(unit: String): String {
        val clean = unit.trim()
        if (clean.isEmpty()) validation("A measure unit is required")
        if (clean.length > 20) validation("The measure unit is longer than 20 characters")
        return clean
    }
}

/** Limits per ingredient (LI-1 … LI-3). All values are the user's own; nothing is suggested. */
class LimitService(private val db: HemiDatabase, private val userId: Long) {
    private val queries = db.medicationQueries

    fun create(input: LimitInput): LimitDto = db.transactionWithResult {
        validate(input)
        queries.insertLimit(userId, input.ingredientId, input.kind.code(), maxFor(input), input.windowMinutes)
        get(db.appUserQueries.lastInsertRowId().executeAsOne())
    }

    fun update(id: Long, input: LimitInput): LimitDto = db.transactionWithResult {
        val existing = get(id)
        if (existing.ingredientId != input.ingredientId) validation("A limit can't move to another ingredient")
        validate(input)
        queries.updateLimit(input.kind.code(), maxFor(input), input.windowMinutes, id, userId)
        get(id)
    }

    fun delete(id: Long) {
        get(id)
        queries.deleteLimit(id, userId)
    }

    fun get(id: Long): LimitDto {
        val snapshot = Snapshot(db, userId, 0)
        return snapshot.limits.firstOrNull { it.id == id }?.let(snapshot::limitDto) ?: notFound("Limit")
    }

    private fun maxFor(input: LimitInput) = if (input.kind == LimitKind.MIN_INTERVAL) 0.0 else input.maxValue

    private fun validate(input: LimitInput) {
        if (queries.selectIngredients(userId).executeAsList().none { it.id == input.ingredientId }) notFound("Ingredient")
        if (input.windowMinutes <= 0) validation("The window must be longer than zero")
        if (input.windowMinutes > MAX_WINDOW_MINUTES) validation("The window can be at most a year")
        if (input.kind != LimitKind.MIN_INTERVAL) {
            requirePositive(input.maxValue, "The maximum")
            if (input.maxValue <= 0) validation("The maximum must be a positive number")
            if (input.kind != LimitKind.AMOUNT && input.maxValue % 1.0 != 0.0) validation("The maximum must be a whole number")
        }
    }

    companion object {
        const val MAX_WINDOW_MINUTES = 366L * 24 * 60
    }
}

/** Medications and remedies (ME-1 … ME-8). */
class MedicationService(private val db: HemiDatabase, private val userId: Long, private val now: () -> Long = System::currentTimeMillis) {
    private val queries = db.medicationQueries

    /** Most used first, then by name (DO-1). */
    fun list(includeArchived: Boolean = false): List<MedicationDto> {
        val snapshot = Snapshot(db, userId, now())
        return snapshot.medications.values
            .filter { includeArchived || !it.row.archived }
            .map(snapshot::medicationDto)
            .sortedWith(compareByDescending<MedicationDto> { it.doseCount }.thenBy { it.name.lowercase() })
    }

    fun get(id: Long): MedicationDto {
        val snapshot = Snapshot(db, userId, now())
        return snapshot.medications[id]?.let(snapshot::medicationDto) ?: notFound("Medication")
    }

    fun create(input: MedicationInput): MedicationDto = db.transactionWithResult {
        val clean = validate(input, null)
        queries.insertMedication(
            userId, clean.name, normalizeName(clean.name), clean.kind.code(), clean.doseUnit, clean.doseUnitPlural,
            clean.defaultQuantity, clean.followUpMinutes?.toLong(), false, now(),
        )
        val id = db.appUserQueries.lastInsertRowId().executeAsOne()
        writeIngredients(id, clean)
        get(id)
    }

    fun update(id: Long, input: MedicationInput): MedicationDto = db.transactionWithResult {
        get(id)
        val clean = validate(input, id)
        queries.updateMedication(
            clean.name, normalizeName(clean.name), clean.kind.code(), clean.doseUnit, clean.doseUnitPlural,
            clean.defaultQuantity, clean.followUpMinutes?.toLong(), id, userId,
        )
        queries.deleteMedicationIngredients(id)
        writeIngredients(id, clean)
        get(id)
    }

    fun setArchived(id: Long, archived: Boolean): MedicationDto {
        get(id)
        queries.setMedicationArchived(archived, id, userId)
        return get(id)
    }

    /** Only when no dose uses it; otherwise archive it (ME-5). */
    fun delete(id: Long) = db.transaction {
        val medication = get(id)
        if (medication.doseCount > 0) {
            throw AppException(ErrorCodes.REFERENCED, "Medication has doses", 409, mapOf("doses" to medication.doseCount.toLong()))
        }
        queries.deleteMedication(id, userId)
    }

    /** Stores the photo (ME-8), replacing any previous one. Clients shrink it before sending. */
    fun setImage(id: Long, data: MedicationImageData): MedicationDto = db.transactionWithResult {
        val before = get(id)
        val image = ImageRules.decode(data.image, data.contentType, ImageRules.MAX_IMAGE_BYTES, "image")
        val thumbnail = ImageRules.decode(data.thumbnail, data.contentType, ImageRules.MAX_THUMBNAIL_BYTES, "thumbnail")
        // The version must change even for two uploads within the same millisecond.
        queries.upsertMedicationImage(id, data.contentType, image, thumbnail, maxOf(now(), (before.imageVersion ?: 0) + 1))
        get(id)
    }

    fun deleteImage(id: Long): MedicationDto = db.transactionWithResult {
        get(id)
        queries.deleteMedicationImage(id)
        get(id)
    }

    fun image(id: Long, thumbnail: Boolean): StoredImage? =
        if (thumbnail) {
            queries.selectMedicationThumbnail(id, userId).executeAsOneOrNull()?.let { StoredImage(it.content_type, it.thumbnail, it.updated_at) }
        } else {
            queries.selectMedicationImage(id, userId).executeAsOneOrNull()?.let { StoredImage(it.content_type, it.image, it.updated_at) }
        }

    /** The photo as stored, for export; null if none. */
    internal fun imageData(id: Long): MedicationImageData? =
        queries.selectMedicationImageFull(id, userId).executeAsOneOrNull()?.let {
            MedicationImageData(it.content_type, ImageRules.encode(it.image), ImageRules.encode(it.thumbnail))
        }

    private fun writeIngredients(id: Long, input: MedicationInput) =
        input.ingredients.forEach { queries.insertMedicationIngredient(id, it.ingredientId, it.amountPerUnit) }

    private fun validate(input: MedicationInput, selfId: Long?): MedicationInput {
        val taken = queries.selectMedications(userId).executeAsList().associate { it.id to it.name_norm }
        val name = NameRules.cleanUnique(input.name, selfId, taken, "medication")
        if (input.kind != MedicationKind.ACUTE) validation("Only acute medications are supported yet")
        val unit = cleanName(input.doseUnit)
        val plural = input.doseUnitPlural.trim()
        if (plural.length > MAX_NAME_LENGTH) validation("The plural is longer than $MAX_NAME_LENGTH characters")
        if (!input.defaultQuantity.isFinite() || input.defaultQuantity <= 0) validation("The default quantity must be a positive number")
        input.followUpMinutes?.let { if (it !in 1..24 * 60) validation("The follow-up delay must be between 1 minute and 24 hours") }
        val ingredientIds = queries.selectIngredients(userId).executeAsList().map { it.id }.toSet()
        if (input.ingredients.map { it.ingredientId }.toSet().size != input.ingredients.size) validation("An ingredient is listed twice")
        input.ingredients.forEach {
            if (it.ingredientId !in ingredientIds) notFound("Ingredient")
            it.amountPerUnit?.let { amount -> if (!amount.isFinite() || amount <= 0) validation("Amounts must be positive numbers") }
        }
        return input.copy(name = name, doseUnit = unit, doseUnitPlural = plural)
    }
}
