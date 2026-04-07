export type PlantLocation = 'interior' | 'exterior'
export type LightNeeds = 'directa' | 'indirecta' | 'sombra'
export type PlantType = 'suculenta' | 'cactus' | 'tropical' | 'herbácea' | 'frutal' | 'arbusto' | 'árbol' | 'acuática' | 'otra'

export interface CareSchedule {
  wateringFrequencyDays?: number
  fertilizingFrequencyDays?: number
  fertilizerType?: string
  lightNeeds?: LightNeeds
  temperatureMinC?: number
  temperatureMaxC?: number
  pruningFrequencyMonths?: number
  repottingFrequencyMonths?: number
}

export interface NextCareDates {
  watering?: string      // ISO date (YYYY-MM-DD)
  fertilizing?: string
  pruning?: string
  repotting?: string
}

export interface Plant {
  id: string
  userId: string
  commonName: string
  species: string
  scientificName?: string
  acquisitionDate?: string   // ISO date
  plantType?: PlantType
  location?: PlantLocation
  notes?: string
  representativePhotoUrl?: string
  careSchedule: CareSchedule
  nextCareDates: NextCareDates
  createdAt: string          // ISO timestamp
  updatedAt: string          // ISO timestamp
}

export interface CreatePlantInput {
  commonName: string
  species: string
  scientificName?: string
  acquisitionDate?: string
  plantType?: PlantType
  location?: PlantLocation
  notes?: string
  careSchedule?: CareSchedule
}
