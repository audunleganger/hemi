package com.hemi.shared.api

import com.hemi.shared.domain.validation
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.serializer

/** S-4. */
@Serializable
enum class Theme {
    @SerialName("dark") DARK,
    @SerialName("light") LIGHT,
    @SerialName("system") SYSTEM,
}

/** ME-4; v1 only offers acute. */
@Serializable
enum class MedicationKind {
    @SerialName("acute") ACUTE,
    @SerialName("preventive") PREVENTIVE,
}

/** AT-4. */
@Serializable
enum class AttackStatus {
    @SerialName("migraine") MIGRAINE,
    @SerialName("unsure") UNSURE,
    @SerialName("not_migraine") NOT_MIGRAINE,
}

/** AT-8. */
@Serializable
enum class Nausea {
    @SerialName("none") NONE,
    @SerialName("nauseous") NAUSEOUS,
    @SerialName("vomited") VOMITED,
}

/** AT-9, seen from behind: the user's left is on the left. */
@Serializable
enum class PainSide {
    @SerialName("left") LEFT,
    @SerialName("right") RIGHT,
    @SerialName("both") BOTH,
}

/** The name an enum value has in the API and the database. */
inline fun <reified T : Enum<T>> T.code(): String = serializer<T>().descriptor.getElementName(ordinal)

/** The enum value with [code] as its API and database name. */
inline fun <reified T : Enum<T>> enumOfCode(code: String): T {
    val index = serializer<T>().descriptor.getElementIndex(code)
    if (index < 0) validation("Unknown value '$code'")
    return enumValues<T>()[index]
}
