package com.hemi.shared

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.hemi.db.HemiDatabase
import com.hemi.shared.api.SettingsInput
import com.hemi.shared.rules.Moment
import com.hemi.shared.rules.OSLO
import com.hemi.shared.rules.at
import com.hemi.shared.service.AttackService
import com.hemi.shared.service.DoseService
import com.hemi.shared.service.HomeService
import com.hemi.shared.service.IngredientService
import com.hemi.shared.service.LimitService
import com.hemi.shared.service.LocalUser
import com.hemi.shared.service.MedicationService
import com.hemi.shared.service.SettingsService
import com.hemi.shared.service.SignService
import com.hemi.shared.service.SymptomService
import com.hemi.shared.service.TriggerService
import java.util.Properties

/** A fresh in-memory database with one user ([locale]: English by default) in Oslo, and a clock the test sets. */
class TestDb(locale: String = "en") {
    val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY, Properties().apply { put("foreign_keys", "true") })
        .also { HemiDatabase.Schema.create(it) }
    val db = HemiDatabase(driver)
    val userId = LocalUser.ensure(db, locale)
    var clock: Long = at("2026-10-19T12:00").at

    init {
        SettingsService(db, userId).update(SettingsInput(timeZone = OSLO.id))
    }

    /** Sets the clock to a local Oslo time, e.g. "2026-10-19T14:00". */
    fun now(local: String): Moment = at(local).also { clock = it.at }

    private val time = { clock }
    fun attacks(user: Long = userId) = AttackService(db, user, time)
    fun doses(user: Long = userId) = DoseService(db, user, time)
    fun home(user: Long = userId) = HomeService(db, user, time)
    fun ingredients(user: Long = userId) = IngredientService(db, user, time)
    fun limits(user: Long = userId) = LimitService(db, user)
    fun medications(user: Long = userId) = MedicationService(db, user, time)
    fun triggers(user: Long = userId) = TriggerService(db, user)
    fun settings(user: Long = userId) = SettingsService(db, user)
    fun signs(user: Long = userId) = SignService(db, user, time)
    fun symptoms(user: Long = userId) = SymptomService(db, user)
}
