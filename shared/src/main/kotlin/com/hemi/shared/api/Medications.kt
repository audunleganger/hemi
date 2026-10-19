package com.hemi.shared.api

import com.hemi.shared.rules.LimitKind
import com.hemi.shared.rules.LimitState
import kotlinx.serialization.Serializable

@Serializable
data class IngredientInput(
    val name: String,
    /** mg, µg, g, ml, IU or free text (IN-1). */
    val measureUnit: String,
)

@Serializable
data class IngredientDto(
    val id: Long,
    val name: String,
    val measureUnit: String,
    val archived: Boolean,
    /** The medications that contain it (IN-4). */
    val medicationIds: List<Long>,
    /** Its limits and where they stand now (IN-3, IN-4). */
    val limits: List<LimitStatusDto>,
)

/** A limit (LI-1). [windowMinutes] is the rolling window, or the interval for min_interval; a month is 30 days (LI-2). */
@Serializable
data class LimitInput(
    val ingredientId: Long,
    val kind: LimitKind,
    /** Unused for min_interval. */
    val maxValue: Double = 0.0,
    val windowMinutes: Long,
)

@Serializable
data class LimitDto(
    val id: Long,
    val ingredientId: Long,
    val kind: LimitKind,
    val maxValue: Double,
    val windowMinutes: Long,
)

/** Where a limit stands now (LI-5). */
@Serializable
data class LimitStatusDto(
    val limit: LimitDto,
    val ingredientName: String,
    val measureUnit: String,
    val used: Double,
    val max: Double,
    val state: LimitState,
    /** Amount and dose limits: when the oldest dose in the window leaves it (ms). */
    val freesUpAt: Long?,
    /** Days limits: the day (YYYY-MM-DD) the oldest counted day leaves the window. */
    val freesUpOn: String?,
    /** Minimum interval: when the next dose is allowed (ms); null when it already is. */
    val nextAllowedAt: Long?,
    /** Amount limits: doses in the window with an unknown amount (ME-2). */
    val unknownAmounts: Int,
)

@Serializable
data class MedicationIngredientInput(
    val ingredientId: Long,
    /** In the ingredient's unit per dose unit; null: not known (ME-2). */
    val amountPerUnit: Double? = null,
)

@Serializable
data class MedicationInput(
    val name: String,
    val kind: MedicationKind = MedicationKind.ACUTE,
    /** Tablet, spray, … (ME-1). */
    val doseUnit: String,
    /** Empty: the same as [doseUnit]. */
    val doseUnitPlural: String = "",
    val defaultQuantity: Double = 1.0,
    /** Null: the user's default (ME-3, S-2). */
    val followUpMinutes: Int? = null,
    /** None: a remedy (ME-2). */
    val ingredients: List<MedicationIngredientInput> = emptyList(),
)

@Serializable
data class MedicationIngredientDto(
    val ingredientId: Long,
    val ingredientName: String,
    val measureUnit: String,
    val amountPerUnit: Double?,
)

@Serializable
data class MedicationDto(
    val id: Long,
    val name: String,
    val kind: MedicationKind,
    val doseUnit: String,
    val doseUnitPlural: String,
    val defaultQuantity: Double,
    val followUpMinutes: Int?,
    /** [followUpMinutes] or the user's default. */
    val effectiveFollowUpMinutes: Int,
    val ingredients: List<MedicationIngredientDto>,
    /** No active ingredient: logged and rated, never limited (ME-2). */
    val isRemedy: Boolean,
    val archived: Boolean,
    /** Changes with the photo; null without one (ME-8). */
    val imageVersion: Long?,
    val doseCount: Int,
)

/** A photo and its thumbnail, base64-encoded; clients shrink them first (ME-8). */
@Serializable
data class MedicationImageData(
    val contentType: String,
    val image: String,
    val thumbnail: String,
)

@Serializable
data class TriggerInput(
    val name: String,
)

@Serializable
data class TriggerDto(
    val id: Long,
    val name: String,
    val sortOrder: Int,
    val archived: Boolean,
    val attackCount: Int,
)

/** The user's order of their triggers (TR-1). */
@Serializable
data class TriggerOrderInput(
    val ids: List<Long>,
)
