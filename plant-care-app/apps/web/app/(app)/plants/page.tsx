'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Plant } from '@plant-care/core'
import { getPlantService } from '@/lib/services'
import { useAuth } from '@/components/AuthProvider'

export default function PlantsPage() {
  const { user } = useAuth()

  const [plants,  setPlants]  = useState<Plant[]>([])
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (user?.id) void loadPlants(user.id)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { void search(user.id, query) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, user?.id])

  async function loadPlants(userId: string) {
    setLoading(true)
    setError('')
    try {
      const data = await getPlantService().getPlants(userId)
      setPlants(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las plantas')
    } finally {
      setLoading(false)
    }
  }

  async function search(userId: string, q: string) {
    if (!q.trim()) { void loadPlants(userId); return }
    setLoading(true)
    try {
      const data = await getPlantService().searchPlants(userId, q.trim())
      setPlants(data)
    } catch {
      // Mantener lista actual si falla la búsqueda
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Mis plantas</h1>
        <Link href="/plants/new" className="btn btn-primary">+ Añadir planta</Link>
      </div>

      <div className="search-bar" style={{ marginBottom: '1.5rem' }}>
        <span className="search-icon">🔍</span>
        <input
          type="search"
          className="form-input"
          placeholder="Buscar por nombre o especie…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-page"><span className="spinner" /> Cargando…</div>
      ) : plants.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🌱</div>
          {query ? (
            <p>No se encontraron plantas para <strong>&quot;{query}&quot;</strong></p>
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
