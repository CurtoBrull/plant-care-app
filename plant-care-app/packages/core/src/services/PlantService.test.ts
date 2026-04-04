/**
 * Feature: plant-care-app
 *
 * Property 3: Eliminación de entidad (Plant)
 *   Tras deletePlant, la planta no debe aparecer en getPlants.
 *   Valida: Requisito 2.4
 *
 * Property 4: Búsqueda de plantas por nombre o especie
 *   Todos los resultados de searchPlants contienen el query en commonName o species
 *   (insensible a mayúsculas); ningún resultado ajeno debe aparecer.
 *   Valida: Requisito 2.7
 *
 * Tests unitarios:
 *   createPlant, updatePlant, deletePlant, getPlants, searchPlants, validaciones.
 *   Valida: Requisitos 2.1–2.7
 */

import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { PlantService, PlantServiceError, PlantServiceErrorCode } from './PlantService'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlantRow } from '../lib/plant-mapper'
import type { CreatePlantInput } from '../models/plant'

// ---------------------------------------------------------------------------
// Mock del cliente Supabase con cadena fluida thenable
// Cada operación (select/insert/update/delete) resuelve con su resultado
// configurado; los métodos intermedios (eq, or, order, single…) son
// pass-through que devuelven el mismo objeto thenable.
// ---------------------------------------------------------------------------

type OpResult = { data: unknown; error: unknown }

function makeChain(result: OpResult) {
  const chain: Record<string, unknown> = {
    // Hacer el objeto awaitable
    then: (resolve: (v: OpResult) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (reject: (r: unknown) => unknown) => Promise.resolve(result).catch(reject),
  }
  const passthrough = ['eq', 'neq', 'or', 'order', 'limit', 'single', 'select', 'maybeSingle']
  passthrough.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain)
  })
  return chain
}

function makeClient(ops: {
  onSelect?: OpResult
  onInsert?: OpResult
  onUpdate?: OpResult
  onDelete?: OpResult
} = {}): SupabaseClient {
  const def: OpResult = { data: null, error: null }
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => makeChain(ops.onSelect ?? def)),
      insert: vi.fn(() => makeChain(ops.onInsert ?? def)),
      update: vi.fn(() => makeChain(ops.onUpdate ?? def)),
      delete: vi.fn(() => makeChain(ops.onDelete ?? def)),
    })),
  } as unknown as SupabaseClient
}

// ---------------------------------------------------------------------------
// Generadores
// ---------------------------------------------------------------------------

const plantRowGen = fc.record<PlantRow>({
  id: fc.uuid(),
  user_id: fc.uuid(),
  common_name: fc.string({ minLength: 1, maxLength: 80 }),
  species: fc.string({ minLength: 1, maxLength: 80 }),
  scientific_name: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  acquisition_date: fc.option(
    fc.date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') }).map((d) =>
      d.toISOString().slice(0, 10),
    ),
    { nil: null },
  ),
  location: fc.option(fc.constantFrom('interior', 'exterior'), { nil: null }),
  notes: fc.option(fc.string({ maxLength: 300 }), { nil: null }),
  representative_photo_url: fc.option(fc.webUrl(), { nil: null }),
  watering_frequency_days: fc.option(fc.integer({ min: 1, max: 365 }), { nil: null }),
  fertilizing_frequency_days: fc.option(fc.integer({ min: 1, max: 365 }), { nil: null }),
  fertilizer_type: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  light_needs: fc.option(fc.constantFrom('directa', 'indirecta', 'sombra'), { nil: null }),
  temperature_min_c: fc.option(fc.float({ min: -10, max: 20, noNaN: true }), { nil: null }),
  temperature_max_c: fc.option(fc.float({ min: 20, max: 50, noNaN: true }), { nil: null }),
  pruning_frequency_months: fc.option(fc.integer({ min: 1, max: 24 }), { nil: null }),
  repotting_frequency_months: fc.option(fc.integer({ min: 1, max: 48 }), { nil: null }),
  next_watering_date: fc.constant(null),
  next_fertilizing_date: fc.constant(null),
  next_pruning_date: fc.constant(null),
  next_repotting_date: fc.constant(null),
  created_at: fc.date().map((d) => d.toISOString()),
  updated_at: fc.date().map((d) => d.toISOString()),
})

