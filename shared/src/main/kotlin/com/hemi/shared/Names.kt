package com.hemi.shared

import java.util.Locale

/**
 * Normalized form used for the uniqueness check on ingredient, medication and trigger names (IN-1, TR-1):
 * trimmed, inner whitespace collapsed, lowercased.
 */
fun normalizeName(name: String): String =
    name.trim().replace(Regex("\\s+"), " ").lowercase(Locale.ROOT)
