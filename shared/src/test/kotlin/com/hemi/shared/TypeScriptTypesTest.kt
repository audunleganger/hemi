package com.hemi.shared

import com.hemi.shared.api.AdminUserCreate
import com.hemi.shared.api.AdminUserUpdate
import com.hemi.shared.api.BackupResult
import com.hemi.shared.api.ErrorCodes
import com.hemi.shared.api.ErrorResponse
import com.hemi.shared.api.HealthResponse
import com.hemi.shared.api.LocaleInput
import com.hemi.shared.api.LoginInput
import com.hemi.shared.api.LoginResult
import com.hemi.shared.api.PasswordChangeInput
import com.hemi.shared.api.SetupInput
import com.hemi.shared.api.SetupStatus
import com.hemi.shared.api.UserDto
import kotlinx.serialization.descriptors.PolymorphicKind
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.SerialKind
import kotlinx.serialization.descriptors.StructureKind
import kotlinx.serialization.serializer
import java.io.File
import java.lang.reflect.Modifier
import kotlin.test.Test
import kotlin.test.assertEquals

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
