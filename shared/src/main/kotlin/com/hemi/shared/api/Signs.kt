package com.hemi.shared.api

import com.hemi.shared.rules.Moment
import kotlinx.serialization.Serializable

@Serializable
data class SymptomInput(
    val name: String,
)

@Serializable
data class SymptomDto(
    val id: Long,
    val name: String,
    val sortOrder: Int,
    val archived: Boolean,
    val signCount: Int,
)

/** The user's order of their symptoms (WS-2). */
@Serializable
data class SymptomOrderInput(
    val ids: List<Long>,
)

/** Symptoms without pain, logged without starting an attack (WS-1). */
@Serializable
data class WarningSignDto(
    val id: Long,
    val at: Moment,
    val symptomIds: List<Long>,
    val note: String?,
    /** The attack it came before (WS-3), derived; null: none within the window (S-6). */
    val attackId: Long?,
    /** That attack's episode start it came before. */
    val attackStart: Moment?,
    val createdAt: Long,
    val updatedAt: Long,
)

@Serializable
data class WarningSignInput(
    /** Null: now. */
    val at: Moment? = null,
    val symptomIds: List<Long> = emptyList(),
    val note: String? = null,
)
