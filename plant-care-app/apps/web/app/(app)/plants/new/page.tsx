'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CreatePlantInput, Plant } from '@plant-care/core'
import { getPhotoService, getPlantService } from '@/lib/services'
import { useAuth } from '@/components/AuthProvider'
import PlantForm from '@/components/PlantForm'
import PlantIdentifier from '@/components/PlantIdentifier'
import type { PlantIdentification } from '@/app/api/ai/identify/route'

type AIHints = { location?: 'interior' | 'exterior'; lightNeeds?: 'directa' | 'indirecta' | 'sombra'; fertilizerType?: string }

export default function NewPlantPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [error,          setError]          = useState('')
  const [photoWarning,   setPhotoWarning]   = useState('')
  const [prefill,        setPrefill]        = useState<Partial<Plant> | undefined>(undefined)
  const [aiHints,        setAiHints]        = useState<AIHints | undefined>(undefined)
  const [formKey,        setFormKey]        = useState(0)
  const [identifiedFile, setIdentifiedFile] = useState<File | null>(null)

  function handleIdentified(data: PlantIdentification, file: File) {
    setIdentifiedFile(file)
    setPrefill({
      commonName: data.commonName,
      species: data.species,
      scientificName: data.scientificName,
      notes: data.description,
      location: data.location,
      careSchedule: data.careSchedule,
    })
    setAiHints({
      location: data.location,
      lightNeeds: data.careSchedule?.lightNeeds,
      fertilizerType: data.careSchedule?.fertilizerType,
    })
    setFormKey((k) => k + 1)
  }

  async function handleSubmit(input: CreatePlantInput) {
    if (!user?.id) return
    setError('')
    try {
      const plant = await getPlantService().createPlant(user.id, input)

      // Si hay foto de identificación, subirla y marcarla como representativa
      if (identifiedFile) {
        try {
          const photo = await getPhotoService().uploadPhoto(plant.id, identifiedFile)
          await getPhotoService().setRepresentativePhoto(plant.id, photo.id)
        } catch (photoErr) {
          // La foto no es crítica — la planta se crea igualmente,
          // pero informamos al usuario para que pueda añadirla manualmente.
          console.error('[nueva planta] Error al guardar la foto de identificación:', photoErr)
          setPhotoWarning('La planta se creó correctamente, pero no se pudo guardar la foto. Puedes añadirla desde la pestaña Fotos.')
          // Pequeña pausa para que el usuario vea el aviso antes de navegar
          await new Promise((resolve) => setTimeout(resolve, 2500))
        }
      }

      router.replace(`/plants/${plant.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear la planta'
      setError(msg)
      throw err
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Nueva planta</h1>
        <Link href="/plants" className="btn btn-secondary">← Volver</Link>
      </div>

      {error       && <div className="alert alert-error">{error}</div>}
      {photoWarning && <div className="alert alert-warning" style={{ background: '#fefce8', border: '1px solid #fde047', color: '#854d0e' }}>⚠️ {photoWarning}</div>}

      <div style={{ maxWidth: 680 }}>
        <PlantIdentifier onIdentified={handleIdentified} />

        <div className="card">
          <PlantForm key={formKey} initialValues={prefill} aiHints={aiHints} onSubmit={handleSubmit} onCancel={() => router.back()} />
        </div>
      </div>
    </>
  )
}
