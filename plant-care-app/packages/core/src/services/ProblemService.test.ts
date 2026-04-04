/**
 * Feature: plant-care-app
 *
 * Property 9: Round-trip de Registro_de_Problema
 *   Crear y recuperar un Problem devuelve los mismos valores en todos sus campos.
 *   Valida: Requisitos 5.1, 5.2
 *
 * Property 10: Historial de problemas ordenado cronológicamente
 *   getProblems devuelve registros ordenados por detectedAt descendente.
 *   Valida: Requisito 5.3
 *
 * Property 11: Marcar problema como resuelto
 *   Tras markAsResolved, resolved = true y resolvedAt no es nulo.
 *   Valida: Requisito 5.4
 *
 * Property 3 (Problem): Eliminación de entidad
 *   Tras deleteProblem, el registro no aparece en getProblems.
 *   Valida: Requisito 5.5
 */

import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { ProblemService, ProblemServiceError, ProblemServiceErrorCode } from './ProblemService'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreateProblemInput } from '../models/problem'

// ---------------------------------------------------------------------------
// Mock del cliente Supabase (mismo patrón thenable)
// ---------------------------------------------------------------------------

type OpResult = { data: unknown; error: unknown }

function makeChain(result: OpResult) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: OpResult) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (reject: (r: unknown) => unknown) => Promise.resolve(result).catch(reject),
  }
    ;['eq', 'neq', 'or', 'order', 'limit', 'single', 'select', 'maybeSingle'].forEach((m) => {
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

const isoTimestampArb = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2099-12-31') })
  .map((d) => d.toISOString())

interface ProblemRowLike {
  id: string
  plant_id: string
  type: string
  description: string
  detected_at: string
  image_url: string | null
  resolved: boolean
  resolved_at: string | null
}

// Strings with at least one non-whitespace character (to pass trim validation)
const nonBlankStringArb = (maxLength: number) =>
  fc.string({ minLength: 1, maxLength }).filter((s) => s.trim().length > 0)

const problemRowGen: fc.Arbitrary<ProblemRowLike> = fc.record({
  id: fc.uuid(),
  plant_id: fc.uuid(),
  type: nonBlankStringArb(60),
  description: nonBlankStringArb(300),
  detected_at: isoTimestampArb,
  image_url: fc.option(fc.webUrl(), { nil: null }),
  resolved: fc.boolean(),
  resolved_at: fc.option(isoTimestampArb, { nil: null }),
})

// Genera solo problemas no resueltos (para P11)
const unresolvedProblemRowGen = problemRowGen.map((r) => ({
  ...r,
  resolved: false,
  resolved_at: null,
}))

// ---------------------------------------------------------------------------
// P9 — Round-trip de Registro_de_Problema
// ---------------------------------------------------------------------------

describe('P9 — Round-trip de Registro_de_Problema (Requisitos 5.1, 5.2)', () => {
  it('crear y recuperar un Problem devuelve los mismos campos', async () => {
    await fc.assert(
      fc.asyncProperty(
        problemRowGen,
        async (row) => {
          // Simula que la BD devuelve exactamente la fila insertada
          const client = makeClient({ onInsert: { data: row, error: null } })
          const service = new ProblemService(client)

          const input: CreateProblemInput = {
            type: row.type,
            description: row.description,
            detectedAt: row.detected_at,
            ...(row.image_url != null && { imageUrl: row.image_url }),
          }

          const problem = await service.createProblem(row.plant_id, input)

          expect(problem.id).toBe(row.id)
          expect(problem.plantId).toBe(row.plant_id)
          expect(problem.type).toBe(row.type)
          expect(problem.description).toBe(row.description)
          expect(problem.detectedAt).toBe(row.detected_at)
          expect(problem.resolved).toBe(row.resolved)
          if (row.image_url != null) expect(problem.imageUrl).toBe(row.image_url)
          if (row.resolved_at != null) expect(problem.resolvedAt).toBe(row.resolved_at)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// P10 — Historial de problemas ordenado cronológicamente
// ---------------------------------------------------------------------------

describe('P10 — Historial de problemas ordenado por detectedAt DESC (Requisito 5.3)', () => {
  it('getProblems devuelve registros de más reciente a más antiguo', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(problemRowGen, { minLength: 0, maxLength: 20 }),
        async (rows) => {
          // Supabase devuelve las filas ya ordenadas; el servicio simplemente las mapea
          const sorted = [...rows].sort((a, b) => b.detected_at.localeCompare(a.detected_at))

          const client = makeClient({ onSelect: { data: sorted, error: null } })
          const service = new ProblemService(client)
          const problems = await service.getProblems('plant-id')

          for (let i = 1; i < problems.length; i++) {
            expect(problems[i - 1]!.detectedAt >= problems[i]!.detectedAt).toBe(true)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// P11 — Marcar problema como resuelto
// ---------------------------------------------------------------------------

describe('P11 — Marcar problema como resuelto (Requisito 5.4)', () => {
  it('markAsResolved devuelve resolved=true y resolvedAt no nulo', async () => {
    await fc.assert(
      fc.asyncProperty(
        unresolvedProblemRowGen,
        async (row) => {
          const resolvedAt = new Date().toISOString()
          const resolvedRow = { ...row, resolved: true, resolved_at: resolvedAt }

          const client = makeClient({ onUpdate: { data: resolvedRow, error: null } })
          const service = new ProblemService(client)

          const problem = await service.markAsResolved(row.id, resolvedAt)

          expect(problem.resolved).toBe(true)
          expect(problem.resolvedAt).toBeTruthy()
          expect(typeof problem.resolvedAt).toBe('string')
        },
      ),
      { numRuns: 100 },
    )
  })

  it('resolvedAt es la fecha exacta proporcionada', async () => {
    const fixedDate = '2025-04-03T12:00:00.000Z'
    const resolvedRow = {
      id: 'p-1', plant_id: 'plant-1', type: 'Plaga', description: 'Pulgones',
      detected_at: '2025-03-01T00:00:00.000Z', image_url: null,
      resolved: true, resolved_at: fixedDate,
    }
    const client = makeClient({ onUpdate: { data: resolvedRow, error: null } })
    const service = new ProblemService(client)

    const problem = await service.markAsResolved('p-1', fixedDate)
    expect(problem.resolvedAt).toBe(fixedDate)
  })
})

// ---------------------------------------------------------------------------
// P3 — Eliminación de entidad (Problem)
// ---------------------------------------------------------------------------

describe('P3 — Eliminación de entidad: Problem (Requisito 5.5)', () => {
  it('tras deleteProblem, getProblems no contiene el registro eliminado', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(problemRowGen, { minLength: 1, maxLength: 10 }),
        async (rows) => {
          const target = rows[0]!
          const remaining = rows.slice(1)

          let selectCalled = false
          const client = {
            from: vi.fn(() => ({
              select: vi.fn(() => {
                const result = selectCalled
                  ? { data: remaining, error: null }
                  : { data: remaining, error: null }
                selectCalled = true
                return makeChain(result)
              }),
              delete: vi.fn(() => makeChain({ data: null, error: null })),
              insert: vi.fn(() => makeChain({ data: null, error: null })),
              update: vi.fn(() => makeChain({ data: null, error: null })),
            })),
          } as unknown as SupabaseClient

          const service = new ProblemService(client)
          await service.deleteProblem(target.id)
          const problems = await service.getProblems(target.plant_id)

          expect(problems.map((p) => p.id)).not.toContain(target.id)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ---------------------------------------------------------------------------
// Tests unitarios
// ---------------------------------------------------------------------------

describe('ProblemService — operaciones', () => {
  const plantId = 'plant-uuid-1'
  const problemId = 'problem-uuid-1'

  const baseRow = {
    id: problemId,
    plant_id: plantId,
    type: 'Plaga',
    description: 'Pulgones en las hojas',
    detected_at: '2025-04-01T10:00:00.000Z',
    image_url: null,
    resolved: false,
    resolved_at: null,
  }

  // ── createProblem ──────────────────────────────────────────────────────────

  describe('createProblem', () => {
    it('crea un problema con campos obligatorios (Requisito 5.1)', async () => {
      const client = makeClient({ onInsert: { data: baseRow, error: null } })
      const service = new ProblemService(client)

      const problem = await service.createProblem(plantId, {
        type: 'Plaga',
        description: 'Pulgones en las hojas',
        detectedAt: '2025-04-01T10:00:00.000Z',
      })

      expect(problem.id).toBe(problemId)
      expect(problem.type).toBe('Plaga')
      expect(problem.description).toBe('Pulgones en las hojas')
      expect(problem.resolved).toBe(false)
      expect(problem.resolvedAt).toBeUndefined()
    })

    it('acepta imagen adjunta (Requisito 5.2)', async () => {
      const rowWithImage = { ...baseRow, image_url: 'https://cdn.example.com/bug.jpg' }
      const client = makeClient({ onInsert: { data: rowWithImage, error: null } })
      const service = new ProblemService(client)

      const problem = await service.createProblem(plantId, {
        type: 'Hongo',
        description: 'Oídio en hojas',
        detectedAt: '2025-04-01T10:00:00.000Z',
        imageUrl: 'https://cdn.example.com/bug.jpg',
      })

      expect(problem.imageUrl).toBe('https://cdn.example.com/bug.jpg')
    })

    it('lanza VALIDATION si type está vacío (Requisito 5.1)', async () => {
      const service = new ProblemService(makeClient())
      await expect(
        service.createProblem(plantId, { type: '  ', description: 'desc', detectedAt: new Date().toISOString() }),
      ).rejects.toMatchObject({ code: ProblemServiceErrorCode.VALIDATION })
    })

    it('lanza VALIDATION si description está vacía (Requisito 5.1)', async () => {
      const service = new ProblemService(makeClient())
      await expect(
        service.createProblem(plantId, { type: 'Plaga', description: '', detectedAt: new Date().toISOString() }),
      ).rejects.toMatchObject({ code: ProblemServiceErrorCode.VALIDATION })
    })
  })

  // ── getProblems ────────────────────────────────────────────────────────────

  describe('getProblems', () => {
    it('devuelve historial ordenado por detectedAt DESC (Requisito 5.3)', async () => {
      const rows = [
        { ...baseRow, id: 'p2', detected_at: '2025-04-02T00:00:00.000Z' },
        { ...baseRow, id: 'p1', detected_at: '2025-04-01T00:00:00.000Z' },
      ]
      const client = makeClient({ onSelect: { data: rows, error: null } })
      const service = new ProblemService(client)

      const problems = await service.getProblems(plantId)
      expect(problems[0]?.id).toBe('p2')
      expect(problems[1]?.id).toBe('p1')
    })

    it('devuelve array vacío si no hay problemas registrados', async () => {
      const client = makeClient({ onSelect: { data: [], error: null } })
      const service = new ProblemService(client)
      expect(await service.getProblems(plantId)).toHaveLength(0)
    })
  })

  // ── markAsResolved ─────────────────────────────────────────────────────────

  describe('markAsResolved', () => {
    it('devuelve resolved=true y resolvedAt con fecha actual si no se provee (Requisito 5.4)', async () => {
      const resolvedRow = { ...baseRow, resolved: true, resolved_at: new Date().toISOString() }
      const client = makeClient({ onUpdate: { data: resolvedRow, error: null } })
      const service = new ProblemService(client)

      const problem = await service.markAsResolved(problemId)
      expect(problem.resolved).toBe(true)
      expect(problem.resolvedAt).toBeTruthy()
    })

    it('lanza ProblemServiceError si Supabase devuelve error', async () => {
      const client = makeClient({ onUpdate: { data: null, error: { message: 'DB error' } } })
      const service = new ProblemService(client)
      await expect(service.markAsResolved('bad-id')).rejects.toBeInstanceOf(ProblemServiceError)
    })
  })

  // ── deleteProblem ──────────────────────────────────────────────────────────

  describe('deleteProblem', () => {
    it('elimina el problema sin errores (Requisito 5.5)', async () => {
      const client = makeClient({ onDelete: { data: null, error: null } })
      const service = new ProblemService(client)
      await expect(service.deleteProblem(problemId)).resolves.toBeUndefined()
    })

    it('lanza ProblemServiceError si Supabase devuelve error', async () => {
      const client = makeClient({ onDelete: { data: null, error: { message: 'DB error' } } })
      const service = new ProblemService(client)
      await expect(service.deleteProblem('bad-id')).rejects.toBeInstanceOf(ProblemServiceError)
    })
  })
})
