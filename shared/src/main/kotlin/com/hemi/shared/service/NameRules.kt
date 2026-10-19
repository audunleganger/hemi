package com.hemi.shared.service

import com.hemi.shared.api.ErrorCodes
import com.hemi.shared.domain.AppException
import com.hemi.shared.domain.cleanName
import com.hemi.shared.normalizeName

/** Names are unique per user, compared case-insensitively after trimming (IN-1, TR-1). */
internal object NameRules {
    /** Cleans [name], failing with NAME_TAKEN if another of [taken] (id to normalized name) has it. */
    fun cleanUnique(name: String, selfId: Long?, taken: Map<Long, String>, what: String): String {
        val clean = cleanName(name)
        val norm = normalizeName(clean)
        val clash = taken.entries.firstOrNull { it.key != selfId && it.value == norm }
        if (clash != null) throw AppException(ErrorCodes.NAME_TAKEN, "A $what named '$clean' already exists", 409, mapOf("id" to clash.key))
        return clean
    }
}
