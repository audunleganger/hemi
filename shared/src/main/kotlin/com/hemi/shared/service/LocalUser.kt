package com.hemi.shared.service

import com.hemi.db.HemiDatabase

/** The implicit single user of Android local mode (A-5). */
object LocalUser {
    const val USERNAME = "local"

    /** Returns the local user's id, creating it on first use. */
    fun ensure(db: HemiDatabase, locale: String?, now: Long = System.currentTimeMillis()): Long =
        db.transactionWithResult {
            db.appUserQueries.selectFirst().executeAsOneOrNull()?.id ?: run {
                db.appUserQueries.insertUser(USERNAME, null, true, locale, now)
                db.appUserQueries.lastInsertRowId().executeAsOne()
            }
        }
}
