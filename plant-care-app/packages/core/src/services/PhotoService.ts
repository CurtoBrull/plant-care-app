import type { Photo } from '../models/photo'

// ---------------------------------------------------------------------------
// Errores de dominio
// ---------------------------------------------------------------------------

export class PhotoServiceError extends Error {
  constructor(
    public readonly code: PhotoServiceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PhotoServiceError'
  }
}

export enum PhotoServiceErrorCode {
  UPLOAD_FAILED   = 'PHOTO_UPLOAD_FAILED',
  DELETE_FAILED   = 'PHOTO_DELETE_FAILED',
  NOT_FOUND       = 'PHOTO_NOT_FOUND',
  UNKNOWN         = 'PHOTO_UNKNOWN',
}

// ---------------------------------------------------------------------------
// Interfaz pública
// ---------------------------------------------------------------------------

export interface IPhotoService {
  uploadPhoto(plantId: string, file: File | Blob, capturedAt?: string): Promise<Photo>
  deletePhoto(photoId: string): Promise<void>
  setRepresentativePhoto(plantId: string, photoId: string): Promise<void>
  getPhotos(plantId: string): Promise<Photo[]>
}

// ---------------------------------------------------------------------------
// Implementación con API Serverless (Vercel Blob + Neon PostgreSQL)
// ---------------------------------------------------------------------------

export class PhotoService implements IPhotoService {
  private readonly baseUrl: string

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = options?.baseUrl || ''
  }

  // ── Subir foto ─────────────────────────────────────────────────────────────

  async uploadPhoto(plantId: string, file: File | Blob, capturedAt?: string): Promise<Photo> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('plantId', plantId)
      if (capturedAt) {
        formData.append('capturedAt', capturedAt)
      }

      const res = await fetch(`${this.baseUrl}/api/photos/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP error ${res.status}`)
      }

      const data = await res.json()
      return data.photo as Photo
    } catch (err) {
      throw new PhotoServiceError(
        PhotoServiceErrorCode.UPLOAD_FAILED,
        err instanceof Error ? err.message : 'Error al subir foto',
      )
    }
  }

  // ── Eliminar foto ──────────────────────────────────────────────────────────

  async deletePhoto(photoId: string): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/photos/${photoId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP error ${res.status}`)
      }
    } catch (err) {
      throw new PhotoServiceError(
        PhotoServiceErrorCode.DELETE_FAILED,
        err instanceof Error ? err.message : 'Error al eliminar foto',
      )
    }
  }

  // ── Marcar como imagen representativa ─────────────────────────────────────

  async setRepresentativePhoto(plantId: string, photoId: string): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantId }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP error ${res.status}`)
      }
    } catch (err) {
      throw new PhotoServiceError(
        PhotoServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al establecer foto representativa',
      )
    }
  }

  // ── Listar fotos ───────────────────────────────────────────────────────────

  async getPhotos(plantId: string): Promise<Photo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/photos?plantId=${encodeURIComponent(plantId)}`)

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP error ${res.status}`)
      }

      const data = await res.json()
      return (data.photos || []) as Photo[]
    } catch (err) {
      throw new PhotoServiceError(
        PhotoServiceErrorCode.UNKNOWN,
        err instanceof Error ? err.message : 'Error al obtener fotos',
      )
    }
  }
}
