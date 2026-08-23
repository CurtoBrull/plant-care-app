import type { PendingChange, SyncResult } from '../models/offline'
import type { StorageAdapter } from '../lib/storage-adapter'
import { localStorageAdapter } from '../lib/storage-adapter'

// ---------------------------------------------------------------------------
// Claves de almacenamiento local
// ---------------------------------------------------------------------------

const PENDING_CHANGES_KEY = 'plant-care:pending-changes'
const CACHE_KEY_PREFIX    = 'plant-care:cache:'

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

export interface IOfflineSyncService {
  queueChange(change: PendingChange): Promise<void>
  flushPendingChanges(): Promise<SyncResult>
  getCachedData<T>(key: string): Promise<T | null>
  setCachedData<T>(key: string, data: T): Promise<void>
  getPendingChanges(): Promise<PendingChange[]>
}

// ---------------------------------------------------------------------------
// Implementación
// ---------------------------------------------------------------------------

export class OfflineSyncService implements IOfflineSyncService {
  private readonly baseUrl: string
  private readonly storage: StorageAdapter

  constructor(options?: { baseUrl?: string; storage?: StorageAdapter }) {
    this.baseUrl = options?.baseUrl || ''
    this.storage = options?.storage ?? localStorageAdapter
  }

  // ── Encolar cambio ─────────────────────────────────────────────────────────

  async queueChange(change: PendingChange): Promise<void> {
    const existing = await this._loadPendingChanges()
    const deduplicated = existing.filter((c) => c.id !== change.id)
    deduplicated.push(change)
    deduplicated.sort((a, b) => a.queuedAt - b.queuedAt)
    await this.storage.setItem(PENDING_CHANGES_KEY, JSON.stringify(deduplicated))
  }

  // ── Sincronizar cambios pendientes ─────────────────────────────────────────

  async flushPendingChanges(): Promise<SyncResult> {
    const pending = await this._loadPendingChanges()
    const result: SyncResult = { synced: 0, failed: 0, errors: [] }

    if (pending.length === 0) return result

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
        const res = await fetch(`${this.baseUrl}/api/${table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(`[insert:${table}] HTTP error ${res.status}`)
        break
      }
      case 'update': {
        const { id, ...rest } = payload as { id: string } & Record<string, unknown>
        const res = await fetch(`${this.baseUrl}/api/${table}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rest),
        })
        if (!res.ok) throw new Error(`[update:${table}] HTTP error ${res.status}`)
        break
      }
      case 'delete': {
        const { id } = payload as { id: string }
        const res = await fetch(`${this.baseUrl}/api/${table}/${id}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error(`[delete:${table}] HTTP error ${res.status}`)
        break
      }
    }
  }
}
