package com.hemi.shared.api

import com.hemi.shared.rules.LimitKind
import com.hemi.shared.rules.Moment
import com.hemi.shared.rules.Rating
import com.hemi.shared.rules.WorkImpact
import kotlinx.serialization.Serializable

@Serializable
data class EpisodeDto(
    val id: Long,
    val start: Moment,
    /** Null: ongoing, or not recorded (AT-15). */
    val end: Moment?,
    /** Woke up with it (AT-2). */
    val startUnknown: Boolean,
    val isRecurrence: Boolean,
    /** Gone when the user woke up: [end] is an estimate (AT-6). */
    val endUnknown: Boolean,
)

@Serializable
data class ReadingDto(
    val id: Long,
    val at: Moment,
    val severity: Int,
    /** A peak given when logging afterwards (AT-14). */
    val estimated: Boolean,
)

@Serializable
data class DoseDto(
    val id: Long,
    val medicationId: Long,
    val medicationName: String,
    /** The dose unit for this quantity: singular for exactly 1, otherwise the plural. */
    val doseUnit: String,
    val quantity: Double,
    val at: Moment,
    val note: String?,
    val attackId: Long?,
    val rating: Rating?,
    val ratedAt: Long?,
    val ratingDismissed: Boolean,
    /** Saved over a limit (LI-4). */
    val overLimit: Boolean,
    /** When it's due for rating (DO-5); null when it won't be asked for. */
    val dueAt: Long?,
    /** For pain free doses: false when a recurrence followed (DO-7). */
    val sustained: Boolean?,
    val isRemedy: Boolean,
    val imageVersion: Long?,
)

@Serializable
data class AttackSummary(
    val id: Long,
    val status: AttackStatus,
    val loggedAfterwards: Boolean,
    val start: Moment,
    /** Woke up with it: the real start is unknown (AT-2). */
    val wokeUp: Boolean,
    val end: Moment?,
    /** Gone when the user woke up: [end] is an estimate (AT-6). */
    val endedAsleep: Boolean,
    val ongoing: Boolean,
    /** Null: no readings (AT-15). */
    val peak: Int?,
    val painSide: PainSide?,
    val nausea: Nausea?,
    val triggerIds: List<Long>,
    val doseCount: Int,
    val episodeCount: Int,
    /** Duration in ms; null when the end isn't known. Ongoing attacks: until now. */
    val durationMillis: Long?,
)

@Serializable
data class AttackDto(
    val summary: AttackSummary,
    val note: String?,
    val episodes: List<EpisodeDto>,
    val readings: List<ReadingDto>,
    val doses: List<DoseDto>,
    /** The warning signs that came before it (WS-3), oldest first. */
    val signs: List<WarningSignDto>,
    val createdAt: Long,
    val updatedAt: Long,
)

/** Starts an attack (AT-1, AT-2). [at]: now by default; with [wokeUp] it's the wake-up time and the real start is unknown. */
@Serializable
data class StartAttackInput(
    val at: Moment? = null,
    val severity: Int = 1,
    val wokeUp: Boolean = false,
    /** "Start attack + take ⟨usual medication⟩" (AT-1). */
    val dose: QuickDoseInput? = null,
)

@Serializable
data class QuickDoseInput(
    val medicationId: Long,
    /** Null: the medication's default quantity. */
    val quantity: Double? = null,
)

@Serializable
data class StartAttackResult(
    val attack: AttackDto,
    /** Set when it was added to this attack as a recurrence instead (AT-7); undo with split. */
    val recurrenceOf: Long?,
    val episodeId: Long,
    val dose: DoseDto?,
)

@Serializable
data class ReadingInput(
    /** Null: now. */
    val at: Moment? = null,
    val severity: Int,
)

/** Discarding the ongoing attack (AT-16). */
@Serializable
data class DiscardInput(
    /** False: the episode's doses stay, without an attack. */
    val deleteDoses: Boolean = true,
)

@Serializable
data class DiscardResult(
    /** Set when the episode was a recurrence: the earlier attack, back to how it was. Null: the attack is gone. */
    val restored: AttackDto?,
)

/** "It's over" (AT-6). */
@Serializable
data class EndInput(
    /** Null: now. */
    val at: Moment? = null,
    /** Gone when the user woke up: [at] is when they fell asleep, an estimate. */
    val asleep: Boolean = false,
)

@Serializable
data class AttackUpdate(
    val status: AttackStatus,
    val nausea: Nausea? = null,
    val painSide: PainSide? = null,
    val note: String? = null,
    val triggerIds: List<Long> = emptyList(),
)

@Serializable
data class EpisodeInput(
    val start: Moment,
    val startUnknown: Boolean = false,
    val end: Moment? = null,
    /** Gone when the user woke up (AT-6); ignored without [end]. */
    val endUnknown: Boolean = false,
)

/** AT-14: an attack that is over. Only [start] is required. */
@Serializable
data class LogAfterwardsInput(
    val start: Moment,
    val end: Moment? = null,
    /** Stored as one estimated reading at the start. */
    val peakSeverity: Int? = null,
    val status: AttackStatus = AttackStatus.MIGRAINE,
    val nausea: Nausea? = null,
    val painSide: PainSide? = null,
    val triggerIds: List<Long> = emptyList(),
    val note: String? = null,
    val doses: List<PastDoseInput> = emptyList(),
)

