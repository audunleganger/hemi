package com.hemi.shared.api

import kotlinx.serialization.Serializable

/** The user's settings (S-1 … S-5). Times of day are HH:MM. */
@Serializable
data class SettingsDto(
    val locale: String?,
    /** IANA zone, e.g. "Europe/Oslo"; null until the web app sets it from the browser (S-4). */
    val timeZone: String?,
    val theme: Theme,
    val dimDuringAttacks: Boolean,
    val dayCutoff: String,
    val followUpMinutes: Int,
    /** Null: the most used medication (S-3). */
    val usualMedicationId: Long?,
    /** ISO days of week, 1 = Monday. */
    val workdays: List<Int>,
    val workStart: String,
    val workEnd: String,
    /** The calendar feed is on (X-3). */
    val calendarFeed: Boolean,
)

@Serializable
data class SettingsInput(
    val timeZone: String? = null,
    val theme: Theme = Theme.DARK,
    val dimDuringAttacks: Boolean = true,
    val dayCutoff: String = "04:00",
    val followUpMinutes: Int = 120,
    val usualMedicationId: Long? = null,
    val workdays: List<Int> = listOf(1, 2, 3, 4, 5),
    val workStart: String = "08:00",
    val workEnd: String = "14:00",
)
