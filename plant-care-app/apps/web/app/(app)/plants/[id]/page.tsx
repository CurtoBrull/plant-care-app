'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Plant } from '@plant-care/core'
import { getPlantService } from '@/lib/services'
import { useAuth } from '@/components/AuthProvider'
import CareSection     from '@/components/CareSection'
import PhotoSection    from '@/components/PhotoSection'
import ProblemsSection from '@/components/ProblemsSection'
import AISection       from '@/components/AISection'

type Tab = 'resumen' | 'cuidados' | 'fotos' | 'problemas' | 'ia'

const TABS: { key: Tab; label: string }[] = [
  { key: 'resumen',   label: '📋 Resumen'   },
  { key: 'cuidados',  label: '💧 Cuidados'  },
  { key: 'fotos',     label: '📸 Fotos'     },
  { key: 'problemas', label: '🐛 Problemas' },
  { key: 'ia',        label: '🤖 IA'        },
]

const locationLabel: Record<string, string> = { interior: 'Interior', exterior: 'Exterior' }
const lightLabel:    Record<string, string> = { directa: 'Directa', indirecta: 'Indirecta', sombra: 'Sombra' }

export default function PlantPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [plant,    setPlant]    = useState<Plant | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [tab,      setTab]      = useState<Tab>('resumen')
  const [confirm,  setConfirm]  = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadPlant = useCallback(async () => {
    if (!user?.id) return
    try {
      const plants = await getPlantService().getPlants(user.id)
      const found  = plants.find((p) => p.id === params.id)
      if (!found) { router.replace('/plants'); return }
      setPlant(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la planta')
    } finally {
      setLoading(false)
    }
  }, [user?.id, params.id, router])

  useEffect(() => {
    void loadPlant()
  }, [loadPlant])

  async function handleDelete() {
    if (!plant) return
    setDeleting(true)
    try {
      await getPlantService().deletePlant(plant.id)
      router.replace('/plants')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la planta')
      setDeleting(false)
      setConfirm(false)
    }
  }

  if (loading) return <div className="loading-page"><span className="spinner" /> Cargando…</div>
  if (error)   return <div className="alert alert-error">{error}</div>
  if (!plant)  return null

  const cs = plant.careSchedule

  return (
    <>
      {/* ── Header de perfil ── */}
      <div className="plant-profile-header">
        <div className="plant-profile-img">
          {plant.representativePhotoUrl ? (
            <Image
              src={plant.representativePhotoUrl}
              alt={plant.commonName}
              width={120} height={120}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius)' }}
              unoptimized
            />
          ) : '🪴'}
        </div>
        <div className="plant-profile-meta" style={{ flex: 1 }}>
          <h1>{plant.commonName}</h1>
          <p className="species">{plant.species}</p>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            {plant.location && (
              <span className="badge badge-green">{locationLabel[plant.location] ?? plant.location}</span>
            )}
            {cs?.lightNeeds && (
              <span className="badge badge-yellow">{lightLabel[cs.lightNeeds] ?? cs.lightNeeds}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', flexShrink: 0 }}>
          <Link href={`/plants/${plant.id}/edit`} className="btn btn-secondary btn-sm">✏️ Editar</Link>
          <button onClick={() => setConfirm(true)} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>
            🗑️ Eliminar
          </button>
        </div>
      </div>

      {/* ── Modal de confirmación de borrado ── */}
      {confirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div className="card" style={{ maxWidth: 360, width: '90%' }}>
            <h2 style={{ marginBottom: '.75rem' }}>¿Eliminar planta?</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Se eliminarán <strong>{plant.commonName}</strong> y todos sus datos. No se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirm(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={() => void handleDelete()} disabled={deleting} className="btn btn-danger">
                {deleting ? <span className="spinner" /> : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="tabs">
        {TABS.map(({ key, label }) => (
          <button key={key} className={`tab-btn${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Contenido ── */}

      {tab === 'resumen' && (
        <div className="card">
          <div className="info-grid">
            {plant.location && (
              <div className="info-item">
                <p className="info-label">Ubicación</p>
                <p className="info-value">{locationLabel[plant.location] ?? plant.location}</p>
              </div>
            )}
            {cs?.lightNeeds && (
              <div className="info-item">
                <p className="info-label">Luz</p>
                <p className="info-value">{lightLabel[cs.lightNeeds] ?? cs.lightNeeds}</p>
              </div>
            )}
            {(cs?.temperatureMinC !== undefined || cs?.temperatureMaxC !== undefined) && (
              <div className="info-item">
                <p className="info-label">Temperatura</p>
                <p className="info-value">
                  {cs?.temperatureMinC !== undefined ? `${cs.temperatureMinC}°C` : '?'}
                  {' – '}
                  {cs?.temperatureMaxC !== undefined ? `${cs.temperatureMaxC}°C` : '?'}
                </p>
              </div>
            )}
            {plant.scientificName && (
              <div className="info-item">
                <p className="info-label">Nombre científico</p>
                <p className="info-value" style={{ fontStyle: 'italic' }}>{plant.scientificName}</p>
              </div>
            )}
            {plant.acquisitionDate && (
              <div className="info-item">
                <p className="info-label">Adquirida el</p>
                <p className="info-value">{new Date(plant.acquisitionDate).toLocaleDateString('es-ES')}</p>
              </div>
            )}
          </div>
          {plant.notes && (
            <>
              <div className="divider" />
              <p className="info-label">Notas</p>
              <p style={{ marginTop: '.25rem', whiteSpace: 'pre-wrap' }}>{plant.notes}</p>
            </>
          )}
          <div className="divider" />
          <p style={{ fontSize: '.8125rem', color: 'var(--text-muted)' }}>
            Añadida el {new Date(plant.createdAt).toLocaleDateString('es-ES')}
          </p>
        </div>
      )}

      {tab === 'cuidados' && (
        <div className="card">
          <CareSection plant={plant} onRefresh={loadPlant} />
        </div>
      )}

      {tab === 'fotos' && (
        <div className="card">
          <PhotoSection plant={plant} onUpdated={setPlant} />
        </div>
      )}

      {tab === 'problemas' && (
        <div className="card">
          <ProblemsSection plantId={plant.id} />
        </div>
      )}

      {tab === 'ia' && (
        <div className="card">
          <AISection plant={plant} />
        </div>
      )}
    </>
  )
}
