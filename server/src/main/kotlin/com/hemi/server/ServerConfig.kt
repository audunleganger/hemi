package com.hemi.server

import com.hemi.shared.AppInfo
import java.nio.file.Path
import kotlin.io.path.Path

/** Server configuration, read from environment variables (DEP-2). */
data class ServerConfig(
    val host: String = "0.0.0.0",
    val port: Int = 8080,
    val dataDir: Path = Path("data"),
    /** Directory with the built web GUI; when null the server only serves the API. */
    val webDir: Path? = null,
    val tokenLifetimeDays: Long = 30,
    val bcryptCost: Int = 12,
    /** Reported by `/api/health` (DEP-3). The Docker image sets it to the release or commit it was built from. */
    val version: String = AppInfo.VERSION,
) {
    companion object {
        fun fromEnv(env: Map<String, String> = System.getenv()) = ServerConfig(
            host = env["HEMI_HOST"] ?: "0.0.0.0",
            port = env["HEMI_PORT"]?.toInt() ?: 8080,
            dataDir = Path(env["HEMI_DATA_DIR"] ?: "data"),
            webDir = env["HEMI_WEB_DIR"]?.let(::Path),
            tokenLifetimeDays = env["HEMI_TOKEN_LIFETIME_DAYS"]?.toLong() ?: 30,
            version = env["HEMI_VERSION"]?.takeIf { it.isNotBlank() } ?: AppInfo.VERSION,
        )
    }
}
