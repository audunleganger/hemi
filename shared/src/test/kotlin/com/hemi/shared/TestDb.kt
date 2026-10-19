package com.hemi.shared

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.hemi.db.HemiDatabase
import com.hemi.shared.service.LocalUser
import java.util.Properties

/** A fresh in-memory database with one user ([locale]: English by default). */
class TestDb(locale: String = "en") {
    val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY, Properties().apply { put("foreign_keys", "true") })
        .also { HemiDatabase.Schema.create(it) }
    val db = HemiDatabase(driver)
    val userId = LocalUser.ensure(db, locale)
}
