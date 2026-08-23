import type { CareSchedule, NextCareDates, Plant } from '../models/plant'
import type { CareLog, LogCareTaskInput, CareTaskType } from '../models/care-log'
import { calculateNextDate, calculateNextDateMonths } from '../utils/careUtils'

// ---------------------------------------------------------------------------
// Errores de dominio
// ---------------------------------------------------------------------------

export class CareServiceError extends Error {
  constructor(
    public readonly code: CareServiceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'CareServiceError'
  }
}

export enum CareServiceErrorCode {
  NOT_FOUND = 'CARE_PLANT_NOT_FOUND',
  UNKNOWN   = 'CARE_UNKNOWN',
}

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

export interface ICareService {
  updateCareSchedule(plantId: string, care: CareSchedule): Promise<void>
  logCareTask(plantId: string, task: LogCareTaskInput): Promise<CareLog>
  getNextCareDates(plant: Plant): NextCareDates
  getCareHistory(plantId: string): Promise<CareLog[]>
}

// ---------------------------------------------------------------------------
// Implementación con REST API (Neon PostgreSQL)
// ---------------------------------------------------------------------------

export class CareService implements ICareService {
  private readonly baseUrl: string

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = options?.baseUrl || ''
  }

  // ── Actualizar rutina de cuidados ──────────────────────────────────────────

  async updateCareSchedule(plantId: string, care: CareSchedule): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/care`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantId, careSchedule: care }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new CareServiceError(CareServiceErrorCode.UNKNOWN, json.error || `HTTP error ${res.status}`)
      }
    } catch (err) {
      if (err instanceof CareServiceError) throw err
      throw new CareServiceError(
        CareServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al actualizar rutina',
      )
    }
  }

  // ── Registrar tarea realizada ──────────────────────────────────────────────

  async logCareTask(plantId: string, task: LogCareTaskInput): Promise<CareLog> {
    try {
      const res = await fetch(`${this.baseUrl}/api/care`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantId,
          taskType: task.taskType,
          performedAt: task.performedAt,
          notes: task.notes,
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new CareServiceError(CareServiceErrorCode.UNKNOWN, json.error || `HTTP error ${res.status}`)
      }

      return json.careLog as CareLog
    } catch (err) {
      if (err instanceof CareServiceError) throw err
      throw new CareServiceError(
        CareServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al registrar tarea de cuidado',
      )
    }
  }

  // ── Próximas fechas (síncrono) ─────────────────────────────────────────────

  getNextCareDates(plant: Plant): NextCareDates {
    return plant.nextCareDates
  }

  // ── Historial de cuidados ──────────────────────────────────────────────────

  async getCareHistory(plantId: string): Promise<CareLog[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/care?plantId=${encodeURIComponent(plantId)}`)

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new CareServiceError(CareServiceErrorCode.UNKNOWN, json.error || `HTTP error ${res.status}`)
      }

      return (json.careLogs || []) as CareLog[]
    } catch (err) {
      if (err instanceof CareServiceError) throw err
      throw new CareServiceError(
        CareServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al obtener historial de cuidados',
      )
    }
  }
}
