package com.hemi.shared

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.hemi.db.HemiDatabase
import kotlin.test.Test
import kotlin.test.assertEquals

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
