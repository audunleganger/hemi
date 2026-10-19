package com.hemi.shared

import com.hemi.shared.api.ErrorCodes
import com.hemi.shared.api.IngredientInput
import com.hemi.shared.api.LimitInput
import com.hemi.shared.api.MedicationIngredientInput
import com.hemi.shared.api.MedicationInput
import com.hemi.shared.api.TriggerOrderInput
import com.hemi.shared.domain.AppException
import com.hemi.shared.rules.LimitKind
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/** Ingredients, medications, limits and triggers (IN-*, ME-*, LI-1 … LI-3, TR-*). */
class CatalogTest {
    @Test
    fun `a new user starts with starter triggers in their language and nothing else`() {
        assertEquals(listOf("Poor sleep", "Alcohol", "Stress", "Skipped meal", "Dehydration", "Screen time"), TestDb().triggers().list().map { it.name })
        val nb = TestDb("nb")
        assertEquals("Dårlig søvn", nb.triggers().list().first().name)
        assertTrue(nb.ingredients().list().isEmpty())
        assertTrue(nb.medications().list().isEmpty())
    }

    @Test
    fun `names are unique per user, ignoring case and spaces`() {
        val t = TestDb()
        t.ingredients().create(IngredientInput("Sumatriptan", "mg"))
        val e = assertFailsWith<AppException> { t.ingredients().create(IngredientInput("  sumatriptan ", "mg")) }
        assertEquals(ErrorCodes.NAME_TAKEN, e.code)
        assertFailsWith<AppException> { t.triggers().create("stress") }
    }

    @Test
    fun `a medication contains ingredients with an amount per unit, or none as a remedy`() {
        val t = TestDb()
        val paracetamol = t.ingredients().create(IngredientInput("Paracetamol", "mg"))
        val codeine = t.ingredients().create(IngredientInput("Codeine", "mg"))
        val pinex = t.medications().create(
            MedicationInput("Pinex Forte", doseUnit = "tablet", doseUnitPlural = "tablets", defaultQuantity = 2.0,
                ingredients = listOf(MedicationIngredientInput(paracetamol.id, 500.0), MedicationIngredientInput(codeine.id, 30.0))),
        )
        assertEquals(listOf("Codeine", "Paracetamol"), pinex.ingredients.map { it.ingredientName })
        assertEquals(120, pinex.effectiveFollowUpMinutes)
        val coldPack = t.medications().create(MedicationInput("Cold pack", doseUnit = "use", followUpMinutes = 30))
        assertTrue(coldPack.isRemedy)
        assertEquals(30, coldPack.effectiveFollowUpMinutes)
        assertEquals(listOf(pinex.id), t.ingredients().get(codeine.id).medicationIds)
    }

    @Test
    fun `ingredients in a medication and medications with doses can't be deleted, only archived`() {
        val t = TestDb()
        val ingredient = t.ingredients().create(IngredientInput("Sumatriptan", "mg"))
        val medication = t.medications().create(MedicationInput("Imigran", doseUnit = "tablet", ingredients = listOf(MedicationIngredientInput(ingredient.id, 50.0))))
        assertEquals(ErrorCodes.REFERENCED, assertFailsWith<AppException> { t.ingredients().delete(ingredient.id) }.code)
        t.doses().create(com.hemi.shared.api.DoseInput(medication.id))
        assertEquals(mapOf("doses" to 1L), assertFailsWith<AppException> { t.medications().delete(medication.id) }.details)
        assertTrue(t.ingredients().setArchived(ingredient.id, true).archived)
        assertEquals(emptyList(), t.ingredients().list().map { it.id })
    }

    @Test
    fun `limits need a positive maximum and window, whole numbers for counts`() {
        val t = TestDb()
        val ingredient = t.ingredients().create(IngredientInput("Sumatriptan", "mg"))
        assertFailsWith<AppException> { t.limits().create(LimitInput(ingredient.id, LimitKind.DAYS, 0.0, 30 * 24 * 60)) }
        assertFailsWith<AppException> { t.limits().create(LimitInput(ingredient.id, LimitKind.DOSES, 1.5, 24 * 60)) }
        assertFailsWith<AppException> { t.limits().create(LimitInput(ingredient.id, LimitKind.AMOUNT, 100.0, 0)) }
        val interval = t.limits().create(LimitInput(ingredient.id, LimitKind.MIN_INTERVAL, 99.0, 120))
        assertEquals(0.0, interval.maxValue)
        assertEquals(1, t.ingredients().get(ingredient.id).limits.size)
    }

    @Test
    fun `triggers keep the user's order, and deleting one removes it from attacks`() {
        val t = TestDb()
        val triggers = t.triggers().list()
        t.triggers().reorder(TriggerOrderInput(triggers.map { it.id }.reversed()))
        assertEquals("Screen time", t.triggers().list().first().name)
        val attack = t.attacks().start(com.hemi.shared.api.StartAttackInput()).attack
        t.attacks().update(attack.summary.id, com.hemi.shared.api.AttackUpdate(com.hemi.shared.api.AttackStatus.MIGRAINE, triggerIds = listOf(triggers[0].id)))
        assertEquals(1, t.triggers().get(triggers[0].id).attackCount)
        t.triggers().delete(triggers[0].id)
        assertEquals(emptyList(), t.attacks().get(attack.summary.id).summary.triggerIds)
    }
}
