package com.hemi.shared

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.hemi.db.HemiDatabase
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class SchemaTest {
    @Test
    fun `schema creates on an empty database`() {
        JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY).use { driver ->
            HemiDatabase.Schema.create(driver)
            val db = HemiDatabase(driver)
            assertEquals(0L, db.appUserQueries.countUsers().executeAsOne())
        }
    }
}

class MigrationTest {
    @Test
    fun `upgrading from 0_1_0 gives existing users the starter symptoms in their language (WS-2)`() {
        val file = kotlin.io.path.createTempFile("hemi", ".db").toFile()
        try {
            File("src/main/sqldelight/databases/1.db").copyTo(file, overwrite = true)
            JdbcSqliteDriver("jdbc:sqlite:${file.path}").use { driver ->
                driver.execute(null, "INSERT INTO app_user(username, locale, created_at) VALUES ('kari', 'nb-NO', 0), ('ola', NULL, 0)", 0)
                HemiDatabase.Schema.migrate(driver, 1, HemiDatabase.Schema.version)
                val db = HemiDatabase(driver)
                val users = db.appUserQueries.selectAll().executeAsList().associateBy { it.username }
                assertEquals("Lysømfintlighet", db.signsQueries.selectSymptoms(users.getValue("kari").id).executeAsList()[1].name)
                assertEquals("lysømfintlighet", db.signsQueries.selectSymptoms(users.getValue("kari").id).executeAsList()[1].name_norm)
                assertEquals(7, db.signsQueries.selectSymptoms(users.getValue("ola").id).executeAsList().size)
                assertEquals(12, users.getValue("ola").sign_window_hours)
            }
        } finally {
            file.delete()
        }
    }

    @Test
    fun `upgrading from v2 keeps episodes, with known ends (AT-6)`() {
        val file = kotlin.io.path.createTempFile("hemi", ".db").toFile()
        try {
            File("src/main/sqldelight/databases/2.db").copyTo(file, overwrite = true)
            JdbcSqliteDriver("jdbc:sqlite:${file.path}").use { driver ->
                driver.execute(null, "INSERT INTO app_user(username, created_at) VALUES ('ola', 0)", 0)
                driver.execute(null, "INSERT INTO attack(user_id, type, status, created_at, updated_at) VALUES (1, 'migraine', 'migraine', 0, 0)", 0)
                driver.execute(null, "INSERT INTO episode(attack_id, started_at, started_offset, ended_at, ended_offset) VALUES (1, 0, 0, 1, 0)", 0)
                HemiDatabase.Schema.migrate(driver, 2, HemiDatabase.Schema.version)
                assertFalse(HemiDatabase(driver).diaryQueries.selectEpisodes(1).executeAsList().single().end_unknown)
            }
        } finally {
            file.delete()
        }
    }
}
