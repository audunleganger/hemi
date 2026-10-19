package com.hemi.server

import com.hemi.shared.api.AdminUserCreate
import com.hemi.shared.api.AdminUserUpdate
import com.hemi.shared.api.ErrorCodes
import com.hemi.shared.api.ErrorResponse
import com.hemi.shared.api.LoginInput
import com.hemi.shared.api.LoginResult
import com.hemi.shared.api.PasswordChangeInput
import com.hemi.shared.api.SetupInput
import com.hemi.shared.api.SetupStatus
import com.hemi.shared.api.UserDto
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** First-run setup, sessions and user management (A-2 … A-4). */
class AccountTest {
    private fun ApplicationTestBuilder.jsonClient(): HttpClient {
        application { module(ServerConfig(dataDir = Files.createTempDirectory("hemi-api"), bcryptCost = 4)) }
        return createClient { install(ContentNegotiation) { json(apiJson) } }
    }

    private fun HttpRequestBuilder.json(body: Any) {
        contentType(ContentType.Application.Json)
        setBody(body)
    }

    private suspend fun HttpResponse.error(): ErrorResponse = body()

    private suspend fun HttpClient.setup(): String {
        val result: LoginResult = post("/api/v1/setup") { json(SetupInput("admin", "correct horse", "en")) }.body()
        assertTrue(result.user.isAdmin)
        return result.token
    }

    @Test
    fun `first-run setup works once`() = testApplication {
        val client = jsonClient()
        assertEquals(true, client.get("/api/v1/setup").body<SetupStatus>().needsSetup)
        client.setup()
        assertEquals(false, client.get("/api/v1/setup").body<SetupStatus>().needsSetup)
        val again = client.post("/api/v1/setup") { json(SetupInput("evil", "password123")) }
        assertEquals(HttpStatusCode.Conflict, again.status)
        assertEquals(ErrorCodes.SETUP_DONE, again.error().error)
    }

    @Test
    fun `long multi-byte passwords are rejected cleanly, not with a 500`() = testApplication {
        val client = jsonClient()
        val long = "æøå".repeat(20) // 60 characters, 120 bytes
        val setup = client.post("/api/v1/setup") { json(SetupInput("admin", long)) }
        assertEquals(HttpStatusCode.BadRequest, setup.status)
        assertEquals(ErrorCodes.WEAK_PASSWORD, setup.error().error)
        client.setup()
        val login = client.post("/api/v1/auth/login") { json(LoginInput("admin", long)) }
        assertEquals(HttpStatusCode.Unauthorized, login.status)
    }

    @Test
    fun `endpoints require a session`() = testApplication {
        val client = jsonClient()
        client.setup()
        val response = client.get("/api/v1/me")
        assertEquals(HttpStatusCode.Unauthorized, response.status)
        assertEquals(ErrorCodes.UNAUTHORIZED, response.error().error)
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/v1/me") { bearerAuth("bogus") }.status)
    }

    @Test
    fun `login, logout and password change`() = testApplication {
        val client = jsonClient()
        client.setup()
        val bad = client.post("/api/v1/auth/login") { json(LoginInput("admin", "wrong password")) }
        assertEquals(HttpStatusCode.Unauthorized, bad.status)
        assertEquals(ErrorCodes.INVALID_CREDENTIALS, bad.error().error)

        val token = client.post("/api/v1/auth/login") { json(LoginInput("ADMIN", "correct horse")) }.body<LoginResult>().token
        assertEquals("admin", client.get("/api/v1/me") { bearerAuth(token) }.body<UserDto>().username)

        val weak = client.put("/api/v1/me/password") { bearerAuth(token); json(PasswordChangeInput("correct horse", "short")) }
        assertEquals(ErrorCodes.WEAK_PASSWORD, weak.error().error)
        assertEquals(
            HttpStatusCode.NoContent,
            client.put("/api/v1/me/password") { bearerAuth(token); json(PasswordChangeInput("correct horse", "battery staple")) }.status,
        )
        assertEquals(HttpStatusCode.OK, client.post("/api/v1/auth/login") { json(LoginInput("admin", "battery staple")) }.status)

        client.post("/api/v1/auth/logout") { bearerAuth(token) }
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/v1/me") { bearerAuth(token) }.status)
    }

    @Test
    fun `admin manages users`() = testApplication {
        val client = jsonClient()
        val admin = client.setup()
        val created = client.post("/api/v1/admin/users") { bearerAuth(admin); json(AdminUserCreate("kari", "passord123", locale = "nb")) }
        assertEquals(HttpStatusCode.Created, created.status)
        val kari = created.body<UserDto>()

        val kariToken = client.post("/api/v1/auth/login") { json(LoginInput("kari", "passord123")) }.body<LoginResult>().token
        // Non-admins can't manage users
        assertEquals(HttpStatusCode.Forbidden, client.get("/api/v1/admin/users") { bearerAuth(kariToken) }.status)

        // The last admin can't be demoted
        val adminUser = client.get("/api/v1/me") { bearerAuth(admin) }.body<UserDto>()
        val demote = client.patch("/api/v1/admin/users/${adminUser.id}") { bearerAuth(admin); json(AdminUserUpdate(isAdmin = false)) }
        assertEquals(ErrorCodes.LAST_ADMIN, demote.error().error)

        // Disabling a user ends their sessions
        client.patch("/api/v1/admin/users/${kari.id}") { bearerAuth(admin); json(AdminUserUpdate(isDisabled = true)) }
        assertEquals(HttpStatusCode.Unauthorized, client.get("/api/v1/me") { bearerAuth(kariToken) }.status)
        assertEquals(HttpStatusCode.Unauthorized, client.post("/api/v1/auth/login") { json(LoginInput("kari", "passord123")) }.status)

        // Password reset by admin
        client.patch("/api/v1/admin/users/${kari.id}") { bearerAuth(admin); json(AdminUserUpdate(isDisabled = false, password = "nytt passord")) }
        assertEquals(HttpStatusCode.OK, client.post("/api/v1/auth/login") { json(LoginInput("kari", "nytt passord")) }.status)

        assertEquals(HttpStatusCode.OK, client.post("/api/v1/admin/backup") { bearerAuth(admin) }.status)
    }
}
