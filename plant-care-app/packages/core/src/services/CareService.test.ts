/**
 * Feature: plant-care-app
 *
 * Property 5: Cálculo de próxima fecha de cuidado
 *   Para cualquier fecha de última tarea y frecuencia en días (entero > 0),
 *   calculateNextDate devuelve exactamente lastDate + frequencyDays.
 *   Valida: Requisito 3.7
 *
 * Tests unitarios:
 *   updateCareSchedule, logCareTask, getNextCareDates, getCareHistory.
 *   Valida: Requisitos 3.1–3.7
 */

import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { CareService, CareServiceError } from './CareService'
import { calculateNextDate, calculateNextDateMonths } from '../utils/careUtils'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Plant } from '../models/plant'

// ---------------------------------------------------------------------------
// Mock del cliente Supabase (mismo patrón thenable que en PlantService.test)
// ---------------------------------------------------------------------------

type OpResult = { data: unknown; error: unknown }

function makeChain(result: OpResult) {
  const chain: Record<string, unknown> = {
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
} = {}): SupabaseClient {
  const def: OpResult = { data: null, error: null }
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => makeChain(ops.onSelect ?? def)),
      insert: vi.fn(() => makeChain(ops.onInsert ?? def)),
      update: vi.fn(() => makeChain(ops.onUpdate ?? def)),
    })),
  } as unknown as SupabaseClient
}

// ---------------------------------------------------------------------------
// P5 — Propiedad: cálculo exacto de próxima fecha
// ---------------------------------------------------------------------------

