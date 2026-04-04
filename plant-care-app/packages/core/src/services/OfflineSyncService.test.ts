/**
 * Feature: plant-care-app
 *
 * Property 20: Sincronización de cambios pendientes offline
 *   Para cualquier conjunto de PendingChange encolados durante modo offline,
 *   flushPendingChanges() debe sincronizar todos los cambios con Supabase
 *   al recuperar la conexión, sin pérdida de datos.
 *   Valida: Requisito 9.4
 *
 * Tests unitarios:
 *   queueChange, flushPendingChanges, getCachedData, setCachedData,
 *   orden cronológico, deduplicación, manejo de errores parciales.
 *   Valida: Requisitos 9.3, 9.4
 */

import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { OfflineSyncService } from './OfflineSyncService'
import { createInMemoryStorage } from '../lib/storage-adapter'
import type { PendingChange } from '../models/offline'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbOperation } from '../models/offline'

// ---------------------------------------------------------------------------
// Mock del cliente Supabase con cadena fluida
// ---------------------------------------------------------------------------

type OpResult = { data: unknown; error: unknown }

function makeChain(result: OpResult) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: OpResult) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (reject: (r: unknown) => unknown) => Promise.resolve(result).catch(reject),
  }
  ;['eq', 'neq', 'select', 'single'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain)
  })
  return chain
}

function makeClient(ops: {
  onInsert?: OpResult
  onUpdate?: OpResult
  onDelete?: OpResult
} = {}): SupabaseClient {
  const def: OpResult = { data: null, error: null }
  return {
    from: vi.fn(() => ({
      insert: vi.fn(() => makeChain(ops.onInsert ?? def)),
      update: vi.fn(() => makeChain(ops.onUpdate ?? def)),
      delete: vi.fn(() => makeChain(ops.onDelete ?? def)),
    })),
  } as unknown as SupabaseClient
}

// ---------------------------------------------------------------------------
// Generador de PendingChange
// ---------------------------------------------------------------------------

const operationArb: fc.Arbitrary<DbOperation> = fc.constantFrom('insert', 'update', 'delete')

const pendingChangeGen: fc.Arbitrary<PendingChange> = fc.record({
  id:        fc.uuid(),
  table:     fc.constantFrom('plants', 'photos', 'care_logs', 'problems'),
  operation: operationArb,
  payload:   fc.record({
    id:   fc.uuid(),
    data: fc.string({ maxLength: 50 }),
  }),
  queuedAt: fc.integer({ min: 1_000_000, max: 9_999_999_999_999 }),
})

// ---------------------------------------------------------------------------
// P20 — Sincronización de cambios pendientes offline
// ---------------------------------------------------------------------------

describe('P20 — Sincronización de cambios pendientes offline (Requisito 9.4)', () => {
  it('flushPendingChanges sincroniza todos los cambios sin pérdida de datos', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(pendingChangeGen, { minLength: 1, maxLength: 15 }),
        async (changes) => {
          const storage = createInMemoryStorage()
          const appliedOps: Array<{ table: string; op: string }> = []

          // Cliente que registra cada operación aplicada
          const client = {
            from: vi.fn((table: string) => ({
              insert: vi.fn(() => {
                appliedOps.push({ table, op: 'insert' })
                return makeChain({ data: null, error: null })
              }),
              update: vi.fn(() => {
                appliedOps.push({ table, op: 'update' })
                return makeChain({ data: null, error: null })
              }),
              delete: vi.fn(() => {
                appliedOps.push({ table, op: 'delete' })
                return makeChain({ data: null, error: null })
              }),
            })),
          } as unknown as SupabaseClient

          const service = new OfflineSyncService({ client, storage })

          // Encolar todos los cambios
          for (const change of changes) {
            await service.queueChange(change)
          }

          // Verificar que están encolados
          const pending = await service.getPendingChanges()
          expect(pending.length).toBe(changes.length)

          // Sincronizar
          const result = await service.flushPendingChanges()

          // Todos deben haberse sincronizado
          expect(result.synced).toBe(changes.length)
          expect(result.failed).toBe(0)
          expect(result.errors).toHaveLength(0)

          // El queue debe estar vacío tras el flush exitoso
          const remaining = await service.getPendingChanges()
          expect(remaining).toHaveLength(0)

          // Exactamente tantas operaciones aplicadas como cambios encolados
          expect(appliedOps.length).toBe(changes.length)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('los cambios se aplican en orden cronológico (queuedAt ASC)', async () => {
    const changes: PendingChange[] = [
      { id: 'c3', table: 'plants', operation: 'delete', payload: { id: 'p3' }, queuedAt: 3000 },
      { id: 'c1', table: 'plants', operation: 'insert', payload: { id: 'p1' }, queuedAt: 1000 },
      { id: 'c2', table: 'plants', operation: 'update', payload: { id: 'p2' }, queuedAt: 2000 },
    ]

    const appliedOrder: string[] = []
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn((_payload: unknown) => {
          appliedOrder.push('insert')
          return makeChain({ data: null, error: null })
        }),
        update: vi.fn(() => {
          appliedOrder.push('update')
          return makeChain({ data: null, error: null })
        }),
        delete: vi.fn(() => {
          appliedOrder.push('delete')
          return makeChain({ data: null, error: null })
        }),
      })),
    } as unknown as SupabaseClient

    const storage = createInMemoryStorage()
    const service = new OfflineSyncService({ client, storage })

    for (const c of changes) await service.queueChange(c)
    await service.flushPendingChanges()

    expect(appliedOrder).toEqual(['insert', 'update', 'delete'])
  })

  it('los cambios fallidos permanecen en el queue para reintentar', async () => {
    const changes: PendingChange[] = [
      { id: 'ok',   table: 'plants', operation: 'insert', payload: { id: 'p1' }, queuedAt: 1000 },
      { id: 'fail', table: 'plants', operation: 'update', payload: { id: 'p2' }, queuedAt: 2000 },
    ]

    let callCount = 0
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn(() => makeChain({ data: null, error: null })),
        update: vi.fn(() => {
          callCount++
          return makeChain({ data: null, error: { message: 'Network error' } })
        }),
        delete: vi.fn(() => makeChain({ data: null, error: null })),
      })),
    } as unknown as SupabaseClient

    const storage = createInMemoryStorage()
    const service = new OfflineSyncService({ client, storage })

    for (const c of changes) await service.queueChange(c)
    const result = await service.flushPendingChanges()

    expect(result.synced).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.errors).toHaveLength(1)

    // El cambio fallido sigue en el queue
    const remaining = await service.getPendingChanges()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.id).toBe('fail')
  })
})

