package com.hemi.server

import com.hemi.shared.domain.notFound
import com.hemi.shared.service.CalendarFeed
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.server.response.header
import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/**
 * The calendar feed (X-3), for calendar apps that can't log in: the secret in the URL is the only key. A new
 * secret, or turning the feed off, makes old URLs 404.
 */
fun Route.feedRoutes(database: Database) {
    get("/feed/{file}") {
        val token = call.parameters["file"]?.removeSuffix(".ics")?.takeIf { it.length >= 32 } ?: notFound("Feed")
        val body = database.run { db ->
            val user = db.appUserQueries.selectByIcsToken(token).executeAsOneOrNull() ?: notFound("Feed")
            CalendarFeed(db, user.id).render()
        }
        call.response.header(HttpHeaders.CacheControl, "private, no-cache")
        call.respondText(body, ContentType.parse("text/calendar; charset=utf-8"))
    }
}
