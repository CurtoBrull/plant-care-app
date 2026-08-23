import type { Plant, CreatePlantInput, CareSchedule } from '../models/plant'

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
// Implementación con REST API (Neon PostgreSQL)
// ---------------------------------------------------------------------------

export class PlantService implements IPlantService {
  private readonly baseUrl: string

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = options?.baseUrl || ''
  }

  // ── Crear planta ───────────────────────────────────────────────────────────

  async createPlant(userId: string, data: CreatePlantInput): Promise<Plant> {
    if (!data.commonName?.trim()) {
      throw new PlantServiceError(PlantServiceErrorCode.VALIDATION, 'El nombre común es obligatorio.')
    }
    if (!data.species?.trim()) {
      throw new PlantServiceError(PlantServiceErrorCode.VALIDATION, 'La especie es obligatoria.')
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/plants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...data }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new PlantServiceError(
          PlantServiceErrorCode.UNKNOWN,
          json.error || `HTTP error ${res.status}`,
        )
      }

      return json.plant as Plant
    } catch (err) {
      if (err instanceof PlantServiceError) throw err
      throw new PlantServiceError(
        PlantServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al crear la planta',
      )
    }
  }

  // ── Actualizar planta ──────────────────────────────────────────────────────

  async updatePlant(
    plantId: string,
    data: Partial<Plant & { careSchedule: Partial<CareSchedule> }>,
  ): Promise<Plant> {
    try {
      const res = await fetch(`${this.baseUrl}/api/plants/${plantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 404) {
          throw new PlantServiceError(PlantServiceErrorCode.NOT_FOUND, `Planta ${plantId} no encontrada.`)
        }
        throw new PlantServiceError(
          PlantServiceErrorCode.UNKNOWN,
          json.error || `HTTP error ${res.status}`,
        )
      }

      return json.plant as Plant
    } catch (err) {
      if (err instanceof PlantServiceError) throw err
      throw new PlantServiceError(
        PlantServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al actualizar la planta',
      )
    }
  }

  // ── Eliminar planta ────────────────────────────────────────────────────────

  async deletePlant(plantId: string): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/plants/${plantId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new PlantServiceError(
          PlantServiceErrorCode.UNKNOWN,
          json.error || `HTTP error ${res.status}`,
        )
      }
    } catch (err) {
      if (err instanceof PlantServiceError) throw err
      throw new PlantServiceError(
        PlantServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al eliminar la planta',
      )
    }
  }

  // ── Listar plantas del usuario ─────────────────────────────────────────────

  async getPlants(userId: string): Promise<Plant[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/plants?userId=${encodeURIComponent(userId)}`)

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new PlantServiceError(
          PlantServiceErrorCode.UNKNOWN,
          json.error || `HTTP error ${res.status}`,
        )
      }

      return (json.plants || []) as Plant[]
    } catch (err) {
      if (err instanceof PlantServiceError) throw err
      throw new PlantServiceError(
        PlantServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al listar las plantas',
      )
    }
  }

  // ── Buscar plantas (insensible a mayúsculas) ───────────────────────────────

  async searchPlants(userId: string, query: string): Promise<Plant[]> {
    const trimmed = query.trim()
    try {
      const url = `${this.baseUrl}/api/plants?userId=${encodeURIComponent(userId)}${trimmed ? `&search=${encodeURIComponent(trimmed)}` : ''}`
      const res = await fetch(url)

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new PlantServiceError(
          PlantServiceErrorCode.UNKNOWN,
          json.error || `HTTP error ${res.status}`,
        )
      }

      return (json.plants || []) as Plant[]
    } catch (err) {
      if (err instanceof PlantServiceError) throw err
      throw new PlantServiceError(
        PlantServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al buscar plantas',
      )
    }
  }
}
