package com.hemi.shared.domain

/** The user interface languages (L-1). */
object Languages {
    val SUPPORTED = listOf("en", "nb")

    /** Maps a locale ("nb-NO", "no", "en_US") to a language code; Norwegian variants become bokmål. */
    fun of(locale: String?): String? {
        val primary = locale?.trim()?.lowercase()?.split('-', '_', ',', ';')?.firstOrNull()?.takeIf { it.isNotEmpty() } ?: return null
        return if (primary == "no" || primary == "nn") "nb" else primary
    }

    fun isNorwegian(locale: String?): Boolean = of(locale) == "nb"
}
