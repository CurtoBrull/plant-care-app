export type DbOperation = 'insert' | 'update' | 'delete'

export interface PendingChange {
  id: string
  table: string
  operation: DbOperation
  payload: Record<string, unknown>
  queuedAt: number    // Unix ms
}

export interface SyncResult {
  synced: number
  failed: number
  errors: Error[]
}
