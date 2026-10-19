package com.hemi.server

import com.hemi.shared.api.AttackStatus
import com.hemi.shared.api.AttackUpdate
import com.hemi.shared.api.DoseInput
import com.hemi.shared.api.DosePreviewInput
import com.hemi.shared.api.EndInput
import com.hemi.shared.api.EpisodeInput
import com.hemi.shared.api.LogAfterwardsInput
import com.hemi.shared.api.RateInput
import com.hemi.shared.api.ReadingInput
import com.hemi.shared.api.StartAttackInput
import com.hemi.shared.api.WorkImpactInput
import com.hemi.shared.api.enumOfCode
import com.hemi.shared.domain.parseDate
import com.hemi.shared.domain.validation
import com.hemi.shared.service.AttackFilter
import com.hemi.shared.service.AttackService
import com.hemi.shared.service.DoseFilter
import com.hemi.shared.service.DoseService
import com.hemi.shared.service.HomeService
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route

/** The front page, calendar and days, attacks and doses (V-*, AT-*, DO-*, WI-*). */
fun Route.diaryRoutes(database: Database, auth: Auth) {
    get("/home") { call.respond(call.withUser(database, auth) { db, user -> HomeService(db, user).home() }) }

    get("/calendar") {
        val from = call.request.queryParameters["from"] ?: validation("'from' is required")
        val to = call.request.queryParameters["to"] ?: validation("'to' is required")
        val unsure = call.flag("includeUnsure")
        call.respond(call.withUser(database, auth) { db, user -> HomeService(db, user).calendar(from, to, unsure) })
    }

    route("/days/{date}") {
        get {
            val date = call.parameters["date"]!!
            call.respond(call.withUser(database, auth) { db, user -> HomeService(db, user).day(date) })
        }
        put("/work-impact") {
            val date = call.parameters["date"]!!
            val input = call.receive<WorkImpactInput>()
            call.respond(call.withUser(database, auth) { db, user -> HomeService(db, user).setWorkImpact(date, input.impact) })
        }
    }

    route("/attacks") {
        get {
            val filter = call.attackFilter()
            call.respond(call.withUser(database, auth) { db, user -> AttackService(db, user).list(filter) })
        }
        post("/start") {
            val input = call.receive<StartAttackInput>()
            call.respond(HttpStatusCode.Created, call.withUser(database, auth) { db, user -> AttackService(db, user).start(input) })
        }
        post("/afterwards") {
            val input = call.receive<LogAfterwardsInput>()
            call.respond(HttpStatusCode.Created, call.withUser(database, auth) { db, user -> AttackService(db, user).logAfterwards(input) })
        }
        get("/{id}") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> AttackService(db, user).get(id) })
        }
        put("/{id}") {
            val id = call.idParam()
            val input = call.receive<AttackUpdate>()
            call.respond(call.withUser(database, auth) { db, user -> AttackService(db, user).update(id, input) })
        }
        delete("/{id}") {
            val id = call.idParam()
            call.withUser(database, auth) { db, user -> AttackService(db, user).delete(id) }
            call.respond(HttpStatusCode.NoContent)
        }
        post("/{id}/end") {
            val id = call.idParam()
            val input = call.receive<EndInput>()
            call.respond(call.withUser(database, auth) { db, user -> AttackService(db, user).end(id, input) })
        }
        post("/{id}/readings") {
            val id = call.idParam()
            val input = call.receive<ReadingInput>()
            call.respond(HttpStatusCode.Created, call.withUser(database, auth) { db, user -> AttackService(db, user).addReading(id, input) })
        }
        put("/{id}/readings/{readingId}") {
            val id = call.idParam()
            val readingId = call.idParam("readingId")
            val input = call.receive<ReadingInput>()
            call.respond(call.withUser(database, auth) { db, user -> AttackService(db, user).updateReading(id, readingId, input) })
        }
        delete("/{id}/readings/{readingId}") {
            val id = call.idParam()
            val readingId = call.idParam("readingId")
            call.respond(call.withUser(database, auth) { db, user -> AttackService(db, user).deleteReading(id, readingId) })
        }
        put("/{id}/episodes/{episodeId}") {
            val id = call.idParam()
            val episodeId = call.idParam("episodeId")
            val input = call.receive<EpisodeInput>()
            call.respond(call.withUser(database, auth) { db, user -> AttackService(db, user).updateEpisode(id, episodeId, input) })
        }
        delete("/{id}/episodes/{episodeId}") {
            val id = call.idParam()
            val episodeId = call.idParam("episodeId")
            call.respond(call.withUser(database, auth) { db, user -> AttackService(db, user).deleteEpisode(id, episodeId) })
        }
        // Undo a recurrence (AT-7): the episode becomes its own attack, which is returned.
        post("/{id}/episodes/{episodeId}/split") {
            val id = call.idParam()
            val episodeId = call.idParam("episodeId")
            call.respond(call.withUser(database, auth) { db, user -> AttackService(db, user).split(id, episodeId) })
        }
    }

    route("/doses") {
        get {
            val filter = call.doseFilter()
            call.respond(call.withUser(database, auth) { db, user -> DoseService(db, user).list(filter) })
        }
        post {
            val input = call.receive<DoseInput>()
            call.respond(HttpStatusCode.Created, call.withUser(database, auth) { db, user -> DoseService(db, user).create(input) })
        }
        post("/preview") {
            val input = call.receive<DosePreviewInput>()
            call.respond(call.withUser(database, auth) { db, user -> DoseService(db, user).preview(input) })
        }
        get("/{id}") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> DoseService(db, user).get(id) })
        }
        put("/{id}") {
            val id = call.idParam()
            val input = call.receive<DoseInput>()
            call.respond(call.withUser(database, auth) { db, user -> DoseService(db, user).update(id, input) })
        }
        delete("/{id}") {
            val id = call.idParam()
            call.withUser(database, auth) { db, user -> DoseService(db, user).delete(id) }
            call.respond(HttpStatusCode.NoContent)
        }
        post("/{id}/rate") {
            val id = call.idParam()
            val input = call.receive<RateInput>()
            call.respond(call.withUser(database, auth) { db, user -> DoseService(db, user).rate(id, input) })
        }
        post("/{id}/dismiss") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> DoseService(db, user).dismiss(id) })
        }
        get("/{id}/suggestion") {
            val id = call.idParam()
            val severity = call.request.queryParameters["severity"]?.toIntOrNull() ?: validation("'severity' is required")
            call.respond(call.withUser(database, auth) { db, user -> DoseService(db, user).suggestion(id, severity) })
        }
    }
}

