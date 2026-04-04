'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CreatePlantInput, Plant } from '@plant-care/core'
import { getPlantService } from '@/lib/services'
import { useAuth } from '@/components/AuthProvider'
import PlantForm from '@/components/PlantForm'

export default function EditPlantPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [plant,   setPlant]   = useState<Plant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function load() {
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
    }
    void load()
  }, [user?.id, params.id, router])

  async function handleSubmit(input: CreatePlantInput) {
    if (!plant) return
    setError('')
    try {
      await getPlantService().updatePlant(plant.id, {
        commonName:      input.commonName,
        species:         input.species,
        scientificName:  input.scientificName,
        acquisitionDate: input.acquisitionDate,
        location:        input.location,
        notes:           input.notes,
        careSchedule:    input.careSchedule ?? {},
      })
      router.replace(`/plants/${plant.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar la planta'
      setError(msg)
      throw err
    }
  }

  if (loading) return <div className="loading-page"><span className="spinner" /> Cargando…</div>
  if (!plant)  return null

  return (
    <>
      <div className="page-header">
        <h1>Editar planta</h1>
        <Link href={`/plants/${plant.id}`} className="btn btn-secondary">← Volver</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ maxWidth: 680 }}>
        <PlantForm
          initialValues={plant}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      </div>
    </>
  )
}