// ---------------------------------------------------------------------------
// Tests unitarios
// ---------------------------------------------------------------------------

describe('OfflineSyncService — operaciones', () => {
  // ── queueChange ────────────────────────────────────────────────────────────

  describe('queueChange', () => {
    it('añade cambios al queue local (Requisito 9.4)', async () => {
      const storage = createInMemoryStorage()
      const service = new OfflineSyncService({ client: makeClient(), storage })

      const change: PendingChange = {
        id: 'c1', table: 'plants', operation: 'insert',
        payload: { id: 'p1', common_name: 'Monstera' }, queuedAt: Date.now(),
      }
      await service.queueChange(change)

      const pending = await service.getPendingChanges()
      expect(pending).toHaveLength(1)
      expect(pending[0]?.id).toBe('c1')
    })

    it('deduplica cambios con el mismo id', async () => {
      const storage = createInMemoryStorage()
      const service = new OfflineSyncService({ client: makeClient(), storage })

      const change: PendingChange = {
        id: 'c1', table: 'plants', operation: 'insert',
        payload: { id: 'p1' }, queuedAt: 1000,
      }
      const updated: PendingChange = { ...change, payload: { id: 'p1', common_name: 'Updated' }, queuedAt: 2000 }

      await service.queueChange(change)
      await service.queueChange(updated)

      const pending = await service.getPendingChanges()
      expect(pending).toHaveLength(1)
      expect(pending[0]?.payload).toEqual({ id: 'p1', common_name: 'Updated' })
    })

    it('queue vacío devuelve array vacío', async () => {
      const service = new OfflineSyncService({ client: makeClient(), storage: createInMemoryStorage() })
      const pending = await service.getPendingChanges()
      expect(pending).toHaveLength(0)
    })
  })

  // ── flushPendingChanges ────────────────────────────────────────────────────

  describe('flushPendingChanges', () => {
    it('devuelve synced=0 si no hay cambios pendientes', async () => {
      const service = new OfflineSyncService({ client: makeClient(), storage: createInMemoryStorage() })
      const result = await service.flushPendingChanges()
      expect(result.synced).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('aplica operaciones insert, update y delete correctamente', async () => {
      const insertSpy = vi.fn(() => makeChain({ data: null, error: null }))
      const updateSpy = vi.fn(() => makeChain({ data: null, error: null }))
      const deleteSpy = vi.fn(() => makeChain({ data: null, error: null }))

      const client = {
        from: vi.fn(() => ({ insert: insertSpy, update: updateSpy, delete: deleteSpy })),
      } as unknown as SupabaseClient

      const storage = createInMemoryStorage()
      const service = new OfflineSyncService({ client, storage })

      await service.queueChange({ id: 'i1', table: 'plants', operation: 'insert', payload: { id: 'p1' }, queuedAt: 1 })
      await service.queueChange({ id: 'u1', table: 'plants', operation: 'update', payload: { id: 'p2', notes: 'x' }, queuedAt: 2 })
      await service.queueChange({ id: 'd1', table: 'plants', operation: 'delete', payload: { id: 'p3' }, queuedAt: 3 })

      const result = await service.flushPendingChanges()

      expect(result.synced).toBe(3)
      expect(insertSpy).toHaveBeenCalledOnce()
      expect(updateSpy).toHaveBeenCalledOnce()
      expect(deleteSpy).toHaveBeenCalledOnce()
    })
  })

  // ── getCachedData / setCachedData ──────────────────────────────────────────

  describe('getCachedData / setCachedData', () => {
    it('persiste y recupera datos arbitrarios (Requisito 9.3)', async () => {
      const storage = createInMemoryStorage()
      const service = new OfflineSyncService({ client: makeClient(), storage })

      const plants = [{ id: 'p1', commonName: 'Monstera' }]
      await service.setCachedData('plants:user-1', plants)

      const cached = await service.getCachedData<typeof plants>('plants:user-1')
      expect(cached).toEqual(plants)
    })

    it('devuelve null si no hay datos cacheados', async () => {
      const service = new OfflineSyncService({ client: makeClient(), storage: createInMemoryStorage() })
      const result = await service.getCachedData('no-existe')
      expect(result).toBeNull()
    })

    it('round-trip con PBT — cualquier valor JSON se recupera igual', async () => {
      // JSON.stringify pierde -0 (lo convierte a 0) → normalizamos ambos lados
      // con el mismo proceso antes de comparar, igual que en plant.test.ts
      const normalize = (v: unknown) => JSON.parse(JSON.stringify(v)) as unknown

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.jsonValue(),
          async (key, value) => {
            const storage = createInMemoryStorage()
            const service = new OfflineSyncService({ client: makeClient(), storage })

            await service.setCachedData(key, value)
            const result = await service.getCachedData(key)
            expect(result).toEqual(normalize(value))
          },
        ),
        { numRuns: 100 },
      )
    })
  })
})
