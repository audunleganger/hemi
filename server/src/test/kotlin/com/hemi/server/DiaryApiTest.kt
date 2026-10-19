package com.hemi.server

import com.hemi.shared.api.AdminUserCreate
import com.hemi.shared.api.AttackDto
import com.hemi.shared.api.AttackSummary
import com.hemi.shared.api.CalendarView
import com.hemi.shared.api.DayView
import com.hemi.shared.api.DiscardInput
import com.hemi.shared.api.DiscardResult
import com.hemi.shared.api.DoseDto
import com.hemi.shared.api.DoseInput
import com.hemi.shared.api.DosePreview
import com.hemi.shared.api.DosePreviewInput
import com.hemi.shared.api.ErrorCodes
import com.hemi.shared.api.ErrorResponse
import com.hemi.shared.api.FeedDto
import com.hemi.shared.api.HomeView
import com.hemi.shared.api.IngredientDto
import com.hemi.shared.api.IngredientInput
import com.hemi.shared.api.LimitInput
import com.hemi.shared.api.LoginInput
import com.hemi.shared.api.LoginResult
import com.hemi.shared.api.LogAfterwardsInput
import com.hemi.shared.api.MedicationDto
import com.hemi.shared.api.MedicationImageData
import com.hemi.shared.api.MedicationIngredientInput
import com.hemi.shared.api.MedicationInput
import com.hemi.shared.api.QuickDoseInput
import com.hemi.shared.api.RateInput
import com.hemi.shared.api.RatingSuggestion
import com.hemi.shared.api.ReadingInput
import com.hemi.shared.api.SettingsDto
import com.hemi.shared.api.SetupInput
import com.hemi.shared.api.StartAttackInput
import com.hemi.shared.api.StartAttackResult
import com.hemi.shared.api.TimeZoneInput
import com.hemi.shared.api.TriggerDto
import com.hemi.shared.api.WorkImpactInput
import com.hemi.shared.rules.LimitKind
import com.hemi.shared.rules.Moment
import com.hemi.shared.rules.Rating
import com.hemi.shared.rules.WorkImpact
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import java.nio.file.Files
import java.time.ZoneId
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** The diary API end to end, as the web app uses it. */
class DiaryApiTest {
    private val zone = ZoneId.of("Europe/Oslo")

    private fun ApplicationTestBuilder.jsonClient(): HttpClient {
        application { module(ServerConfig(dataDir = Files.createTempDirectory("hemi-api"), bcryptCost = 4)) }
        return createClient { install(ContentNegotiation) { json(apiJson) } }
    }

