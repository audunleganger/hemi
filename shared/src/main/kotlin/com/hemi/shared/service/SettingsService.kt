package com.hemi.shared.service

import com.hemi.db.HemiDatabase
import com.hemi.shared.api.SettingsDto
import com.hemi.shared.api.SettingsInput
import com.hemi.shared.api.code
import com.hemi.shared.api.enumOfCode
import com.hemi.shared.domain.notFound
import com.hemi.shared.domain.validation
import com.hemi.shared.rules.formatClock
import com.hemi.shared.rules.parseClock
import java.security.SecureRandom
import java.util.Base64

/** The user's settings (S-1 … S-6) and calendar feed (X-3). */
class SettingsService(private val db: HemiDatabase, private val userId: Long) {
    fun get(): SettingsDto {
        val user = db.appUserQueries.selectById(userId).executeAsOneOrNull() ?: notFound("User")
        return SettingsDto(
            locale = user.locale,
            timeZone = user.time_zone,
            theme = enumOfCode(user.theme),
            dimDuringAttacks = user.dim_during_attacks,
            dayCutoff = formatClock(user.day_cutoff.toInt()),
            followUpMinutes = user.follow_up_minutes.toInt(),
            usualMedicationId = user.usual_medication_id,
            workdays = UserSettings.parseWorkdays(user.workdays).sorted(),
            workStart = formatClock(user.work_start.toInt()),
            workEnd = formatClock(user.work_end.toInt()),
            signWindowHours = user.sign_window_hours.toInt(),
            calendarFeed = user.ics_token != null,
        )
    }

    fun update(input: SettingsInput): SettingsDto = db.transactionWithResult {
        val zone = input.timeZone?.trim()?.takeIf { it.isNotEmpty() }
        if (zone != null && UserSettings.zoneOrNull(zone) == null) validation("Unknown time zone '$zone'")
        val cutoff = parseClock(input.dayCutoff) ?: validation("Invalid day cutoff '${input.dayCutoff}', expected HH:MM")
        if (cutoff > 12 * 60) validation("The day cutoff must be at noon or earlier")
        if (input.followUpMinutes !in 1..24 * 60) validation("The follow-up delay must be between 1 minute and 24 hours")
        val workdays = input.workdays.toSortedSet()
        if (workdays.any { it !in 1..7 }) validation("Workdays are 1 (Monday) to 7 (Sunday)")
        val start = parseClock(input.workStart) ?: validation("Invalid work start '${input.workStart}'")
        val end = parseClock(input.workEnd) ?: validation("Invalid work end '${input.workEnd}'")
        if (end <= start) validation("Work must end after it starts")
        if (input.signWindowHours !in 1..48) validation("Warning signs count for 1 to 48 hours before an attack")
        input.usualMedicationId?.let { id ->
            if (db.medicationQueries.selectMedications(userId).executeAsList().none { it.id == id }) notFound("Medication")
        }
        db.appUserQueries.updateSettings(
            time_zone = zone,
            theme = input.theme.code(),
            dim_during_attacks = input.dimDuringAttacks,
            day_cutoff = cutoff.toLong(),
            follow_up_minutes = input.followUpMinutes.toLong(),
            usual_medication_id = input.usualMedicationId,
            workdays = workdays.joinToString(","),
            work_start = start.toLong(),
            work_end = end.toLong(),
            sign_window_hours = input.signWindowHours.toLong(),
            id = userId,
        )
        get()
    }

    /** Sets only the time zone, e.g. from the browser on first use (S-4). */
    fun setTimeZone(zone: String): SettingsDto {
        if (UserSettings.zoneOrNull(zone) == null) validation("Unknown time zone '$zone'")
        val current = get()
        return update(current.toInput().copy(timeZone = zone))
    }

    /** Turns the feed on with a new secret, which stops any old URL working (X-3). Returns the secret. */
    fun newFeedToken(): String {
        val bytes = ByteArray(32).also(random::nextBytes)
        val token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        db.appUserQueries.updateIcsToken(token, userId)
        return token
    }

    fun feedToken(): String? = db.appUserQueries.selectById(userId).executeAsOneOrNull()?.ics_token

    fun disableFeed() = db.appUserQueries.updateIcsToken(null, userId)

    private fun SettingsDto.toInput() = SettingsInput(timeZone, theme, dimDuringAttacks, dayCutoff, followUpMinutes, usualMedicationId, workdays, workStart, workEnd, signWindowHours)

    companion object {
        private val random = SecureRandom()
    }
}
