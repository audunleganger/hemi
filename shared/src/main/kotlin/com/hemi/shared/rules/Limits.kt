package com.hemi.shared.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.LocalDate
import kotlin.math.ceil

/** The kinds of limit on an active ingredient (LI-1). */
@Serializable
enum class LimitKind {
    /** At most this much of the ingredient (in its unit) within the window. */
    @SerialName("amount") AMOUNT,

    /** At most this many doses within the window, whatever their quantity or medication. */
    @SerialName("doses") DOSES,

    /** At most this many days (by cutoff) with at least one dose within the window. */
    @SerialName("days") DAYS,

    /** At least this long between two doses; [LimitRule.max] is unused. */
    @SerialName("min_interval") MIN_INTERVAL,
}

/** LI-5: OK, near (≥ 80 %), reached (= max) or over (> max). Reached and over are shown alike. */
@Serializable
enum class LimitState {
    @SerialName("ok") OK,
    @SerialName("near") NEAR,
    @SerialName("reached") REACHED,
    @SerialName("over") OVER,
}

/**
 * One limit (LI-1, LI-2). [windowMinutes] is the rolling window ("month" = 30 days), or the minimum
 * interval for [LimitKind.MIN_INTERVAL].
 */
data class LimitRule(val kind: LimitKind, val max: Double, val windowMinutes: Long) {
    val windowMillis: Long get() = windowMinutes * MINUTE

    /**
     * Days-with-use windows count whole days by cutoff: today and the days before it, as many as the window
     * has days (rounded up). "6 days per 30 days" is today and the 29 days before.
     */
    val windowDays: Int get() = ceil(windowMinutes / (24.0 * 60)).toInt().coerceAtLeast(1)
}

/** A dose as a limit sees it: when, and how much of the ingredient (null: the amount per unit isn't known, ME-2). */
data class CountedDose(val id: Long, val at: Moment, val amount: Double?)

/** Where a limit stands now (LI-5). */
data class LimitUsage(
    val used: Double,
    val max: Double,
    val state: LimitState,
    /** Amount and dose limits: when the oldest dose in the window leaves it. */
    val freesUpAt: Long? = null,
    /** Days limits: the day the oldest counted day leaves the window ("1 day frees up on 24 Oct"). */
    val freesUpOn: LocalDate? = null,
    /** Minimum interval: when the next dose is allowed; null when it already is. */
    val nextAllowedAt: Long? = null,
    /** Amount limits: doses in the window whose amount isn't known, so they aren't in [used] (ME-2). */
    val unknownAmounts: Int = 0,
)

/** What logging one more dose would do to a limit (LI-4). */
data class LimitEffect(
    val before: Double,
    val after: Double,
    val max: Double,
    /** The dose would take the limit over its maximum, or come too soon after (or before) another dose. */
    val over: Boolean,
    /** Minimum interval: the earliest time the dose would have been allowed, after the dose before it. */
    val nextAllowedAt: Long? = null,
    /** Amount limits: the new dose's amount isn't known, so it isn't counted (ME-2). */
    val amountUnknown: Boolean = false,
)

object Limits {
    private const val EPSILON = 1e-9

    fun state(used: Double, max: Double): LimitState = when {
        used > max + EPSILON -> LimitState.OVER
        used >= max - EPSILON -> LimitState.REACHED
        used >= 0.8 * max - EPSILON -> LimitState.NEAR
        else -> LimitState.OK
    }

    /** The limit's status at [now] (LI-5). Doses after [now] aren't counted yet. */
    fun usage(rule: LimitRule, doses: List<CountedDose>, now: Moment, cutoff: DayCutoff): LimitUsage {
        val past = doses.filter { it.at.at <= now.at }
        return when (rule.kind) {
            LimitKind.AMOUNT, LimitKind.DOSES -> {
                val inWindow = past.filter { it.at.at > now.at - rule.windowMillis }
                val used = if (rule.kind == LimitKind.AMOUNT) inWindow.sumOf { it.amount ?: 0.0 } else inWindow.size.toDouble()
                LimitUsage(
                    used = used,
                    max = rule.max,
                    state = state(used, rule.max),
                    freesUpAt = inWindow.minOfOrNull { it.at.at }?.plus(rule.windowMillis),
                    unknownAmounts = if (rule.kind == LimitKind.AMOUNT) inWindow.count { it.amount == null } else 0,
                )
            }
            LimitKind.DAYS -> {
                val days = daysInWindow(rule, past, cutoff.dayOf(now), cutoff)
                val used = days.size.toDouble()
                LimitUsage(used, rule.max, state(used, rule.max), freesUpOn = days.minOrNull()?.plusDays(rule.windowDays.toLong()))
            }
            LimitKind.MIN_INTERVAL -> {
                val next = past.maxOfOrNull { it.at.at }?.plus(rule.windowMillis)?.takeIf { it > now.at }
                LimitUsage(
                    used = if (next != null) 1.0 else 0.0,
                    max = 1.0,
                    state = if (next != null) LimitState.REACHED else LimitState.OK,
                    nextAllowedAt = next,
                )
            }
        }
    }

    /**
     * The effect of a new dose at [at] with [amount] of the ingredient, given the user's other [doses] (LI-4).
     * Windows end at the new dose's time. A dose being edited is left out of [doses] by the caller.
     */
    fun effect(rule: LimitRule, doses: List<CountedDose>, at: Moment, amount: Double?, cutoff: DayCutoff): LimitEffect =
        when (rule.kind) {
            LimitKind.AMOUNT, LimitKind.DOSES -> {
                val inWindow = doses.filter { it.at.at <= at.at && it.at.at > at.at - rule.windowMillis }
                val before = if (rule.kind == LimitKind.AMOUNT) inWindow.sumOf { it.amount ?: 0.0 } else inWindow.size.toDouble()
                val added = if (rule.kind == LimitKind.AMOUNT) amount ?: 0.0 else 1.0
                val after = before + added
                LimitEffect(before, after, rule.max, after > rule.max + EPSILON, amountUnknown = rule.kind == LimitKind.AMOUNT && amount == null)
            }
            LimitKind.DAYS -> {
                val day = cutoff.dayOf(at)
                val days = daysInWindow(rule, doses.filter { it.at.at <= at.at }, day, cutoff)
                val before = days.size.toDouble()
                val after = before + if (day in days) 0 else 1
                LimitEffect(before, after, rule.max, after > rule.max + EPSILON)
            }
            LimitKind.MIN_INTERVAL -> {
                val previous = doses.filter { it.at.at <= at.at }.maxOfOrNull { it.at.at }
                val following = doses.filter { it.at.at > at.at }.minOfOrNull { it.at.at }
                val tooSoon = previous != null && at.at - previous < rule.windowMillis
                val tooClose = following != null && following - at.at < rule.windowMillis
                LimitEffect(0.0, 0.0, 0.0, tooSoon || tooClose, nextAllowedAt = previous?.plus(rule.windowMillis)?.takeIf { tooSoon })
            }
        }

    /** The days (by cutoff) with a dose, among the window's days ending with [lastDay]. */
    private fun daysInWindow(rule: LimitRule, doses: List<CountedDose>, lastDay: LocalDate, cutoff: DayCutoff): Set<LocalDate> {
        val firstDay = lastDay.minusDays(rule.windowDays - 1L)
        return doses.mapTo(HashSet()) { cutoff.dayOf(it.at) }.filterTo(HashSet()) { it in firstDay..lastDay }
    }
}
