package com.hemi.shared

import com.hemi.shared.api.AcuteMedicationDays
import com.hemi.shared.api.AdminUserCreate
import com.hemi.shared.api.AdminUserUpdate
import com.hemi.shared.api.AttackDto
import com.hemi.shared.api.AttackSummary
import com.hemi.shared.api.AttackUpdate
import com.hemi.shared.api.BackupResult
import com.hemi.shared.api.CalendarView
import com.hemi.shared.api.DayView
import com.hemi.shared.api.DoseDto
import com.hemi.shared.api.DoseInput
import com.hemi.shared.api.DosePreview
import com.hemi.shared.api.DosePreviewInput
import com.hemi.shared.api.EndInput
import com.hemi.shared.api.EpisodeInput
import com.hemi.shared.api.ErrorCodes
import com.hemi.shared.api.ErrorResponse
import com.hemi.shared.api.FeedDto
import com.hemi.shared.api.HealthResponse
import com.hemi.shared.api.HomeView
import com.hemi.shared.api.IngredientDto
import com.hemi.shared.api.IngredientInput
import com.hemi.shared.api.LimitDto
import com.hemi.shared.api.LimitInput
import com.hemi.shared.api.LimitStatusDto
import com.hemi.shared.api.LocaleInput
import com.hemi.shared.api.LogAfterwardsInput
import com.hemi.shared.api.LoginInput
import com.hemi.shared.api.LoginResult
import com.hemi.shared.api.MedicationDto
import com.hemi.shared.api.MedicationImageData
import com.hemi.shared.api.MedicationInput
import com.hemi.shared.api.PasswordChangeInput
import com.hemi.shared.api.PendingRating
import com.hemi.shared.api.RateInput
import com.hemi.shared.api.RatingSuggestion
import com.hemi.shared.api.ReadingInput
import com.hemi.shared.api.SettingsDto
import com.hemi.shared.api.SettingsInput
import com.hemi.shared.api.SetupInput
import com.hemi.shared.api.SetupStatus
import com.hemi.shared.api.StartAttackInput
import com.hemi.shared.api.StartAttackResult
import com.hemi.shared.api.TimeZoneInput
import com.hemi.shared.api.TriggerDto
import com.hemi.shared.api.TriggerInput
import com.hemi.shared.api.TriggerOrderInput
import com.hemi.shared.api.UserDto
import com.hemi.shared.api.WorkImpactInput
import java.io.File
import java.lang.reflect.Modifier
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlinx.serialization.descriptors.PolymorphicKind
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.SerialKind
import kotlinx.serialization.descriptors.StructureKind
import kotlinx.serialization.serializer

/**
 * Generates web/src/api/types.gen.ts from the Kotlin API types, and fails when the checked-in file is stale.
 * Regenerate with: ./gradlew :shared:test -PupdateTsTypes=true
 */
class TypeScriptTypesTest {
    private val roots: List<SerialDescriptor> = listOf(
        serializer<HealthResponse>(), serializer<ErrorResponse>(),
        serializer<SetupStatus>(), serializer<SetupInput>(), serializer<LoginInput>(), serializer<LoginResult>(),
        serializer<UserDto>(), serializer<PasswordChangeInput>(), serializer<LocaleInput>(),
        serializer<AdminUserCreate>(), serializer<AdminUserUpdate>(), serializer<BackupResult>(),
        serializer<SettingsDto>(), serializer<SettingsInput>(), serializer<TimeZoneInput>(), serializer<FeedDto>(),
        serializer<IngredientInput>(), serializer<IngredientDto>(), serializer<LimitInput>(), serializer<LimitDto>(), serializer<LimitStatusDto>(),
        serializer<MedicationInput>(), serializer<MedicationDto>(), serializer<MedicationImageData>(),
        serializer<TriggerInput>(), serializer<TriggerDto>(), serializer<TriggerOrderInput>(),
        serializer<AttackSummary>(), serializer<AttackDto>(), serializer<AttackUpdate>(), serializer<StartAttackInput>(), serializer<StartAttackResult>(),
        serializer<ReadingInput>(), serializer<EndInput>(), serializer<EpisodeInput>(), serializer<LogAfterwardsInput>(),
        serializer<DoseInput>(), serializer<DoseDto>(), serializer<DosePreviewInput>(), serializer<DosePreview>(), serializer<RateInput>(), serializer<RatingSuggestion>(),
        serializer<HomeView>(), serializer<PendingRating>(), serializer<AcuteMedicationDays>(), serializer<CalendarView>(), serializer<DayView>(), serializer<WorkImpactInput>(),
    ).map { it.descriptor }

