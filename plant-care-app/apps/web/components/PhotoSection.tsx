'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type { Photo, Plant } from '@plant-care/core'
import { getPhotoService, getPlantService } from '@/lib/services'

interface Props {
  plant: Plant
  onUpdated: (updated: Plant) => void
}

export default function PhotoSection({ plant, onUpdated }: Props) {
  const [photos,    setPhotos]    = useState<Photo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [confirm,   setConfirm]   = useState<string | null>(null) // photoId pendiente de borrar
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadPhotos()
  }, [plant.id])

  async function loadPhotos() {
    setLoading(true)
    try {
      const list = await getPhotoService().getPhotos(plant.id)
      setPhotos(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar fotos')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const photo = await getPhotoService().uploadPhoto(plant.id, file)
      setPhotos((prev) => [photo, ...prev])
      setSuccess('Foto subida correctamente')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la foto')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(photoId: string) {
    setError('')
    try {
      await getPhotoService().deletePhoto(photoId)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
      setConfirm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la foto')
    }
  }

  async function handleSetRepresentative(photo: Photo) {
    setError('')
    try {
      await getPhotoService().setRepresentativePhoto(plant.id, photo.id)
      await getPlantService().updatePlant(plant.id, { representativePhotoUrl: photo.url } as never)
      onUpdated({ ...plant, representativePhotoUrl: photo.url })
      setSuccess('Foto representativa actualizada')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al establecer foto representativa')
    }
  }

  return (
    <div>
      {error   && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Confirmación de borrado */}
      {confirm && (
        <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span>¿Eliminar esta foto?</span>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <button onClick={() => void handleDelete(confirm)} className="btn btn-danger btn-sm">Eliminar</button>
            <button onClick={() => setConfirm(null)} className="btn btn-secondary btn-sm">Cancelar</button>
          </div>
        </div>
      )}

      <div className="card-header">
        <h2>Historial fotográfico</h2>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => void handleUpload(e)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn btn-primary btn-sm"
          >
            {uploading ? <><span className="spinner" /> Subiendo…</> : '📷 Subir foto'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-page" style={{ minHeight: 200 }}><span className="spinner" /></div>
      ) : photos.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📸</div>
          <p>No hay fotos aún. ¡Sube la primera!</p>
        </div>
      ) : (
        <div className="photo-grid">
          {photos.map((photo) => (
            <div key={photo.id} className="photo-item">
              <Image
                src={photo.url}
                alt={`Foto del ${new Date(photo.capturedAt).toLocaleDateString('es-ES')}`}
                width={150}
                height={150}
                className="photo-thumb"
                unoptimized
              />
              <div className="photo-item-actions">
                {/* Marcar como representativa */}
                {plant.representativePhotoUrl !== photo.url && (
                  <button
                    title="Marcar como representativa"
                    onClick={() => void handleSetRepresentative(photo)}
                    className="btn btn-icon btn-ghost"
                    style={{ color: 'white', fontSize: '.9rem' }}
                  >
                    ⭐
                  </button>
                )}
                {/* Eliminar */}
                <button
                  title="Eliminar foto"
                  onClick={() => setConfirm(photo.id)}
                  className="btn btn-icon btn-ghost"
                  style={{ color: 'white', fontSize: '.9rem' }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
