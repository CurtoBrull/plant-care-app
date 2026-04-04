import type { Plant } from '../models/plant'
import type { NextCareDates } from '../models/plant'
import type { CareTaskType } from '../models/care-log'

// ---------------------------------------------------------------------------
// Cálculo de próxima fecha (función pura, testeable con PBT)
// ---------------------------------------------------------------------------

/**
 * Calcula la próxima fecha de una tarea de cuidado.
 * Propiedad 5: nextDate === lastDate + frequencyDays (exacto).
 *
 * @param lastDate     Fecha de última realización (ISO date "YYYY-MM-DD")
 * @param frequencyDays Número de días entre tareas (entero > 0)
 * @returns Próxima fecha recomendada en formato "YYYY-MM-DD"
 */
export function calculateNextDate(lastDate: string, frequencyDays: number): string {
  if (frequencyDays <= 0 || !Number.isInteger(frequencyDays)) {
    throw new RangeError(`frequencyDays debe ser un entero positivo, recibido: ${frequencyDays}`)
  }
  // Usamos UTC para evitar desplazamientos de zona horaria en el cálculo
  const [year, month, day] = lastDate.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + frequencyDays)
  return date.toISOString().slice(0, 10)
}

/**
 * Calcula la próxima fecha para meses (poda / trasplante).
 * Suma N meses a la fecha dada, recortando al último día del mes destino
 * si el día original no existe en ese mes (ej: 31-ene + 1 mes → 28-feb).
 */
export function calculateNextDateMonths(lastDate: string, frequencyMonths: number): string {
  if (frequencyMonths <= 0 || !Number.isInteger(frequencyMonths)) {
    throw new RangeError(`frequencyMonths debe ser un entero positivo, recibido: ${frequencyMonths}`)
  }
  const [year, month, day] = lastDate.split('-').map(Number) as [number, number, number]

  // Mes destino en índice base-0
  const totalMonths = (month - 1) + frequencyMonths
  const targetYear  = year + Math.floor(totalMonths / 12)
  const targetMonth = totalMonths % 12   // 0-based

  // Último día del mes destino (día 0 del mes siguiente)
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const clampedDay = Math.min(day, lastDayOfTargetMonth)

  const date = new Date(Date.UTC(targetYear, targetMonth, clampedDay))
  return date.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Columna de next_*_date según tipo de tarea
// ---------------------------------------------------------------------------

export const TASK_NEXT_DATE_COLUMN: Record<CareTaskType, keyof NextCareDates> = {
  watering:    'watering',
  fertilizing: 'fertilizing',
  pruning:     'pruning',
  repotting:   'repotting',
}

// ---------------------------------------------------------------------------
// getDuePlants — filtra plantas con tareas vencidas (usado por el Cron)
// ---------------------------------------------------------------------------

/**
 * Devuelve las plantas cuya próxima fecha de cuidado es ≤ referenceDate.
 * Propiedad 12.
 */
export function getDuePlants(referenceDate: Date, plants: Plant[]): Plant[] {
  const refStr = referenceDate.toISOString().slice(0, 10)
  return plants.filter((plant) => {
    const { watering, fertilizing, pruning, repotting } = plant.nextCareDates
    return (
      (watering    != null && watering    <= refStr) ||
      (fertilizing != null && fertilizing <= refStr) ||
      (pruning     != null && pruning     <= refStr) ||
      (repotting   != null && repotting   <= refStr)
    )
  })
}