    @Test
    fun `generated TypeScript types are up to date`() {
        val file = File("../web/src/api/types.gen.ts")
        val expected = generate()
        if (System.getProperty("updateTsTypes") == "true") {
            file.writeText(expected)
        }
        assertEquals(expected, file.takeIf { it.exists() }?.readText(), "types.gen.ts is stale; run ./gradlew :shared:test -PupdateTsTypes=true")
    }

    private fun generate(): String {
        val declarations = LinkedHashMap<String, String>()
        roots.forEach { reference(it, declarations) }
        val errorCodes = ErrorCodes::class.java.declaredFields
            .filter { Modifier.isStatic(it.modifiers) && it.type == String::class.java }
            .joinToString("\n") { "  ${it.name}: '${it.get(null)}'," }
        return buildString {
            appendLine("// Generated from the Kotlin API types in shared/ by TypeScriptTypesTest. Do not edit.")
            appendLine("// Regenerate: ./gradlew :shared:test -PupdateTsTypes=true")
            appendLine()
            appendLine("export const API_VERSION = ${AppInfo.API_VERSION}")
            appendLine()
            appendLine("export const ErrorCodes = {")
            appendLine(errorCodes)
            appendLine("} as const")
            appendLine()
            appendLine("export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]")
            appendLine()
            declarations.toSortedMap().values.forEach { appendLine(); append(it) }
        }
    }

    private fun typeName(descriptor: SerialDescriptor) = descriptor.serialName.removeSuffix("?").substringAfterLast('.')

    /** Returns the TypeScript type expression for [descriptor], declaring named types as needed. */
    private fun reference(descriptor: SerialDescriptor, declarations: MutableMap<String, String>): String {
        val base = when (val kind = descriptor.kind) {
            PrimitiveKind.STRING, PrimitiveKind.CHAR -> "string"
            PrimitiveKind.BOOLEAN -> "boolean"
            is PrimitiveKind -> "number"
            SerialKind.ENUM -> {
                val name = typeName(descriptor)
                if (name !in declarations) {
                    declarations[name] = "export type $name = " +
                        (0 until descriptor.elementsCount).joinToString(" | ") { "'${descriptor.getElementName(it)}'" } + "\n"
                }
                name
            }
            StructureKind.LIST -> {
                val element = reference(descriptor.getElementDescriptor(0), declarations)
                if (element.contains(' ')) "($element)[]" else "$element[]"
            }
            StructureKind.MAP -> "Record<string, ${reference(descriptor.getElementDescriptor(1), declarations)}>"
            StructureKind.CLASS, StructureKind.OBJECT -> {
                val name = typeName(descriptor)
                if (name !in declarations) {
                    declarations[name] = "" // placeholder against recursion
                    val fields = (0 until descriptor.elementsCount).joinToString("") { i ->
                        val optional = if (descriptor.isElementOptional(i)) "?" else ""
                        "  ${descriptor.getElementName(i)}$optional: ${reference(descriptor.getElementDescriptor(i), declarations)}\n"
                    }
                    declarations[name] = "export interface $name {\n$fields}\n"
                }
                name
            }
            is PolymorphicKind, SerialKind.CONTEXTUAL -> error("Unsupported kind $kind in ${descriptor.serialName}")
        }
        return if (descriptor.isNullable) "$base | null" else base
    }
}
