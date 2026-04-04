import type { SupabaseClient } from '@supabase/supabase-js'
import type { Plant, CreatePlantInput } from '../models/plant'
import type { CareSchedule } from '../models/plant'
import { getSupabaseClient } from '../lib/supabase-client'
import { rowToPlant, plantInputToRow, careScheduleToRow, type PlantRow } from '../lib/plant-mapper'

// ---------------------------------------------------------------------------
// Errores de dominio
// ---------------------------------------------------------------------------

export class PlantServiceError extends Error {
  constructor(
    public readonly code: PlantServiceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PlantServiceError'
  }
}

export enum PlantServiceErrorCode {
  NOT_FOUND      = 'PLANT_NOT_FOUND',
  FORBIDDEN      = 'PLANT_FORBIDDEN',
  VALIDATION     = 'PLANT_VALIDATION',
  UNKNOWN        = 'PLANT_UNKNOWN',
}

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

export interface IPlantService {
  createPlant(userId: string, data: CreatePlantInput): Promise<Plant>
  updatePlant(plantId: string, data: Partial<Plant & { careSchedule: Partial<CareSchedule> }>): Promise<Plant>
  deletePlant(plantId: string): Promise<void>
  getPlants(userId: string): Promise<Plant[]>
  searchPlants(userId: string, query: string): Promise<Plant[]>
}

// ---------------------------------------------------------------------------
// Implementación
// ---------------------------------------------------------------------------

export class PlantService implements IPlantService {
  private readonly db: SupabaseClient

  constructor(client?: SupabaseClient) {
    this.db = client ?? getSupabaseClient()
  }

  // ── Crear planta ───────────────────────────────────────────────────────────

  async createPlant(userId: string, data: CreatePlantInput): Promise<Plant> {
    if (!data.commonName?.trim()) {
      throw new PlantServiceError(PlantServiceErrorCode.VALIDATION, 'El nombre común es obligatorio.')
    }
    if (!data.species?.trim()) {
      throw new PlantServiceError(PlantServiceErrorCode.VALIDATION, 'La especie es obligatoria.')
    }

    const row = plantInputToRow(userId, data)
    const { data: inserted, error } = await this.db
      .from('plants')
      .insert(row)
      .select()
      .single()

    if (error) throw new PlantServiceError(PlantServiceErrorCode.UNKNOWN, error.message)
    return rowToPlant(inserted as PlantRow)
  }

  // ── Actualizar planta ──────────────────────────────────────────────────────

  async updatePlant(
    plantId: string,
    data: Partial<Plant & { careSchedule: Partial<CareSchedule> }>,
  ): Promise<Plant> {
    // Construye el objeto de actualización en snake_case
    const updates: Partial<PlantRow> = {
      ...(data.commonName !== undefined && { common_name: data.commonName }),
      ...(data.species !== undefined && { species: data.species }),
      ...(data.scientificName !== undefined && { scientific_name: data.scientificName }),
      ...(data.acquisitionDate !== undefined && { acquisition_date: data.acquisitionDate }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.representativePhotoUrl !== undefined && { representative_photo_url: data.representativePhotoUrl }),
      ...(data.careSchedule !== undefined && careScheduleToRow(data.careSchedule)),
      ...(data.nextCareDates?.watering !== undefined && { next_watering_date: data.nextCareDates.watering }),
      ...(data.nextCareDates?.fertilizing !== undefined && { next_fertilizing_date: data.nextCareDates.fertilizing }),
      ...(data.nextCareDates?.pruning !== undefined && { next_pruning_date: data.nextCareDates.pruning }),
      ...(data.nextCareDates?.repotting !== undefined && { next_repotting_date: data.nextCareDates.repotting }),
    }

    const { data: updated, error } = await this.db
      .from('plants')
      .update(updates)
      .eq('id', plantId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        throw new PlantServiceError(PlantServiceErrorCode.NOT_FOUND, `Planta ${plantId} no encontrada.`)
      }
      throw new PlantServiceError(PlantServiceErrorCode.UNKNOWN, error.message)
    }

    return rowToPlant(updated as PlantRow)
  }

  // ── Eliminar planta ────────────────────────────────────────────────────────

  async deletePlant(plantId: string): Promise<void> {
    const { error } = await this.db
      .from('plants')
      .delete()
      .eq('id', plantId)

    if (error) throw new PlantServiceError(PlantServiceErrorCode.UNKNOWN, error.message)
  }

  // ── Listar plantas del usuario ─────────────────────────────────────────────

  async getPlants(userId: string): Promise<Plant[]> {
    const { data, error } = await this.db
      .from('plants')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new PlantServiceError(PlantServiceErrorCode.UNKNOWN, error.message)
    return (data as PlantRow[]).map(rowToPlant)
  }

  // ── Buscar plantas (insensible a mayúsculas) ───────────────────────────────

  async searchPlants(userId: string, query: string): Promise<Plant[]> {
    const trimmed = query.trim()
    if (!trimmed) return this.getPlants(userId)

    const { data, error } = await this.db
      .from('plants')
      .select('*')
      .eq('user_id', userId)
      .or(`common_name.ilike.%${trimmed}%,species.ilike.%${trimmed}%`)
      .order('created_at', { ascending: false })

    if (error) throw new PlantServiceError(PlantServiceErrorCode.UNKNOWN, error.message)
    return (data as PlantRow[]).map(rowToPlant)
  }
}