@Serializable
data class PastDoseInput(
    val medicationId: Long,
    /** Null: the medication's default quantity. */
    val quantity: Double? = null,
    val at: Moment,
    val rating: Rating? = null,
)

@Serializable
data class DoseInput(
    val medicationId: Long,
    /** Null: the medication's default quantity. */
    val quantity: Double? = null,
    /** Null: now. */
    val at: Moment? = null,
    val note: String? = null,
    /** The attack it belongs to; null: none, or, when creating with [autoAttack], the ongoing one (DO-1). */
    val attackId: Long? = null,
    val autoAttack: Boolean = true,
    /** The current severity, stored as a reading at the dose's time when it belongs to an attack (DO-2). */
    val severity: Int? = null,
)

/** The effect of a dose on the limits before it's saved (LI-4, DO-4). */
@Serializable
data class DosePreviewInput(
    val medicationId: Long,
    val quantity: Double? = null,
    val at: Moment? = null,
    /** The dose being edited, left out of the counts. */
    val doseId: Long? = null,
)

@Serializable
data class LimitEffectDto(
    val limitId: Long,
    val ingredientName: String,
    val measureUnit: String,
    val kind: LimitKind,
    val windowMinutes: Long,
    val before: Double,
    val after: Double,
    val max: Double,
    val over: Boolean,
    /** Minimum interval: the earliest time the dose would have been allowed (ms). */
    val nextAllowedAt: Long?,
    val amountUnknown: Boolean,
)

@Serializable
data class DosePreview(
    val effects: List<LimitEffectDto>,
    /** The dose would go over at least one limit. */
    val over: Boolean,
)

@Serializable
data class RateInput(
    val rating: Rating,
    /** The current severity, stored as a reading now when the dose belongs to an attack (DO-5). */
    val severity: Int? = null,
    /** Null: now. */
    val at: Moment? = null,
)

@Serializable
data class RatingSuggestion(
    /** Null: no suggestion (no reading at the dose, or another dose in between). */
    val rating: Rating?,
    /** The severity at the dose, if known. */
    val before: Int?,
)

@Serializable
data class PendingRating(
    val dose: DoseDto,
    /** The attack's last reading, to prefill the current severity. */
    val lastSeverity: Int?,
)

/** An attack that started live and hasn't had a reading for over 24 h (AT-6). */
@Serializable
data class StaleAttack(
    val attackId: Long,
    val start: Moment,
    val lastReading: ReadingDto?,
)

/** ST-7: days with an acute medication with an active ingredient, today and the 29 days before. */
@Serializable
data class AcuteMedicationDays(
    val count: Int,
    val windowDays: Int,
    /** The day the oldest counted day leaves the window. */
    val freesUpOn: String?,
)

/** Everything the front page shows (V-1). */
@Serializable
data class HomeView(
    /** YYYY-MM-DD by the day cutoff. */
    val today: String,
    val ongoing: AttackDto?,
    val pendingRatings: List<PendingRating>,
    val staleAttack: StaleAttack?,
    /** Near and over first (V-1). */
    val limits: List<LimitStatusDto>,
    val acuteMedicationDays: AcuteMedicationDays,
    /** The usual medication (S-3) and what taking it now would do to the limits (DS-3). */
    val usualMedication: MedicationDto?,
    val usualDosePreview: DosePreview?,
)

@Serializable
data class CalendarDay(
    val date: String,
    /** The day's peak severity; null: unknown (AT-15) or no attack. */
    val severity: Int?,
    /** A migraine attack, or an unsure one when included, that day. */
    val attack: Boolean,
    /** Only unsure attacks that day: outlined rather than filled (DS-9). */
    val unsure: Boolean,
    /** A dose that day. */
    val medication: Boolean,
    /** A warning sign that day (WS-1, DS-9). */
    val signs: Boolean,
    val ongoing: Boolean,
    /** The effective work impact on migraine days (WI-1); null otherwise or when nothing is known. */
    val workImpact: WorkImpact?,
)

@Serializable
data class CalendarView(
    val from: String,
    val to: String,
    val today: String,
    /** Only days with an attack, a dose or a warning sign. */
    val days: List<CalendarDay>,
)

@Serializable
data class DayReading(
    val attackId: Long,
    val reading: ReadingDto,
)

@Serializable
data class WorkImpactDto(
    val proposed: WorkImpact?,
    val override: WorkImpact?,
    /** The override, else the proposal. */
    val effective: WorkImpact?,
)

@Serializable
data class WorkImpactInput(
    /** Null: back to the proposal. */
    val impact: WorkImpact?,
)

/** One day (by cutoff) for the selected-day timeline (DS-2). */
@Serializable
data class DayView(
    val date: String,
    val attacks: List<AttackSummary>,
    val readings: List<DayReading>,
    val doses: List<DoseDto>,
    val signs: List<WarningSignDto>,
    /** Only on migraine days (WI-1). */
    val workImpact: WorkImpactDto?,
)
