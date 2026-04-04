export interface AnalysisReport {
  id: string
  plantId: string
  imageUrl: string
  generalStatus: string
  detectedProblems: string[]
  recommendations: string[]
  createdAt: string     // ISO timestamp
}
