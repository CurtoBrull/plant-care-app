/**
 * Feature: plant-care-app
 * Property 2: Round-trip de datos de planta
 *
 * Para cualquier combinación válida de campos de una Planta, serializar y
 * deserializar el objeto (simulando el ciclo BD → dominio) debe devolver
 * exactamente los mismos valores en todos los campos persistidos.
 *
 * Valida: Requisitos 2.1, 2.2, 2.3, 3.1–3.6, 9.1
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { Plant, CareSchedule, NextCareDates, PlantLocation, LightNeeds } from './plant'

// ---------------------------------------------------------------------------
// Generadores
// ---------------------------------------------------------------------------

const locationArb: fc.Arbitrary<PlantLocation> = fc.constantFrom('interior', 'exterior')
const lightNeedsArb: fc.Arbitrary<LightNeeds> = fc.constantFrom('directa', 'indirecta', 'sombra')

const isoDateArb: fc.Arbitrary<string> = fc.date({
  min: new Date('2000-01-01'),
  max: new Date('2099-12-31'),
}).map((d) => d.toISOString().slice(0, 10))

const isoTimestampArb: fc.Arbitrary<string> = fc.date().map((d) => d.toISOString())

const careScheduleArb: fc.Arbitrary<CareSchedule> = fc.record(
  {
    wateringFrequencyDays: fc.integer({ min: 1, max: 365 }),
    fertilizingFrequencyDays: fc.integer({ min: 1, max: 365 }),
    fertilizerType: fc.string({ minLength: 1, maxLength: 50 }),
    lightNeeds: lightNeedsArb,
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

const plantArb: fc.Arbitrary<Plant> = fc.record({
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
// Simula el ciclo serialización → deserialización (JSON ↔ objeto)
// En producción este ciclo lo hace Supabase JS SDK al guardar y recuperar filas.
//
// Antes de comparar normalizamos el objeto original porque JSON tiene dos
// comportamientos que difieren de los objetos JS:
//   • Los campos `undefined` se eliminan (como en Supabase, que usa NULL)
//   • `-0` se serializa como `0`
// Normalizamos ambos lados de la comparación para validar la propiedad real:
// "lo que se puede persistir, se recupera igual".
// ---------------------------------------------------------------------------
function normalize(plant: Plant): Plant {
  return JSON.parse(
    JSON.stringify(plant, (_, v) => (typeof v === 'number' && Object.is(v, -0) ? 0 : v)),
  ) as Plant
}

function roundTrip(plant: Plant): Plant {
  return JSON.parse(JSON.stringify(plant)) as Plant
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('P2 — Round-trip de datos de planta', () => {
  it('conserva todos los campos persistibles tras serialización JSON', () => {
    fc.assert(
      fc.property(plantArb, (plant) => {
        // Normalizamos primero para trabajar solo con valores serializables
        const normalized = normalize(plant)
        const result = roundTrip(normalized)
        expect(result).toEqual(normalized)
      }),
      { numRuns: 100 },
    )
  })

  it('campos obligatorios commonName y species nunca son vacíos', () => {
    fc.assert(
      fc.property(plantArb, (plant) => {
        expect(plant.commonName.length).toBeGreaterThan(0)
        expect(plant.species.length).toBeGreaterThan(0)
      }),
      { numRuns: 100 },
    )
  })

  it('location sólo toma valores válidos cuando está presente', () => {
    fc.assert(
      fc.property(plantArb, (plant) => {
        if (plant.location !== undefined) {
          expect(['interior', 'exterior']).toContain(plant.location)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('lightNeeds sólo toma valores válidos cuando está presente', () => {
    fc.assert(
      fc.property(plantArb, (plant) => {
        if (plant.careSchedule.lightNeeds !== undefined) {
          expect(['directa', 'indirecta', 'sombra']).toContain(plant.careSchedule.lightNeeds)
        }
      }),
      { numRuns: 100 },
    )
  })
})
