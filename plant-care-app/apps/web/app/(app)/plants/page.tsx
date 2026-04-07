'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Plant, PlantType } from '@plant-care/core'
import { getPlantService } from '@/lib/services'
import { useAuth } from '@/components/AuthProvider'

const PLANT_TYPE_LABELS: Record<PlantType, string> = {
  suculenta: 'Suculenta',
  cactus:    'Cactus',
  tropical:  'Tropical',
  herbácea:  'Herbácea',
  frutal:    'Frutal',
  arbusto:   'Arbusto',
  árbol:     'Árbol',
  acuática:  'Acuática',
  otra:      'Otra',
}

export default function PlantsPage() {
  const { user } = useAuth()

  const [allPlants, setAllPlants] = useState<Plant[]>([])
  const [query,     setQuery]     = useState('')
  const [typeFilter, setTypeFilter] = useState<PlantType | ''>('')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (user?.id) void loadPlants(user.id)
  }, [user?.id])

  // Debounced text search — refetches from server, preserves allPlants
  useEffect(() => {
    if (!user?.id) return
    if (!query.trim()) return  // handled by loadPlants / allPlants directly
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { void searchPlants(user.id, query) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, user?.id])

  async function loadPlants(userId: string) {
    setLoading(true)
    setError('')
    try {
      const data = await getPlantService().getPlants(userId)
      setAllPlants(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las plantas')
    } finally {
      setLoading(false)
    }
  }

  async function searchPlants(userId: string, q: string) {
    setLoading(true)
    try {
      const data = await getPlantService().searchPlants(userId, q.trim())
      setAllPlants(data)
    } catch {
      // Mantener lista actual si falla la búsqueda
    } finally {
      setLoading(false)
    }
  }

  // When query is cleared, reload all plants
  useEffect(() => {
    if (!user?.id || query.trim()) return
    void loadPlants(user.id)
  }, [query, user?.id])

  // Client-side filtering by type on top of current allPlants
  const plants = useMemo(() => {
    if (!typeFilter) return allPlants
    return allPlants.filter((p) => p.plantType === typeFilter)
  }, [allPlants, typeFilter])

  // Only show chips for types present in allPlants
  const activeTypes = useMemo<PlantType[]>(() => {
    const types = allPlants.map((p) => p.plantType).filter((t): t is PlantType => !!t)
    return [...new Set(types)]
  }, [allPlants])

  const hasFilters = !!query || !!typeFilter

  return (
    <>
      <div className="page-header">
        <h1>Mis plantas</h1>
        <Link href="/plants/new" className="btn btn-primary">+ Añadir planta</Link>
      </div>

      <div className="search-bar" style={{ marginBottom: '1rem' }}>
        <span className="search-icon">🔍</span>
        <input
          type="search"
          className="form-input"
          placeholder="Buscar por nombre o especie…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {activeTypes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setTypeFilter('')}
            style={{
              padding: '.3rem .85rem',
              borderRadius: '999px',
              border: '1.5px solid var(--border)',
              background: typeFilter === '' ? 'var(--primary)' : 'transparent',
              color: typeFilter === '' ? '#fff' : 'var(--text)',
              fontSize: '.85rem',
              cursor: 'pointer',
              fontWeight: typeFilter === '' ? 600 : 400,
              transition: 'all .15s',
            }}
          >
            Todas
          </button>
          {activeTypes.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
              style={{
                padding: '.3rem .85rem',
                borderRadius: '999px',
                border: '1.5px solid var(--border)',
                background: typeFilter === type ? 'var(--primary)' : 'transparent',
                color: typeFilter === type ? '#fff' : 'var(--text)',
                fontSize: '.85rem',
                cursor: 'pointer',
                fontWeight: typeFilter === type ? 600 : 400,
                transition: 'all .15s',
              }}
            >
              {PLANT_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-page"><span className="spinner" /> Cargando…</div>
      ) : plants.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🌱</div>
          {hasFilters ? (
            <p>No se encontraron plantas{typeFilter ? ` de tipo <strong>${PLANT_TYPE_LABELS[typeFilter]}</strong>` : ''}{query ? ` para "<strong>${query}</strong>"` : ''}</p>
          ) : (
            <>
              <p>Aún no tienes plantas registradas</p>
              <Link href="/plants/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Añadir mi primera planta
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="plant-grid">
          {plants.map((plant) => (
            <Link key={plant.id} href={`/plants/${plant.id}`} className="plant-card">
              <div className="plant-card-img">
                {plant.representativePhotoUrl ? (
                  <Image
                    src={plant.representativePhotoUrl}
                    alt={plant.commonName}
                    width={220}
                    height={220}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    unoptimized
                  />
                ) : (
                  <span>🪴</span>
                )}
              </div>
              <div className="plant-card-body">
                <div className="plant-card-name">{plant.commonName}</div>
                <div className="plant-card-species">{plant.species}</div>
                {plant.plantType && (
                  <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
                    {PLANT_TYPE_LABELS[plant.plantType]}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
