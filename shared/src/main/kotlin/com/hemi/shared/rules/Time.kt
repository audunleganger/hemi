package com.hemi.shared.rules

import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * A point in time as stored (TI-1): the instant ([at], ms since 1970 UTC) and the UTC offset in minutes
 * where it happened, so it can be shown as the local time it happened even after a time zone change.
 */
@Serializable
data class Moment(val at: Long, val offset: Int) : Comparable<Moment> {
    val local: LocalDateTime get() = LocalDateTime.ofInstant(Instant.ofEpochMilli(at), ZoneOffset.ofTotalSeconds(offset * 60))

    override fun compareTo(other: Moment): Int = at.compareTo(other.at)

    companion object {
        /** [at] with the offset [zone] has at that instant. */
        fun of(at: Long, zone: ZoneId): Moment = Moment(at, zone.rules.getOffset(Instant.ofEpochMilli(at)).totalSeconds / 60)

        /** The local time [time] on [date] in [zone]. */
        fun of(date: LocalDate, time: LocalTime, zone: ZoneId): Moment = of(date.atTime(time).atZone(zone).toInstant().toEpochMilli(), zone)
    }
}

const val MINUTE = 60_000L
const val HOUR = 60 * MINUTE
const val DAY = 24 * HOUR

/**
 * The day cutoff (S-1, TI-2): a moment belongs to the calendar day of its local time minus the cutoff, so with
 * the default 04:00, 00:00–03:59 belongs to the day before.
 */
@JvmInline
value class DayCutoff(val minutes: Int) {
    init {
        require(minutes in 0 until 24 * 60) { "Day cutoff must be within the day" }
    }

    fun dayOf(moment: Moment): LocalDate = moment.local.minusMinutes(minutes.toLong()).toLocalDate()

    /** The instant [day] begins in [zone]: its date at the cutoff time. */
    fun startOf(day: LocalDate, zone: ZoneId): Long = day.atStartOfDay().plusMinutes(minutes.toLong()).atZone(zone).toInstant().toEpochMilli()

    companion object {
        val DEFAULT = DayCutoff(4 * 60)
    }
}

/** Formats minutes since midnight as HH:MM. */
fun formatClock(minutes: Int): String = "%02d:%02d".format(minutes / 60, minutes % 60)

/** Parses HH:MM into minutes since midnight. */
fun parseClock(value: String): Int? {
    val match = Regex("""^(\d{1,2}):(\d{2})$""").matchEntire(value.trim()) ?: return null
    val (h, m) = match.destructured
    val minutes = h.toInt() * 60 + m.toInt()
    return minutes.takeIf { h.toInt() < 24 && m.toInt() < 60 }
}
