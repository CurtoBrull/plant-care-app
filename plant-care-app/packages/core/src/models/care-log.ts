export type CareTaskType = 'watering' | 'fertilizing' | 'pruning' | 'repotting'

export interface CareLog {
  id: string
  plantId: string
  taskType: CareTaskType
  performedAt: string   // ISO timestamp
  notes?: string
}

export interface LogCareTaskInput {
  taskType: CareTaskType
  performedAt: string
  notes?: string
}