private fun ApplicationCall.date(name: String) = request.queryParameters[name]?.let(::parseDate)

private fun ApplicationCall.long(name: String) = request.queryParameters[name]?.let { it.toLongOrNull() ?: validation("'$name' must be a number") }

private fun ApplicationCall.optionalFlag(name: String): Boolean? = request.queryParameters[name]?.lowercase()?.let { it in setOf("true", "1", "yes") }

/** ?status=migraine,unsure&peak=3&triggerId=&medicationId=&from=YYYY-MM-DD&to=YYYY-MM-DD (V-4). */
private fun ApplicationCall.attackFilter() = AttackFilter(
    statuses = request.queryParameters["status"]?.split(',')?.filter { it.isNotBlank() }?.mapTo(HashSet()) { enumOfCode<AttackStatus>(it.trim()) },
    peak = request.queryParameters["peak"]?.let { it.toIntOrNull() ?: validation("'peak' must be 0–3") },
    triggerId = long("triggerId"),
    medicationId = long("medicationId"),
    from = date("from"),
    to = date("to"),
)

/** ?medicationId=&ingredientId=&rated=true|false&withAttack=true|false&from=&to= (V-6). */
private fun ApplicationCall.doseFilter() = DoseFilter(
    medicationId = long("medicationId"),
    ingredientId = long("ingredientId"),
    rated = optionalFlag("rated"),
    withAttack = optionalFlag("withAttack"),
    from = date("from"),
    to = date("to"),
)
