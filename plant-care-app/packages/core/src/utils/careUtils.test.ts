/**
 * Feature: plant-care-app
 * Property 12: Plantas con tareas vencidas
 *
 * Para cualquier fecha y colección de plantas, la función getDuePlants(date, plants)
 * debe devolver exactamente las plantas cuya nextCareDate para alguna tarea sea
 * menor o igual a date, sin incluir plantas sin tareas vencidas.
 *
 * Valida: Requisito 6.1
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { Plant, CareSchedule, NextCareDates, PlantLocation } from '../models/plant'
import { getDuePlants } from './careUtils'

// ---------------------------------------------------------------------------
// Generadores
// ---------------------------------------------------------------------------

const locationArb: fc.Arbitrary<PlantLocation> = fc.constantFrom('interior', 'exterior')

const isoDateArb: fc.Arbitrary<string> = fc
    .date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') })
    .map((d) => d.toISOString().slice(0, 10))

const isoTimestampArb: fc.Arbitrary<string> = fc.date().map((d) => d.toISOString())

const careScheduleArb: fc.Arbitrary<CareSchedule> = fc.record(
    {
        wateringFrequencyDays: fc.integer({ min: 1, max: 365 }),
        fertilizingFrequencyDays: fc.integer({ min: 1, max: 365 }),
        fertilizerType: fc.string({ minLength: 1, maxLength: 50 }),
        lightNeeds: fc.constantFrom('directa', 'indirecta', 'sombra'),
        temperatureMinC: fc.float({ min: -10, max: 20, noNaN: true }),
        temperatureMaxC: fc.float({ min: 20, max: 50, noNaN: true }),
        pruningFrequencyMonths: fc.integer({ min: 1, max: 24 }),
        repottingFrequencyMonths: fc.integer({ min: 1, max: 48 }),
    },
    { requiredKeys: [] },
)

const nextCareDatesArb: fc.Arbitrary<NextCareDates> = fc.record(
    {
        watering: isoDateArb,
        fertilizing: isoDateArb,
        pruning: isoDateArb,
        repotting: isoDateArb,
    },
    { requiredKeys: [] },
)

const plantGen: fc.Arbitrary<Plant> = fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    commonName: fc.string({ minLength: 1, maxLength: 100 }),
    species: fc.string({ minLength: 1, maxLength: 100 }),
    scientificName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    acquisitionDate: fc.option(isoDateArb, { nil: undefined }),
    location: fc.option(locationArb, { nil: undefined }),
    notes: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
    representativePhotoUrl: fc.option(fc.webUrl(), { nil: undefined }),
    careSchedule: careScheduleArb,
    nextCareDates: nextCareDatesArb,
    createdAt: isoTimestampArb,
    updatedAt: isoTimestampArb,
})

// ---------------------------------------------------------------------------
// Helper: determina si una planta tiene alguna tarea vencida para una fecha
// ---------------------------------------------------------------------------

function hasDueTask(plant: Plant, refDateStr: string): boolean {
    const { watering, fertilizing, pruning, repotting } = plant.nextCareDates
    return (
        (watering != null && watering <= refDateStr) ||
        (fertilizing != null && fertilizing <= refDateStr) ||
        (pruning != null && pruning <= refDateStr) ||
        (repotting != null && repotting <= refDateStr)
    )
}

// ---------------------------------------------------------------------------
// P12 — Plantas con tareas vencidas
// ---------------------------------------------------------------------------

describe('P12 — Plantas con tareas vencidas (Requisito 6.1)', () => {
    it(
        'Feature: plant-care-app, Property 12: Plants with due tasks — getDuePlants devuelve exactamente las plantas con alguna nextCareDate <= date',
        () => {
            fc.assert(
                fc.property(fc.date(), fc.array(plantGen), (date, plants) => {
                    const refDateStr = date.toISOString().slice(0, 10)
                    const result = getDuePlants(date, plants)

                    // Todas las plantas devueltas deben tener al menos una tarea vencida
                    for (const plant of result) {
                        expect(hasDueTask(plant, refDateStr)).toBe(true)
                    }

                    // Ninguna planta sin tareas vencidas debe aparecer en el resultado
                    const plantsWithoutDueTasks = plants.filter((p) => !hasDueTask(p, refDateStr))
                    for (const plant of plantsWithoutDueTasks) {
                        const found = result.some((r) => r.id === plant.id)
                        expect(found).toBe(false)
                    }

                    // Todas las plantas con tareas vencidas deben estar en el resultado
                    const plantsWithDueTasks = plants.filter((p) => hasDueTask(p, refDateStr))
                    for (const plant of plantsWithDueTasks) {
                        const found = result.some((r) => r.id === plant.id)
                        expect(found).toBe(true)
                    }
                }),
                { numRuns: 100 },
            )
        },
    )
})
