import type { SupabaseClient } from '@supabase/supabase-js'
import type { CareSchedule, NextCareDates, Plant } from '../models/plant'
import type { CareLog, LogCareTaskInput, CareTaskType } from '../models/care-log'
import { getSupabaseClient } from '../lib/supabase-client'
import { careScheduleToRow } from '../lib/plant-mapper'
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
// Tipo de fila care_logs
// ---------------------------------------------------------------------------

interface CareLogRow {
  id: string
  plant_id: string
  task_type: string
  performed_at: string
  notes: string | null
}

function rowToCareLog(row: CareLogRow): CareLog {
  return {
    id: row.id,
    plantId: row.plant_id,
    taskType: row.task_type as CareTaskType,
    performedAt: row.performed_at,
    ...(row.notes != null && { notes: row.notes }),
  }
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
// Implementación
// ---------------------------------------------------------------------------

export class CareService implements ICareService {
  private readonly db: SupabaseClient

  constructor(client?: SupabaseClient) {
    this.db = client ?? getSupabaseClient()
  }

  // ── Actualizar rutina de cuidados ──────────────────────────────────────────

  async updateCareSchedule(plantId: string, care: CareSchedule): Promise<void> {
    const updates = careScheduleToRow(care)

    const { error } = await this.db
      .from('plants')
      .update(updates)
      .eq('id', plantId)

    if (error) throw new CareServiceError(CareServiceErrorCode.UNKNOWN, error.message)
  }

  // ── Registrar tarea realizada ──────────────────────────────────────────────

  async logCareTask(plantId: string, task: LogCareTaskInput): Promise<CareLog> {
    // 1. Insertar en care_logs
    const { data: logRow, error: logError } = await this.db
      .from('care_logs')
      .insert({
        plant_id: plantId,
        task_type: task.taskType,
        performed_at: task.performedAt,
        notes: task.notes ?? null,
      })
      .select()
      .single()

    if (logError) throw new CareServiceError(CareServiceErrorCode.UNKNOWN, logError.message)

    // 2. Recuperar la frecuencia actual de la planta para calcular la próxima fecha
    const { data: plantRow, error: plantError } = await this.db
      .from('plants')
      .select(
        'watering_frequency_days, fertilizing_frequency_days, pruning_frequency_months, repotting_frequency_months',
      )
      .eq('id', plantId)
      .single()

    if (plantError) throw new CareServiceError(CareServiceErrorCode.NOT_FOUND, plantError.message)

    // 3. Calcular próxima fecha según tipo de tarea
    const nextDate = this._calcNextDate(task.taskType, task.performedAt, plantRow as Record<string, number | null>)

    // 4. Actualizar next_*_date en la tabla plants
    if (nextDate) {
      const nextDateColumn = `next_${task.taskType}_date` as const
      const { error: updateError } = await this.db
        .from('plants')
        .update({ [nextDateColumn]: nextDate })
        .eq('id', plantId)

      if (updateError) throw new CareServiceError(CareServiceErrorCode.UNKNOWN, updateError.message)
    }

    return rowToCareLog(logRow as CareLogRow)
  }

  // ── Próximas fechas (síncrono) ─────────────────────────────────────────────

  /**
   * Devuelve las nextCareDates ya almacenadas en la planta.
   * Las fechas se calculan y persisten en logCareTask; aquí solo se exponen.
   * Propiedad 5: el cálculo está en calculateNextDate (careUtils).
   */
  getNextCareDates(plant: Plant): NextCareDates {
    return plant.nextCareDates
  }

  // ── Historial de cuidados ──────────────────────────────────────────────────

  async getCareHistory(plantId: string): Promise<CareLog[]> {
    const { data, error } = await this.db
      .from('care_logs')
      .select('*')
      .eq('plant_id', plantId)
      .order('performed_at', { ascending: false })

    if (error) throw new CareServiceError(CareServiceErrorCode.UNKNOWN, error.message)
    return (data as CareLogRow[]).map(rowToCareLog)
  }

  // ── Helper privado ─────────────────────────────────────────────────────────

  private _calcNextDate(
    taskType: CareTaskType,
    performedAt: string,
    plant: Record<string, number | null>,
  ): string | null {
    // performedAt puede ser timestamp ISO; normalizamos a "YYYY-MM-DD"
    const dateStr = performedAt.slice(0, 10)

    switch (taskType) {
      case 'watering': {
        const freq = plant['watering_frequency_days']
        return freq != null ? calculateNextDate(dateStr, freq) : null
      }
      case 'fertilizing': {
        const freq = plant['fertilizing_frequency_days']
        return freq != null ? calculateNextDate(dateStr, freq) : null
      }
      case 'pruning': {
        const freq = plant['pruning_frequency_months']
        return freq != null ? calculateNextDateMonths(dateStr, freq) : null
      }
      case 'repotting': {
        const freq = plant['repotting_frequency_months']
        return freq != null ? calculateNextDateMonths(dateStr, freq) : null
      }
    }
  }
}