    private fun HttpRequestBuilder.json(body: Any) {
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun HttpClient.setup(): String {
        val token = post("/api/v1/setup") { json(SetupInput("admin", "correct horse", "en")) }.body<LoginResult>().token
        put("/api/v1/settings/time-zone") { bearerAuth(token); json(TimeZoneInput(zone.id)) }
        return token
    }

    private fun minutesAgo(minutes: Long) = Moment.of(System.currentTimeMillis() - minutes * 60_000, zone)

    @Test
    fun `log an attack with a dose, rate it, and see it everywhere`() = testApplication {
        val client = jsonClient()
        val token = client.setup()
        assertEquals(zone.id, client.get("/api/v1/settings") { bearerAuth(token) }.body<SettingsDto>().timeZone)
        assertEquals(6, client.get("/api/v1/triggers") { bearerAuth(token) }.body<List<TriggerDto>>().size)

        val ingredient: IngredientDto = client.post("/api/v1/ingredients") { bearerAuth(token); json(IngredientInput("Sumatriptan", "mg")) }.body()
        assertEquals(HttpStatusCode.Created, client.post("/api/v1/limits") { bearerAuth(token); json(LimitInput(ingredient.id, LimitKind.DOSES, 2.0, 24 * 60)) }.status)
        val medication: MedicationDto = client.post("/api/v1/medications") {
            bearerAuth(token)
            json(MedicationInput("Imigran", doseUnit = "spray", ingredients = listOf(MedicationIngredientInput(ingredient.id, 20.0))))
        }.body()

        // Start + usual medication, three hours ago (AT-1).
        val started: StartAttackResult = client.post("/api/v1/attacks/start") {
            bearerAuth(token)
            json(StartAttackInput(at = minutesAgo(180), severity = 3, dose = QuickDoseInput(medication.id)))
        }.body()
        val attackId = started.attack.summary.id
        val dose = assertNotNull(started.dose)

        val home: HomeView = client.get("/api/v1/home") { bearerAuth(token) }.body()
        assertEquals(attackId, home.ongoing?.summary?.id)
        assertEquals(dose.id, home.pendingRatings.single().dose.id)
        assertEquals(1.0, home.limits.single().used)
        assertEquals(1, home.acuteMedicationDays.count)
        assertEquals(medication.id, home.usualMedication?.id)

        // The second dose today is within the limit; a third would go over.
        val preview: DosePreview = client.post("/api/v1/doses/preview") { bearerAuth(token); json(DosePreviewInput(medication.id)) }.body()
        assertFalse(preview.over)
        assertEquals(2.0, preview.effects.single().after)

        assertEquals(Rating.RELIEVED, client.get("/api/v1/doses/${dose.id}/suggestion?severity=1") { bearerAuth(token) }.body<RatingSuggestion>().rating)
        val rated: DoseDto = client.post("/api/v1/doses/${dose.id}/rate") { bearerAuth(token); json(RateInput(Rating.RELIEVED, severity = 1)) }.body()
        assertEquals(Rating.RELIEVED, rated.rating)

        val ended: AttackDto = client.post("/api/v1/attacks/$attackId/readings") { bearerAuth(token); json(ReadingInput(severity = 0)) }.body()
        assertFalse(ended.summary.ongoing)
        assertEquals(listOf(3, 1, 0), ended.readings.map { it.severity })

        val list: List<AttackSummary> = client.get("/api/v1/attacks?status=migraine&peak=3") { bearerAuth(token) }.body()
        assertEquals(listOf(attackId), list.map { it.id })
        assertTrue(client.get("/api/v1/attacks?status=unsure") { bearerAuth(token) }.body<List<AttackSummary>>().isEmpty())

        val today = home.today
        val calendar: CalendarView = client.get("/api/v1/calendar?from=$today&to=$today") { bearerAuth(token) }.body()
        assertTrue(calendar.days.any { it.severity == 3 && it.medication })

        val day: DayView = client.get("/api/v1/days/${ended.summary.start.let { calendar.days.first().date }}") { bearerAuth(token) }.body()
        assertEquals(1, day.doses.size)
        val override: DayView = client.put("/api/v1/days/${day.date}/work-impact") { bearerAuth(token); json(WorkImpactInput(WorkImpact.MISSED)) }.body()
        assertEquals(WorkImpact.MISSED, override.workImpact?.effective)
    }

    @Test
    fun `starting a second attack while one is ongoing is refused`() = testApplication {
        val client = jsonClient()
        val token = client.setup()
        client.post("/api/v1/attacks/start") { bearerAuth(token); json(StartAttackInput()) }
        val again = client.post("/api/v1/attacks/start") { bearerAuth(token); json(StartAttackInput()) }
        assertEquals(HttpStatusCode.Conflict, again.status)
        assertEquals(ErrorCodes.ATTACK_ONGOING, again.body<ErrorResponse>().error)
    }

    @Test
    fun `discarding the ongoing attack undoes the start (AT-16)`() = testApplication {
        val client = jsonClient()
        val token = client.setup()
        val started: StartAttackResult = client.post("/api/v1/attacks/start") { bearerAuth(token); json(StartAttackInput()) }.body()
        val result: DiscardResult = client.post("/api/v1/attacks/${started.attack.summary.id}/discard") { bearerAuth(token); json(DiscardInput()) }.body()
        assertNull(result.restored)
        assertNull(client.get("/api/v1/home") { bearerAuth(token) }.body<HomeView>().ongoing)
        assertEquals(HttpStatusCode.NotFound, client.post("/api/v1/attacks/${started.attack.summary.id}/discard") { bearerAuth(token); json(DiscardInput()) }.status)
    }

    @Test
    fun `medications can have a photo (ME-8)`() = testApplication {
        val client = jsonClient()
        val token = client.setup()
        val medication: MedicationDto = client.post("/api/v1/medications") { bearerAuth(token); json(MedicationInput("Cold pack", doseUnit = "use")) }.body()
        val png = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
        val b64 = Base64.getEncoder().encodeToString(png)
        assertEquals(HttpStatusCode.BadRequest, client.put("/api/v1/medications/${medication.id}/image") { bearerAuth(token); json(MedicationImageData("image/jpeg", b64, b64)) }.status)
        val updated: MedicationDto = client.put("/api/v1/medications/${medication.id}/image") { bearerAuth(token); json(MedicationImageData("image/png", b64, b64)) }.body()
        val version = assertNotNull(updated.imageVersion)
        val image = client.get("/api/v1/medications/${medication.id}/image?v=$version&size=thumbnail") { bearerAuth(token) }
        assertEquals(HttpStatusCode.OK, image.status)
        assertTrue(image.headers["Cache-Control"]!!.contains("immutable"))
        assertEquals(null, client.delete("/api/v1/medications/${medication.id}/image") { bearerAuth(token) }.body<MedicationDto>().imageVersion)
    }

    @Test
    fun `the calendar feed is reachable by its secret only, and a new secret stops the old one (X-3)`() = testApplication {
        val client = jsonClient()
        val token = client.setup()
        client.post("/api/v1/attacks/afterwards") { bearerAuth(token); json(LogAfterwardsInput(start = minutesAgo(26 * 60), end = minutesAgo(20 * 60), peakSeverity = 2)) }
        client.post("/api/v1/attacks/afterwards") { bearerAuth(token); json(LogAfterwardsInput(start = minutesAgo(50 * 60))) }
        assertEquals(null, client.get("/api/v1/settings/feed") { bearerAuth(token) }.body<FeedDto>().token)

        val secret = assertNotNull(client.post("/api/v1/settings/feed") { bearerAuth(token) }.body<FeedDto>().token)
        val feed = client.get("/api/v1/feed/$secret.ics")
        assertEquals(HttpStatusCode.OK, feed.status)
        assertTrue(feed.headers["Content-Type"]!!.startsWith("text/calendar"))
        val text = feed.bodyAsText()
        assertTrue("SUMMARY:Migraine · severity 2" in text, text)
        assertTrue("DTSTART;VALUE=DATE:" in text, "an attack without an end is an all-day event")
        assertTrue(client.get("/api/v1/settings") { bearerAuth(token) }.body<SettingsDto>().calendarFeed)

        val renewed = client.post("/api/v1/settings/feed") { bearerAuth(token) }.body<FeedDto>().token
        assertEquals(HttpStatusCode.NotFound, client.get("/api/v1/feed/$secret.ics").status)
        assertEquals(HttpStatusCode.OK, client.get("/api/v1/feed/$renewed.ics").status)
        client.delete("/api/v1/settings/feed") { bearerAuth(token) }
        assertEquals(HttpStatusCode.NotFound, client.get("/api/v1/feed/$renewed.ics").status)
    }

    @Test
    fun `admins can't see other users' diaries (A-3)`() = testApplication {
        val client = jsonClient()
        val admin = client.setup()
        client.post("/api/v1/admin/users") { bearerAuth(admin); json(AdminUserCreate("kari", "passord123", locale = "nb")) }
        val kari = client.post("/api/v1/auth/login") { json(LoginInput("kari", "passord123")) }.body<LoginResult>().token
        val attack = client.post("/api/v1/attacks/start") { bearerAuth(kari); json(StartAttackInput()) }.body<StartAttackResult>().attack.summary.id
        assertEquals("Dårlig søvn", client.get("/api/v1/triggers") { bearerAuth(kari) }.body<List<TriggerDto>>().first().name)

        assertEquals(HttpStatusCode.NotFound, client.get("/api/v1/attacks/$attack") { bearerAuth(admin) }.status)
        assertTrue(client.get("/api/v1/attacks") { bearerAuth(admin) }.body<List<AttackSummary>>().isEmpty())
        assertEquals(null, client.get("/api/v1/home") { bearerAuth(admin) }.body<HomeView>().ongoing)
        // And nobody can log a dose of someone else's medication.
        val medication: MedicationDto = client.post("/api/v1/medications") { bearerAuth(kari); json(MedicationInput("Paracet", doseUnit = "tablett")) }.body()
        assertEquals(HttpStatusCode.NotFound, client.post("/api/v1/doses") { bearerAuth(admin); json(DoseInput(medication.id)) }.status)
    }
}
