export interface Photo {
  id: string
  plantId: string
  url: string
  storagePath: string
  capturedAt: string    // ISO timestamp
  uploadedAt: string    // ISO timestamp
}
