import type { SupabaseClient } from '@supabase/supabase-js'
import type { Photo } from '../models/photo'
import { getSupabaseClient } from '../lib/supabase-client'

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
// Tipo fila de la tabla photos
// ---------------------------------------------------------------------------

interface PhotoRow {
  id: string
  plant_id: string
  url: string
  storage_path: string
  captured_at: string
  uploaded_at: string
}

function rowToPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    plantId: row.plant_id,
    url: row.url,
    storagePath: row.storage_path,
    capturedAt: row.captured_at,
    uploadedAt: row.uploaded_at,
  }
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
// Implementación
// ---------------------------------------------------------------------------

export class PhotoService implements IPhotoService {
  private readonly db: SupabaseClient

  constructor(client?: SupabaseClient) {
    this.db = client ?? getSupabaseClient()
  }

  // ── Subir foto ─────────────────────────────────────────────────────────────

  async uploadPhoto(plantId: string, file: File | Blob, capturedAt?: string): Promise<Photo> {
    const ext = file instanceof File ? file.name.split('.').pop() ?? 'jpg' : 'jpg'
    const storagePath = `plants/${plantId}/${Date.now()}.${ext}`
    const now = new Date().toISOString()
    const captured = capturedAt ?? now

    // 1. Subir binario a Supabase Storage
    const { error: uploadError } = await this.db.storage
      .from('plant-photos')
      .upload(storagePath, file, { upsert: false })

    if (uploadError) {
      throw new PhotoServiceError(PhotoServiceErrorCode.UPLOAD_FAILED, uploadError.message)
    }

    // 2. Obtener URL pública
    const { data: urlData } = this.db.storage
      .from('plant-photos')
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl

    // 3. Insertar metadatos en la tabla photos
    const { data: photoRow, error: dbError } = await this.db
      .from('photos')
      .insert({
        plant_id: plantId,
        url: publicUrl,
        storage_path: storagePath,
        captured_at: captured,
        uploaded_at: now,
      })
      .select()
      .single()

    if (dbError) {
      throw new PhotoServiceError(PhotoServiceErrorCode.UPLOAD_FAILED, dbError.message)
    }

    return rowToPhoto(photoRow as PhotoRow)
  }

  // ── Eliminar foto ──────────────────────────────────────────────────────────

  async deletePhoto(photoId: string): Promise<void> {
    // 1. Recuperar el storage_path antes de eliminar
    const { data: photoRow, error: fetchError } = await this.db
      .from('photos')
      .select('storage_path')
      .eq('id', photoId)
      .single()

    if (fetchError || !photoRow) {
      throw new PhotoServiceError(PhotoServiceErrorCode.NOT_FOUND, `Foto ${photoId} no encontrada.`)
    }

    const storagePath = (photoRow as { storage_path: string }).storage_path

    // 2. Eliminar de Storage
    const { error: storageError } = await this.db.storage
      .from('plant-photos')
      .remove([storagePath])

    if (storageError) {
      throw new PhotoServiceError(PhotoServiceErrorCode.DELETE_FAILED, storageError.message)
    }

    // 3. Eliminar metadatos de la tabla photos
    const { error: dbError } = await this.db
      .from('photos')
      .delete()
      .eq('id', photoId)

    if (dbError) {
      throw new PhotoServiceError(PhotoServiceErrorCode.DELETE_FAILED, dbError.message)
    }
  }

  // ── Marcar como imagen representativa ─────────────────────────────────────

  async setRepresentativePhoto(plantId: string, photoId: string): Promise<void> {
    // Recuperar la URL de la foto seleccionada
    const { data: photoRow, error: fetchError } = await this.db
      .from('photos')
      .select('url')
      .eq('id', photoId)
      .single()

    if (fetchError || !photoRow) {
      throw new PhotoServiceError(PhotoServiceErrorCode.NOT_FOUND, `Foto ${photoId} no encontrada.`)
    }

    const url = (photoRow as { url: string }).url

    // Actualizar representative_photo_url en plants
    const { error: updateError } = await this.db
      .from('plants')
      .update({ representative_photo_url: url })
      .eq('id', plantId)

    if (updateError) {
      throw new PhotoServiceError(PhotoServiceErrorCode.UNKNOWN, updateError.message)
    }
  }

  // ── Listar fotos (orden cronológico descendente) ───────────────────────────

  async getPhotos(plantId: string): Promise<Photo[]> {
    const { data, error } = await this.db
      .from('photos')
      .select('*')
      .eq('plant_id', plantId)
      .order('captured_at', { ascending: false })

    if (error) throw new PhotoServiceError(PhotoServiceErrorCode.UNKNOWN, error.message)
    return (data as PhotoRow[]).map(rowToPhoto)
  }
}
