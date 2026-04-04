import type { SupabaseClient } from '@supabase/supabase-js'
import type { PendingChange, SyncResult } from '../models/offline'
import type { StorageAdapter } from '../lib/storage-adapter'
import { localStorageAdapter } from '../lib/storage-adapter'
import { getSupabaseClient } from '../lib/supabase-client'

// ---------------------------------------------------------------------------
// Claves de almacenamiento local
// ---------------------------------------------------------------------------

const PENDING_CHANGES_KEY = 'plant-care:pending-changes'
const CACHE_KEY_PREFIX    = 'plant-care:cache:'

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

export interface IOfflineSyncService {
  /** Encola un cambio pendiente en el almacenamiento local. */
  queueChange(change: PendingChange): Promise<void>
  /** Sincroniza todos los cambios pendientes con Supabase al recuperar conexión. */
  flushPendingChanges(): Promise<SyncResult>
  /** Carga datos cacheados cuando no hay conexión. */
  getCachedData<T>(key: string): Promise<T | null>
  /** Persiste datos en caché local. */
  setCachedData<T>(key: string, data: T): Promise<void>
  /** Retorna los cambios pendientes sin aplicar. */
  getPendingChanges(): Promise<PendingChange[]>
}

// ---------------------------------------------------------------------------
// Implementación
// ---------------------------------------------------------------------------

export class OfflineSyncService implements IOfflineSyncService {
  private readonly db:      SupabaseClient
  private readonly storage: StorageAdapter

  constructor(options?: { client?: SupabaseClient; storage?: StorageAdapter }) {
    this.db      = options?.client  ?? getSupabaseClient()
    this.storage = options?.storage ?? localStorageAdapter
  }

  // ── Encolar cambio ─────────────────────────────────────────────────────────

  async queueChange(change: PendingChange): Promise<void> {
    const existing = await this._loadPendingChanges()
    // Evitar duplicados por id
    const deduplicated = existing.filter((c) => c.id !== change.id)
    deduplicated.push(change)
    // Ordenar por queuedAt para aplicar en orden cronológico
    deduplicated.sort((a, b) => a.queuedAt - b.queuedAt)
    await this.storage.setItem(PENDING_CHANGES_KEY, JSON.stringify(deduplicated))
  }

  // ── Sincronizar cambios pendientes ─────────────────────────────────────────

  async flushPendingChanges(): Promise<SyncResult> {
    const pending = await this._loadPendingChanges()
    const result: SyncResult = { synced: 0, failed: 0, errors: [] }

    if (pending.length === 0) return result

    // Aplicar en orden cronológico (last-write-wins por campo)
    const successIds: string[] = []

    for (const change of pending) {
      try {
        await this._applyChange(change)
        successIds.push(change.id)
        result.synced++
      } catch (err) {
        result.failed++
        result.errors.push(err instanceof Error ? err : new Error(String(err)))
      }
    }

    // Eliminar del queue los que se sincronizaron correctamente
    const remaining = pending.filter((c) => !successIds.includes(c.id))
    await this.storage.setItem(PENDING_CHANGES_KEY, JSON.stringify(remaining))

    return result
  }

  // ── Leer caché ────────────────────────────────────────────────────────────

  async getCachedData<T>(key: string): Promise<T | null> {
    const raw = await this.storage.getItem(`${CACHE_KEY_PREFIX}${key}`)
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  // ── Escribir caché ─────────────────────────────────────────────────────────

  async setCachedData<T>(key: string, data: T): Promise<void> {
    await this.storage.setItem(`${CACHE_KEY_PREFIX}${key}`, JSON.stringify(data))
  }

  // ── Obtener pendientes ─────────────────────────────────────────────────────

  async getPendingChanges(): Promise<PendingChange[]> {
    return this._loadPendingChanges()
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private async _loadPendingChanges(): Promise<PendingChange[]> {
    const raw = await this.storage.getItem(PENDING_CHANGES_KEY)
    if (!raw) return []
    try {
      return JSON.parse(raw) as PendingChange[]
    } catch {
      return []
    }
  }

  private async _applyChange(change: PendingChange): Promise<void> {
    const { table, operation, payload } = change

    switch (operation) {
      case 'insert': {
        const { error } = await this.db.from(table).insert(payload)
        if (error) throw new Error(`[insert:${table}] ${error.message}`)
        break
      }
      case 'update': {
        const { id, ...rest } = payload as { id: string } & Record<string, unknown>
        const { error } = await this.db.from(table).update(rest).eq('id', id)
        if (error) throw new Error(`[update:${table}] ${error.message}`)
        break
      }
      case 'delete': {
        const { id } = payload as { id: string }
        const { error } = await this.db.from(table).delete().eq('id', id)
        if (error) throw new Error(`[delete:${table}] ${error.message}`)
        break
      }
    }
  }
}