// ---------------------------------------------------------------------------
// P3 — Propiedad: Eliminación de entidad (Plant)
// ---------------------------------------------------------------------------

describe('P3 — Eliminación de entidad: Plant (Requisito 2.4)', () => {
  it('tras deletePlant, getPlants no devuelve la planta eliminada', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(plantRowGen, { minLength: 1, maxLength: 10 }),
        async (rows) => {
          const target = rows[0]!
          const remaining = rows.slice(1)

          // select devuelve las plantas restantes (BD ya eliminó target)
          const client = makeClient({
            onSelect: { data: remaining, error: null },
            onDelete: { data: null, error: null },
          })
          const service = new PlantService(client)

          await service.deletePlant(target.id)
          const plants = await service.getPlants(target.user_id)

          expect(plants.map((p) => p.id)).not.toContain(target.id)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// P4 — Propiedad: Búsqueda por nombre o especie (insensible a mayúsculas)
// ---------------------------------------------------------------------------

describe('P4 — Búsqueda de plantas por nombre o especie (Requisito 2.7)', () => {
  it('todos los resultados contienen el query en commonName o species', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        fc.array(plantRowGen, { minLength: 0, maxLength: 20 }),
        async (query, allRows) => {
          // Supabase filtraría en el servidor con ilike; aquí simulamos el resultado
          const matchingRows = allRows.filter(
            (r) =>
              r.common_name.toLowerCase().includes(query.toLowerCase()) ||
              r.species.toLowerCase().includes(query.toLowerCase()),
          )

          const client = makeClient({ onSelect: { data: matchingRows, error: null } })
          const service = new PlantService(client)
          const results = await service.searchPlants('user-id', query)

          for (const plant of results) {
            const inName = plant.commonName.toLowerCase().includes(query.toLowerCase())
            const inSpecies = plant.species.toLowerCase().includes(query.toLowerCase())
            expect(inName || inSpecies).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('query vacío delega a getPlants y devuelve todas las plantas', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(plantRowGen, { minLength: 0, maxLength: 10 }),
        async (rows) => {
          const client = makeClient({ onSelect: { data: rows, error: null } })
          const service = new PlantService(client)

          const results = await service.searchPlants('user-id', '   ')
          expect(results.length).toBe(rows.length)
        },
      ),
      { numRuns: 50 },
    )
  })
})

// ---------------------------------------------------------------------------
// Tests unitarios
// ---------------------------------------------------------------------------

describe('PlantService — operaciones CRUD', () => {
  const userId = 'user-uuid-test'

  const baseRow: PlantRow = {
    id: 'plant-uuid-1',
    user_id: userId,
    common_name: 'Monstera',
    species: 'Monstera deliciosa',
    scientific_name: null,
    acquisition_date: null,
    location: 'interior',
    notes: null,
    representative_photo_url: null,
    watering_frequency_days: 7,
    fertilizing_frequency_days: null,
    fertilizer_type: null,
    light_needs: 'indirecta',
    temperature_min_c: 15,
    temperature_max_c: 30,
    pruning_frequency_months: null,
    repotting_frequency_months: null,
    next_watering_date: null,
    next_fertilizing_date: null,
    next_pruning_date: null,
    next_repotting_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // ── createPlant ──────────────────────────────────────────────────────────

  describe('createPlant', () => {
    it('crea una planta con campos obligatorios y devuelve Plant (Requisito 2.1)', async () => {
      const client = makeClient({ onInsert: { data: baseRow, error: null } })
      const service = new PlantService(client)

      const plant = await service.createPlant(userId, {
        commonName: 'Monstera',
        species: 'Monstera deliciosa',
      })
      expect(plant.id).toBe(baseRow.id)
      expect(plant.commonName).toBe('Monstera')
      expect(plant.species).toBe('Monstera deliciosa')
      expect(plant.userId).toBe(userId)
    })

    it('mapea careSchedule correctamente (Requisito 3.1)', async () => {
      const rowWithCare: PlantRow = {
        ...baseRow,
        id: 'plant-uuid-2',
        common_name: 'Ficus',
        species: 'Ficus lyrata',
        watering_frequency_days: 5,
        light_needs: 'directa',
      }
      const client = makeClient({ onInsert: { data: rowWithCare, error: null } })
      const service = new PlantService(client)

      const input: CreatePlantInput = {
        commonName: 'Ficus',
        species: 'Ficus lyrata',
        careSchedule: { wateringFrequencyDays: 5, lightNeeds: 'directa' },
      }
      const plant = await service.createPlant(userId, input)
      expect(plant.careSchedule.wateringFrequencyDays).toBe(5)
      expect(plant.careSchedule.lightNeeds).toBe('directa')
    })

    it('lanza VALIDATION si commonName está vacío (Requisito 2.1)', async () => {
      const service = new PlantService(makeClient())
      await expect(
        service.createPlant(userId, { commonName: '  ', species: 'Ficus lyrata' }),
      ).rejects.toMatchObject({ code: PlantServiceErrorCode.VALIDATION })
    })

    it('lanza VALIDATION si species está vacío (Requisito 2.1)', async () => {
      const service = new PlantService(makeClient())
      await expect(
        service.createPlant(userId, { commonName: 'Ficus', species: '' }),
      ).rejects.toMatchObject({ code: PlantServiceErrorCode.VALIDATION })
    })
  })

  // ── updatePlant ──────────────────────────────────────────────────────────

  describe('updatePlant', () => {
    it('actualiza campos básicos y devuelve Plant actualizada (Requisito 2.3)', async () => {
      const updatedRow: PlantRow = { ...baseRow, common_name: 'Monstera Thai', notes: 'Nueva nota' }
      const client = makeClient({ onUpdate: { data: updatedRow, error: null } })
      const service = new PlantService(client)

      const plant = await service.updatePlant(baseRow.id, {
        commonName: 'Monstera Thai',
        notes: 'Nueva nota',
      })
      expect(plant.commonName).toBe('Monstera Thai')
      expect(plant.notes).toBe('Nueva nota')
    })

    it('actualiza CareSchedule embebido (Requisitos 3.1–3.6)', async () => {
      const updatedRow: PlantRow = { ...baseRow, watering_frequency_days: 3, light_needs: 'sombra' }
      const client = makeClient({ onUpdate: { data: updatedRow, error: null } })
      const service = new PlantService(client)

      const plant = await service.updatePlant(baseRow.id, {
        careSchedule: { wateringFrequencyDays: 3, lightNeeds: 'sombra' },
      })
      expect(plant.careSchedule.wateringFrequencyDays).toBe(3)
      expect(plant.careSchedule.lightNeeds).toBe('sombra')
    })
  })

  // ── getPlants ────────────────────────────────────────────────────────────

  describe('getPlants', () => {
    it('devuelve todas las plantas del usuario (Requisito 2.6)', async () => {
      const rows: PlantRow[] = [
        baseRow,
        { ...baseRow, id: 'plant-uuid-2', common_name: 'Pothos' },
      ]
      const client = makeClient({ onSelect: { data: rows, error: null } })
      const service = new PlantService(client)

      const plants = await service.getPlants(userId)
      expect(plants).toHaveLength(2)
      expect(plants[0]?.id).toBe('plant-uuid-1')
      expect(plants[1]?.id).toBe('plant-uuid-2')
    })

    it('devuelve array vacío si el usuario no tiene plantas', async () => {
      const client = makeClient({ onSelect: { data: [], error: null } })
      const service = new PlantService(client)

      const plants = await service.getPlants(userId)
      expect(plants).toHaveLength(0)
    })

    it('lanza PlantServiceError si Supabase devuelve error', async () => {
      const client = makeClient({ onSelect: { data: null, error: { message: 'DB error' } } })
      const service = new PlantService(client)

      await expect(service.getPlants(userId)).rejects.toBeInstanceOf(PlantServiceError)
    })
  })

  // ── deletePlant ──────────────────────────────────────────────────────────

  describe('deletePlant', () => {
    it('elimina la planta sin errores (Requisito 2.4)', async () => {
      const client = makeClient({ onDelete: { data: null, error: null } })
      const service = new PlantService(client)

      await expect(service.deletePlant(baseRow.id)).resolves.toBeUndefined()
    })

    it('lanza PlantServiceError si Supabase devuelve error', async () => {
      const client = makeClient({ onDelete: { data: null, error: { message: 'FK violation' } } })
      const service = new PlantService(client)

      await expect(service.deletePlant('bad-id')).rejects.toBeInstanceOf(PlantServiceError)
    })
  })
})
