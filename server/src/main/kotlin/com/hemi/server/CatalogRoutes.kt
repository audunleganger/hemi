package com.hemi.server

import com.hemi.shared.api.FeedDto
import com.hemi.shared.api.IngredientInput
import com.hemi.shared.api.LimitInput
import com.hemi.shared.api.MedicationImageData
import com.hemi.shared.api.MedicationInput
import com.hemi.shared.api.SettingsInput
import com.hemi.shared.api.TimeZoneInput
import com.hemi.shared.api.SymptomInput
import com.hemi.shared.api.SymptomOrderInput
import com.hemi.shared.api.TriggerInput
import com.hemi.shared.api.TriggerOrderInput
import com.hemi.shared.domain.notFound
import com.hemi.shared.service.IngredientService
import com.hemi.shared.service.LimitService
import com.hemi.shared.service.MedicationService
import com.hemi.shared.service.SettingsService
import com.hemi.shared.service.SymptomService
import com.hemi.shared.service.TriggerService
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondBytes
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route

/** Settings, ingredients, limits, medications, triggers and symptoms (S-*, IN-*, LI-*, ME-*, TR-*, WS-2). */
fun Route.catalogRoutes(database: Database, auth: Auth) {
    route("/settings") {
        get { call.respond(call.withUser(database, auth) { db, user -> SettingsService(db, user).get() }) }
        put {
            val input = call.receive<SettingsInput>()
            call.respond(call.withUser(database, auth) { db, user -> SettingsService(db, user).update(input) })
        }
        put("/time-zone") {
            val input = call.receive<TimeZoneInput>()
            call.respond(call.withUser(database, auth) { db, user -> SettingsService(db, user).setTimeZone(input.timeZone) })
        }
        // The calendar feed (X-3): its secret, a new one (the old URL stops working), or off.
        get("/feed") { call.respond(call.withUser(database, auth) { db, user -> FeedDto(SettingsService(db, user).feedToken()) }) }
        post("/feed") { call.respond(call.withUser(database, auth) { db, user -> FeedDto(SettingsService(db, user).newFeedToken()) }) }
        delete("/feed") {
            call.withUser(database, auth) { db, user -> SettingsService(db, user).disableFeed() }
            call.respond(HttpStatusCode.NoContent)
        }
    }

    route("/ingredients") {
        get {
            val all = call.flag("includeArchived")
            call.respond(call.withUser(database, auth) { db, user -> IngredientService(db, user).list(all) })
        }
        post {
            val input = call.receive<IngredientInput>()
            call.respond(HttpStatusCode.Created, call.withUser(database, auth) { db, user -> IngredientService(db, user).create(input) })
        }
        get("/{id}") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> IngredientService(db, user).get(id) })
        }
        put("/{id}") {
            val id = call.idParam()
            val input = call.receive<IngredientInput>()
            call.respond(call.withUser(database, auth) { db, user -> IngredientService(db, user).update(id, input) })
        }
        post("/{id}/archive") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> IngredientService(db, user).setArchived(id, true) })
        }
        post("/{id}/unarchive") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> IngredientService(db, user).setArchived(id, false) })
        }
        delete("/{id}") {
            val id = call.idParam()
            call.withUser(database, auth) { db, user -> IngredientService(db, user).delete(id) }
            call.respond(HttpStatusCode.NoContent)
        }
    }

    route("/limits") {
        post {
            val input = call.receive<LimitInput>()
            call.respond(HttpStatusCode.Created, call.withUser(database, auth) { db, user -> LimitService(db, user).create(input) })
        }
        put("/{id}") {
            val id = call.idParam()
            val input = call.receive<LimitInput>()
            call.respond(call.withUser(database, auth) { db, user -> LimitService(db, user).update(id, input) })
        }
        delete("/{id}") {
            val id = call.idParam()
            call.withUser(database, auth) { db, user -> LimitService(db, user).delete(id) }
            call.respond(HttpStatusCode.NoContent)
        }
    }

    route("/medications") {
        get {
            val all = call.flag("includeArchived")
            call.respond(call.withUser(database, auth) { db, user -> MedicationService(db, user).list(all) })
        }
        post {
            val input = call.receive<MedicationInput>()
            call.respond(HttpStatusCode.Created, call.withUser(database, auth) { db, user -> MedicationService(db, user).create(input) })
        }
        get("/{id}") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> MedicationService(db, user).get(id) })
        }
        put("/{id}") {
            val id = call.idParam()
            val input = call.receive<MedicationInput>()
            call.respond(call.withUser(database, auth) { db, user -> MedicationService(db, user).update(id, input) })
        }
        post("/{id}/archive") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> MedicationService(db, user).setArchived(id, true) })
        }
        post("/{id}/unarchive") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> MedicationService(db, user).setArchived(id, false) })
        }
        delete("/{id}") {
            val id = call.idParam()
            call.withUser(database, auth) { db, user -> MedicationService(db, user).delete(id) }
            call.respond(HttpStatusCode.NoContent)
        }
        // Photos (ME-8). With ?v=<imageVersion> the response never changes, so browsers may cache it for good.
        get("/{id}/image") {
            val id = call.idParam()
            val thumbnail = call.request.queryParameters["size"] == "thumbnail"
            val image = call.withUser(database, auth) { db, user -> MedicationService(db, user).image(id, thumbnail) } ?: notFound("Photo")
            val versioned = call.request.queryParameters["v"] == image.version.toString()
            call.response.header(HttpHeaders.CacheControl, if (versioned) "private, max-age=31536000, immutable" else "private, no-cache")
            call.respondBytes(image.bytes, ContentType.parse(image.contentType))
        }
        put("/{id}/image") {
            val id = call.idParam()
            val input = call.receive<MedicationImageData>()
            call.respond(call.withUser(database, auth) { db, user -> MedicationService(db, user).setImage(id, input) })
        }
        delete("/{id}/image") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> MedicationService(db, user).deleteImage(id) })
        }
    }

    route("/triggers") {
        get {
            val all = call.flag("includeArchived")
            call.respond(call.withUser(database, auth) { db, user -> TriggerService(db, user).list(all) })
        }
        post {
            val input = call.receive<TriggerInput>()
            call.respond(HttpStatusCode.Created, call.withUser(database, auth) { db, user -> TriggerService(db, user).create(input.name) })
        }
        put("/order") {
            val input = call.receive<TriggerOrderInput>()
            call.respond(call.withUser(database, auth) { db, user -> TriggerService(db, user).reorder(input) })
        }
        put("/{id}") {
            val id = call.idParam()
            val input = call.receive<TriggerInput>()
            call.respond(call.withUser(database, auth) { db, user -> TriggerService(db, user).rename(id, input.name) })
        }
        post("/{id}/archive") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> TriggerService(db, user).setArchived(id, true) })
        }
        post("/{id}/unarchive") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> TriggerService(db, user).setArchived(id, false) })
        }
        delete("/{id}") {
            val id = call.idParam()
            call.withUser(database, auth) { db, user -> TriggerService(db, user).delete(id) }
            call.respond(HttpStatusCode.NoContent)
        }
    }

    route("/symptoms") {
        get {
            val all = call.flag("includeArchived")
            call.respond(call.withUser(database, auth) { db, user -> SymptomService(db, user).list(all) })
        }
        post {
            val input = call.receive<SymptomInput>()
            call.respond(HttpStatusCode.Created, call.withUser(database, auth) { db, user -> SymptomService(db, user).create(input.name) })
        }
        put("/order") {
            val input = call.receive<SymptomOrderInput>()
            call.respond(call.withUser(database, auth) { db, user -> SymptomService(db, user).reorder(input) })
        }
        put("/{id}") {
            val id = call.idParam()
            val input = call.receive<SymptomInput>()
            call.respond(call.withUser(database, auth) { db, user -> SymptomService(db, user).rename(id, input.name) })
        }
        post("/{id}/archive") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> SymptomService(db, user).setArchived(id, true) })
        }
        post("/{id}/unarchive") {
            val id = call.idParam()
            call.respond(call.withUser(database, auth) { db, user -> SymptomService(db, user).setArchived(id, false) })
        }
        delete("/{id}") {
            val id = call.idParam()
            call.withUser(database, auth) { db, user -> SymptomService(db, user).delete(id) }
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
