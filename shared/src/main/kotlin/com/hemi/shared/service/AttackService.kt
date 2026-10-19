package com.hemi.shared.service

import com.hemi.db.Attack
import com.hemi.db.HemiDatabase
import com.hemi.shared.api.AttackDto
import com.hemi.shared.api.AttackStatus
import com.hemi.shared.api.AttackSummary
import com.hemi.shared.api.AttackUpdate
import com.hemi.shared.api.DiscardInput
import com.hemi.shared.api.DiscardResult
import com.hemi.shared.api.DoseInput
import com.hemi.shared.api.EndInput
import com.hemi.shared.api.EpisodeInput
import com.hemi.shared.api.ErrorCodes
import com.hemi.shared.api.LogAfterwardsInput
import com.hemi.shared.api.ReadingInput
import com.hemi.shared.api.StartAttackInput
import com.hemi.shared.api.StartAttackResult
import com.hemi.shared.api.code
import com.hemi.shared.domain.AppException
import com.hemi.shared.domain.cleanOptionalText
import com.hemi.shared.domain.notFound
import com.hemi.shared.domain.validation
import com.hemi.shared.rules.Moment
import com.hemi.shared.rules.Recurrence
import java.time.LocalDate

/** Filters for the attack list (V-4). Days are by cutoff; null means any. */
data class AttackFilter(
    val statuses: Set<AttackStatus>? = null,
    val peak: Int? = null,
    val triggerId: Long? = null,
    val medicationId: Long? = null,
    val from: LocalDate? = null,
    val to: LocalDate? = null,
)

/** Attacks, their episodes and readings (AT-1 … AT-15). */
class AttackService(private val db: HemiDatabase, private val userId: Long, private val now: () -> Long = System::currentTimeMillis) {
    private val queries = db.diaryQueries

    private fun snapshot() = Snapshot(db, userId, now())

    fun get(id: Long): AttackDto {
        val snapshot = snapshot()
        return snapshot.attackDto(snapshot.attacks[id] ?: notFound("Attack"))
    }

    /** Newest first (V-4). */
    fun list(filter: AttackFilter = AttackFilter()): List<AttackSummary> {
        val snapshot = snapshot()
        val cutoff = snapshot.settings.cutoff
        return snapshot.attacks.values.map(snapshot::summary)
            .filter { filter.statuses == null || it.status in filter.statuses }
            .filter { filter.peak == null || it.peak == filter.peak }
            .filter { filter.triggerId == null || filter.triggerId in it.triggerIds }
            .filter { a -> filter.medicationId == null || snapshot.dosesByAttack[a.id].orEmpty().any { it.medication_id == filter.medicationId } }
            .filter { filter.from == null || (it.end?.let(cutoff::dayOf) ?: snapshot.today) >= filter.from || it.ongoing }
            .filter { filter.to == null || cutoff.dayOf(it.start) <= filter.to }
            .sortedByDescending { it.start.at }
    }

    /**
     * Starts an attack (AT-1, AT-2) with a first reading, or, within 48 h of the last one ending, adds a new
     * episode to that one as a recurrence (AT-7). Only one attack can be ongoing.
     */
    fun start(input: StartAttackInput): StartAttackResult = db.transactionWithResult {
        val snapshot = snapshot()
        if (snapshot.ongoing != null) throw AppException(ErrorCodes.ATTACK_ONGOING, "An attack is already ongoing", 409)
        val at = input.at?.let { checkMoment(it, "The start") } ?: snapshot.nowMoment
        if (input.severity !in 1..3) validation("The starting severity must be 1, 2 or 3")
        val candidates = snapshot.attacks.values.map { Recurrence.Candidate(it.id, snapshot.timelines.getValue(it.id).end?.at) }
        val target = Recurrence.target(candidates, at.at)
        val attackId = target ?: insertAttack(loggedAfterwards = false, status = AttackStatus.MIGRAINE)
        queries.insertEpisode(attackId, at.at, at.offset.toLong(), input.wokeUp, null, null, target != null)
        val episodeId = db.appUserQueries.lastInsertRowId().executeAsOne()
        queries.insertReading(attackId, at.at, at.offset.toLong(), input.severity.toLong(), false)
        touch(attackId)
        val dose = input.dose?.let {
            DoseService(db, userId, now).create(DoseInput(it.medicationId, it.quantity, at, attackId = attackId, autoAttack = false))
        }
        StartAttackResult(get(attackId), target, episodeId, dose)
    }