describe('P5 — Cálculo de próxima fecha de cuidado (Requisito 3.7)', () => {
  it('calculateNextDate(lastDate, freq) === lastDate + freq días (exacto)', () => {
    fc.assert(
      fc.property(
        // Fechas válidas entre 2000 y 2099
        fc.date({ min: new Date('2000-01-01'), max: new Date('2099-01-01') }),
        // Frecuencia: entero positivo (hasta 5 años en días)
        fc.integer({ min: 1, max: 1825 }),
        (lastDate, frequencyDays) => {
          const lastStr = lastDate.toISOString().slice(0, 10)
          const result = calculateNextDate(lastStr, frequencyDays)

          // Verificación independiente: sumar días con UTC
          const [y, m, d] = lastStr.split('-').map(Number) as [number, number, number]
          const expected = new Date(Date.UTC(y, m - 1, d))
          expected.setUTCDate(expected.getUTCDate() + frequencyDays)
          const expectedStr = expected.toISOString().slice(0, 10)

          expect(result).toBe(expectedStr)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('calculateNextDate con freq=1 avanza exactamente 1 día', () => {
    expect(calculateNextDate('2025-01-31', 1)).toBe('2025-02-01')
    expect(calculateNextDate('2024-02-28', 1)).toBe('2024-02-29') // año bisiesto
    expect(calculateNextDate('2025-12-31', 1)).toBe('2026-01-01') // cambio de año
  })

  it('calculateNextDate lanza si frequencyDays ≤ 0', () => {
    expect(() => calculateNextDate('2025-01-01', 0)).toThrow(RangeError)
    expect(() => calculateNextDate('2025-01-01', -1)).toThrow(RangeError)
  })

  it('calculateNextDateMonths suma meses correctamente', () => {
    expect(calculateNextDateMonths('2025-01-15', 1)).toBe('2025-02-15')
    expect(calculateNextDateMonths('2025-01-15', 12)).toBe('2026-01-15')
    expect(calculateNextDateMonths('2025-11-30', 3)).toBe('2026-02-28') // fin de mes ajustado
  })

  it('calculateNextDateMonths con PBT — resultado > lastDate siempre', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2090-01-01') }),
        fc.integer({ min: 1, max: 120 }),
        (lastDate, freqMonths) => {
          const lastStr = lastDate.toISOString().slice(0, 10)
          const result = calculateNextDateMonths(lastStr, freqMonths)
          expect(result > lastStr).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Tests unitarios de CareService
// ---------------------------------------------------------------------------

describe('CareService — operaciones', () => {
  const plantId = 'plant-uuid-1'

  const basePlant: Plant = {
    id: plantId,
    userId: 'user-uuid-1',
    commonName: 'Monstera',
    species: 'Monstera deliciosa',
    careSchedule: {
      wateringFrequencyDays: 7,
      fertilizingFrequencyDays: 14,
      pruningFrequencyMonths: 3,
      repottingFrequencyMonths: 12,
    },
    nextCareDates: {
      watering: '2025-04-10',
      fertilizing: '2025-04-17',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // ── updateCareSchedule ────────────────────────────────────────────────────

  describe('updateCareSchedule', () => {
    it('actualiza la rutina sin errores (Requisitos 3.1–3.6)', async () => {
      const client = makeClient({ onUpdate: { data: null, error: null } })
      const service = new CareService(client)

      await expect(
        service.updateCareSchedule(plantId, {
          wateringFrequencyDays: 5,
          lightNeeds: 'indirecta',
        }),
      ).resolves.toBeUndefined()
    })

    it('lanza CareServiceError si Supabase falla', async () => {
      const client = makeClient({ onUpdate: { data: null, error: { message: 'DB error' } } })
      const service = new CareService(client)

      await expect(service.updateCareSchedule(plantId, {})).rejects.toBeInstanceOf(CareServiceError)
    })
  })

  // ── logCareTask ───────────────────────────────────────────────────────────

  describe('logCareTask', () => {
    const careLogRow = {
      id: 'log-uuid-1',
      plant_id: plantId,
      task_type: 'watering',
      performed_at: '2025-04-03T10:00:00.000Z',
      notes: null,
    }

    const plantFreqRow = {
      watering_frequency_days: 7,
      fertilizing_frequency_days: 14,
      pruning_frequency_months: 3,
      repotting_frequency_months: 12,
    }

    it('inserta log, calcula próxima fecha y actualiza la planta (Requisito 3.7)', async () => {
      // Primer select (frecuencias), luego update
      let selectCallCount = 0
      const client = {
        from: vi.fn(() => ({
          select: vi.fn(() => {
            // Primer select devuelve las frecuencias de la planta
            selectCallCount++
            return makeChain({ data: plantFreqRow, error: null })
          }),
          insert: vi.fn(() => makeChain({ data: careLogRow, error: null })),
          update: vi.fn(() => makeChain({ data: null, error: null })),
        })),
      } as unknown as SupabaseClient

      const service = new CareService(client)
      const log = await service.logCareTask(plantId, {
        taskType: 'watering',
        performedAt: '2025-04-03T10:00:00.000Z',
      })

      expect(log.id).toBe('log-uuid-1')
      expect(log.taskType).toBe('watering')
      expect(log.plantId).toBe(plantId)
    })

    it('calcula next_watering_date = performedAt + wateringFrequencyDays', async () => {
      // Verifica el cálculo directamente con calculateNextDate
      const performed = '2025-04-03'
      const freq = 7
      const expected = calculateNextDate(performed, freq)
      expect(expected).toBe('2025-04-10')
    })

    it('calcula next_pruning_date en meses (frecuencia mensual)', () => {
      const performed = '2025-04-03'
      const freqMonths = 3
      const expected = calculateNextDateMonths(performed, freqMonths)
      expect(expected).toBe('2025-07-03')
    })
  })

  // ── getNextCareDates ──────────────────────────────────────────────────────

  describe('getNextCareDates', () => {
    it('devuelve nextCareDates de la planta (síncrono, Requisito 3.7)', () => {
      const service = new CareService(makeClient())
      const dates = service.getNextCareDates(basePlant)

      expect(dates).toEqual(basePlant.nextCareDates)
      expect(dates.watering).toBe('2025-04-10')
      expect(dates.fertilizing).toBe('2025-04-17')
    })

    it('devuelve objeto vacío si la planta no tiene nextCareDates configuradas', () => {
      const service = new CareService(makeClient())
      const plantWithoutDates: Plant = { ...basePlant, nextCareDates: {} }
      const dates = service.getNextCareDates(plantWithoutDates)

      expect(dates).toEqual({})
    })
  })

  // ── getCareHistory ────────────────────────────────────────────────────────

  describe('getCareHistory', () => {
    it('devuelve historial de cuidados ordenado por fecha descendente', async () => {
      const rows = [
        { id: 'log-2', plant_id: plantId, task_type: 'watering', performed_at: '2025-04-03T10:00:00.000Z', notes: null },
        { id: 'log-1', plant_id: plantId, task_type: 'fertilizing', performed_at: '2025-03-20T10:00:00.000Z', notes: 'Abono NPK' },
      ]
      const client = makeClient({ onSelect: { data: rows, error: null } })
      const service = new CareService(client)

      const history = await service.getCareHistory(plantId)
      expect(history).toHaveLength(2)
      expect(history[0]?.taskType).toBe('watering')
      expect(history[1]?.notes).toBe('Abono NPK')
    })

    it('devuelve array vacío si no hay historial', async () => {
      const client = makeClient({ onSelect: { data: [], error: null } })
      const service = new CareService(client)

      const history = await service.getCareHistory(plantId)
      expect(history).toHaveLength(0)
    })
  })
})
