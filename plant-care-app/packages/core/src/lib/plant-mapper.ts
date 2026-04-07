/**
 * Convierte entre filas de la tabla `plants` (snake_case) y el tipo Plant del dominio (camelCase).
 */
import type { Plant, CareSchedule, NextCareDates, CreatePlantInput, PlantType } from '../models/plant'

// Tipo que representa una fila de la tabla plants tal como viene de Supabase
export interface PlantRow {
  id: string
  user_id: string
  common_name: string
  species: string
  scientific_name: string | null
  acquisition_date: string | null
  plant_type: string | null
  location: string | null
  notes: string | null
  representative_photo_url: string | null
  // CareSchedule
  watering_frequency_days: number | null
  fertilizing_frequency_days: number | null
  fertilizer_type: string | null
  light_needs: string | null
  temperature_min_c: number | null
  temperature_max_c: number | null
  pruning_frequency_months: number | null
  repotting_frequency_months: number | null
  // NextCareDates
  next_watering_date: string | null
  next_fertilizing_date: string | null
  next_pruning_date: string | null
  next_repotting_date: string | null
  // Auditoría
  created_at: string
  updated_at: string
}

export function rowToPlant(row: PlantRow): Plant {
  const careSchedule: CareSchedule = {
    ...(row.watering_frequency_days != null && { wateringFrequencyDays: row.watering_frequency_days }),
    ...(row.fertilizing_frequency_days != null && { fertilizingFrequencyDays: row.fertilizing_frequency_days }),
    ...(row.fertilizer_type != null && { fertilizerType: row.fertilizer_type }),
    ...(row.light_needs != null && { lightNeeds: row.light_needs as CareSchedule['lightNeeds'] }),
    ...(row.temperature_min_c != null && { temperatureMinC: row.temperature_min_c }),
    ...(row.temperature_max_c != null && { temperatureMaxC: row.temperature_max_c }),
    ...(row.pruning_frequency_months != null && { pruningFrequencyMonths: row.pruning_frequency_months }),
    ...(row.repotting_frequency_months != null && { repottingFrequencyMonths: row.repotting_frequency_months }),
  }

  const nextCareDates: NextCareDates = {
    ...(row.next_watering_date != null && { watering: row.next_watering_date }),
    ...(row.next_fertilizing_date != null && { fertilizing: row.next_fertilizing_date }),
    ...(row.next_pruning_date != null && { pruning: row.next_pruning_date }),
    ...(row.next_repotting_date != null && { repotting: row.next_repotting_date }),
  }

  return {
    id: row.id,
    userId: row.user_id,
    commonName: row.common_name,
    species: row.species,
    ...(row.scientific_name != null && { scientificName: row.scientific_name }),
    ...(row.acquisition_date != null && { acquisitionDate: row.acquisition_date }),
    ...(row.plant_type != null && { plantType: row.plant_type as PlantType }),
    ...(row.location != null && { location: row.location as Plant['location'] }),
    ...(row.notes != null && { notes: row.notes }),
    ...(row.representative_photo_url != null && { representativePhotoUrl: row.representative_photo_url }),
    careSchedule,
    nextCareDates,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function plantInputToRow(
  userId: string,
  input: CreatePlantInput,
): Omit<PlantRow, 'id' | 'created_at' | 'updated_at' | 'next_watering_date' | 'next_fertilizing_date' | 'next_pruning_date' | 'next_repotting_date'> {
  const cs = input.careSchedule ?? {}
  return {
    user_id: userId,
    common_name: input.commonName,
    species: input.species,
    scientific_name: input.scientificName ?? null,
    acquisition_date: input.acquisitionDate ?? null,
    plant_type: input.plantType ?? null,
    location: input.location ?? null,
    notes: input.notes ?? null,
    representative_photo_url: null,
    watering_frequency_days: cs.wateringFrequencyDays ?? null,
    fertilizing_frequency_days: cs.fertilizingFrequencyDays ?? null,
    fertilizer_type: cs.fertilizerType ?? null,
    light_needs: cs.lightNeeds ?? null,
    temperature_min_c: cs.temperatureMinC ?? null,
    temperature_max_c: cs.temperatureMaxC ?? null,
    pruning_frequency_months: cs.pruningFrequencyMonths ?? null,
    repotting_frequency_months: cs.repottingFrequencyMonths ?? null,
  }
}

export function careScheduleToRow(cs: Partial<CareSchedule>): Partial<PlantRow> {
  return {
    ...(cs.wateringFrequencyDays !== undefined && { watering_frequency_days: cs.wateringFrequencyDays }),
    ...(cs.fertilizingFrequencyDays !== undefined && { fertilizing_frequency_days: cs.fertilizingFrequencyDays }),
    ...(cs.fertilizerType !== undefined && { fertilizer_type: cs.fertilizerType }),
    ...(cs.lightNeeds !== undefined && { light_needs: cs.lightNeeds }),
    ...(cs.temperatureMinC !== undefined && { temperature_min_c: cs.temperatureMinC }),
    ...(cs.temperatureMaxC !== undefined && { temperature_max_c: cs.temperatureMaxC }),
    ...(cs.pruningFrequencyMonths !== undefined && { pruning_frequency_months: cs.pruningFrequencyMonths }),
    ...(cs.repottingFrequencyMonths !== undefined && { repotting_frequency_months: cs.repottingFrequencyMonths }),
  }
}