    /**
     * Logs an attack that is over (AT-14). Only the start is required; a peak becomes one estimated reading at
     * the start, and doses logged here are never asked to be rated (DO-6).
     */
    fun logAfterwards(input: LogAfterwardsInput): AttackDto = db.transactionWithResult {
        val start = checkMoment(input.start, "The start")
        val end = input.end?.let { checkMoment(it, "The end") }
        if (end != null && end.at < start.at) validation("The end must be after the start")
        input.peakSeverity?.let { if (it !in 1..3) validation("The peak severity must be 1, 2 or 3") }
        val attackId = insertAttack(loggedAfterwards = true, status = input.status, nausea = input.nausea?.code(), painSide = input.painSide?.code(), note = cleanOptionalText(input.note))
        queries.insertEpisode(attackId, start.at, start.offset.toLong(), false, end?.at, end?.offset?.toLong(), false)
        input.peakSeverity?.let { queries.insertReading(attackId, start.at, start.offset.toLong(), it.toLong(), true) }
        writeTriggers(attackId, input.triggerIds)
        val doses = DoseService(db, userId, now)
        input.doses.forEach {
            doses.createPast(it.medicationId, it.quantity, it.at, attackId, it.rating)
        }
        get(attackId)
    }

    /** Adds a reading (AT-3). A 0 while the attack is ongoing ends the current episode then (AT-6). */
    fun addReading(attackId: Long, input: ReadingInput): AttackDto = db.transactionWithResult {
        val snapshot = snapshot()
        val attack = snapshot.attacks[attackId] ?: notFound("Attack")
        val at = input.at?.let { checkMoment(it, "The reading") } ?: snapshot.nowMoment
        addReadingTo(snapshot, attack, at, input.severity)
        get(attackId)
    }

    internal fun addReadingTo(snapshot: Snapshot, attack: Attack, at: Moment, severity: Int) {
        if (severity !in 0..3) validation("Severity is 0, 1, 2 or 3")
        val timeline = snapshot.timelines.getValue(attack.id)
        val open = snapshot.episodes[attack.id].orEmpty().firstOrNull { it.ended_at == null }
        if (severity == 0 && timeline.ongoing && open != null) {
            if (at.at < open.started_at) validation("The reading is before the attack started")
            queries.endEpisode(at.at, at.offset.toLong(), open.id)
        }
        queries.insertReading(attack.id, at.at, at.offset.toLong(), severity.toLong(), false)
        touch(attack.id)
    }

    /** "It's over" (AT-6): ends the current episode now or at the given time. */
    fun end(attackId: Long, input: EndInput): AttackDto = db.transactionWithResult {
        val snapshot = snapshot()
        snapshot.attacks[attackId] ?: notFound("Attack")
        val open = snapshot.episodes[attackId].orEmpty().firstOrNull { it.ended_at == null } ?: validation("The attack is already over")
        val at = input.at?.let { checkMoment(it, "The end") } ?: snapshot.nowMoment
        if (at.at < open.started_at) validation("The end must be after the start")
        queries.endEpisode(at.at, at.offset.toLong(), open.id)
        touch(attackId)
        get(attackId)
    }

    /**
     * Undoes the start of the ongoing attack (AT-16): removes the ongoing episode with its readings, and its
     * doses unless they're kept without an attack. A recurrence leaves the earlier attack as it was, ended;
     * otherwise the attack is deleted.
     */
    fun discardOngoing(attackId: Long, input: DiscardInput): DiscardResult = db.transactionWithResult {
        val snapshot = snapshot()
        snapshot.attacks[attackId] ?: notFound("Attack")
        if (!snapshot.timelines.getValue(attackId).ongoing) validation("Only an ongoing attack can be discarded")
        val episodes = snapshot.episodes[attackId].orEmpty()
        val open = episodes.last { it.ended_at == null }
        // The first episode is the whole attack: everything in it goes, including anything logged before it.
        val since = if (episodes.size == 1) Long.MIN_VALUE else open.started_at
        if (input.deleteDoses) queries.deleteDosesFrom(attackId, since) else queries.detachDosesFrom(now(), attackId, since)
        if (episodes.size == 1) {
            queries.deleteAttack(attackId, userId)
            DiscardResult(null)
        } else {
            queries.deleteReadingsFrom(attackId, since)
            queries.deleteEpisode(open.id)
            touch(attackId)
            DiscardResult(get(attackId))
        }
    }

    fun update(id: Long, input: AttackUpdate): AttackDto = db.transactionWithResult {
        get(id)
        queries.updateAttack(input.status.code(), input.nausea?.code(), input.painSide?.code(), cleanOptionalText(input.note), now(), id, userId)
        writeTriggers(id, input.triggerIds)
        get(id)
    }

    /** Deletes the attack with its episodes and readings; its doses stay, without an attack (AT-12). */
    fun delete(id: Long) = db.transaction {
        get(id)
        queries.deleteAttack(id, userId)
    }

