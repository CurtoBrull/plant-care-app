export interface Problem {
  id: string
  plantId: string
  type: string
  description: string
  detectedAt: string    // ISO timestamp
  imageUrl?: string
  resolved: boolean
  resolvedAt?: string   // ISO timestamp
}

export interface CreateProblemInput {
  type: string
  description: string
  detectedAt: string
  imageUrl?: string
}