    /**
     * Makes an episode and the ones after it their own attack, e.g. to undo a recurrence (AT-7). Readings and
     * doses from the episode's start on move with it.
     */
    fun split(attackId: Long, episodeId: Long): AttackDto = db.transactionWithResult {
        val snapshot = snapshot()
        val attack = snapshot.attacks[attackId] ?: notFound("Attack")
        val episodes = snapshot.episodes[attackId].orEmpty()
        val index = episodes.indexOfFirst { it.id == episodeId }
        if (index < 0) notFound("Episode")
        if (index == 0) validation("The first episode is the attack itself")
        val since = episodes[index].started_at
        val newId = insertAttack(loggedAfterwards = attack.logged_afterwards, status = snapshot.status(attack))
        episodes.drop(index).forEachIndexed { i, episode ->
            if (i == 0) queries.moveEpisode(newId, episode.id) else queries.updateEpisodeAttack(newId, episode.id)
        }
        queries.moveReadingsFrom(to = newId, from = attackId, since = since)
        queries.moveDosesFrom(to = newId, from = attackId, since = since)
        touch(attackId)
        get(newId)
    }

    fun updateEpisode(attackId: Long, episodeId: Long, input: EpisodeInput): AttackDto = db.transactionWithResult {
        val snapshot = snapshot()
        val attack = snapshot.attacks[attackId] ?: notFound("Attack")
        val episodes = snapshot.episodes[attackId].orEmpty()
        val episode = episodes.firstOrNull { it.id == episodeId } ?: notFound("Episode")
        val start = checkMoment(input.start, "The start")
        val end = input.end?.let { checkMoment(it, "The end") }
        if (end != null && end.at < start.at) validation("The end must be after the start")
        val others = episodes.filter { it.id != episode.id }
        if (others.any { o -> o.started_at < (end?.at ?: Long.MAX_VALUE) && start.at < (o.ended_at ?: Long.MAX_VALUE) }) {
            validation("Episodes can't overlap")
        }
        if (end == null && !attack.logged_afterwards && others.any { it.started_at > start.at }) validation("Only the last episode can be ongoing")
        queries.updateEpisode(start.at, start.offset.toLong(), input.startUnknown, end?.at, end?.offset?.toLong(), episode.id)
        touch(attackId)
        get(attackId)
    }

    /** An attack keeps at least one episode; delete the attack instead. */
    fun deleteEpisode(attackId: Long, episodeId: Long): AttackDto = db.transactionWithResult {
        val episodes = snapshot().episodes[attackId] ?: notFound("Attack")
        if (episodes.none { it.id == episodeId }) notFound("Episode")
        if (episodes.size == 1) validation("An attack needs an episode; delete the attack instead")
        queries.deleteEpisode(episodeId)
        touch(attackId)
        get(attackId)
    }

    fun updateReading(attackId: Long, readingId: Long, input: ReadingInput): AttackDto = db.transactionWithResult {
        val readings = snapshot().readings[attackId].orEmpty()
        if (readings.none { it.id == readingId }) notFound("Reading")
        if (input.severity !in 0..3) validation("Severity is 0, 1, 2 or 3")
        val at = input.at?.let { checkMoment(it, "The reading") } ?: validation("A time is required")
        queries.updateReading(at.at, at.offset.toLong(), input.severity.toLong(), readingId)
        touch(attackId)
        get(attackId)
    }

    fun deleteReading(attackId: Long, readingId: Long): AttackDto = db.transactionWithResult {
        if (snapshot().readings[attackId].orEmpty().none { it.id == readingId }) notFound("Reading")
        queries.deleteReading(readingId)
        touch(attackId)
        get(attackId)
    }

    private fun insertAttack(loggedAfterwards: Boolean, status: AttackStatus, nausea: String? = null, painSide: String? = null, note: String? = null): Long {
        val time = now()
        queries.insertAttack(userId, loggedAfterwards, status.code(), nausea, painSide, note, time, time)
        return db.appUserQueries.lastInsertRowId().executeAsOne()
    }

    private fun touch(attackId: Long) = queries.touchAttack(now(), attackId, userId)

    private fun writeTriggers(attackId: Long, triggerIds: List<Long>) {
        val known = queries.selectTriggers(userId).executeAsList().map { it.id }.toSet()
        if (triggerIds.any { it !in known }) notFound("Trigger")
        queries.deleteAttackTriggers(attackId)
        triggerIds.forEach { queries.insertAttackTrigger(attackId, it) }
    }

    /** Times may be a little in the future (clock skew), not more. */
    private fun checkMoment(moment: Moment, what: String): Moment = checkMoment(moment, what, now())
}

internal const val MAX_FUTURE_MILLIS = 5 * 60_000L

internal fun checkMoment(moment: Moment, what: String, now: Long): Moment {
    if (moment.offset !in -18 * 60..18 * 60) validation("$what has an invalid UTC offset")
    if (moment.at > now + MAX_FUTURE_MILLIS) validation("$what can't be in the future")
    return moment
}
