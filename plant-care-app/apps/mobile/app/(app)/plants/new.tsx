import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native'
import { useRouter, Stack } from 'expo-router'
import type { CreatePlantInput, Plant } from '@plant-care/core'
import { getPhotoService, getPlantService } from '../../../lib/services'
import { useAuth } from '../../../components/AuthProvider'
import PlantForm from '../../../components/PlantForm'
import PlantIdentifier, { type PlantIdentification } from '../../../components/PlantIdentifier'

const apiBase = process.env.EXPO_PUBLIC_API_URL ?? ''

export default function NewPlantScreen() {
  const { user }  = useAuth()
  const router    = useRouter()

  const [prefill,       setPrefill]      = useState<Partial<Plant> | undefined>(undefined)
  const [formKey,       setFormKey]      = useState(0)
  const [identifiedUri, setIdentifiedUri]= useState<string | null>(null)
  const [photoWarning,  setPhotoWarning] = useState('')

  function handleIdentified(data: PlantIdentification, uri: string) {
    setIdentifiedUri(uri)
    setPrefill({
      commonName:     data.commonName,
      species:        data.species,
      scientificName: data.scientificName,
      notes:          data.description,
      location:       data.location,
      careSchedule:   data.careSchedule,
    })
    setFormKey((k) => k + 1)
  }

  async function handleSubmit(input: CreatePlantInput) {
    if (!user?.id) return
    const plant = await getPlantService().createPlant(user.id, input)

    // Upload identification photo as representative if available
    if (identifiedUri) {
      try {
        const blob  = await fetch(identifiedUri).then((r) => r.blob())
        const photo = await getPhotoService().uploadPhoto(plant.id, blob, new Date().toISOString())
        await getPhotoService().setRepresentativePhoto(plant.id, photo.id)
      } catch (photoErr) {
        // Photo is non-critical — plant is created successfully regardless.
        // Log the error and show a brief alert before navigating.
        console.error('[nueva planta] Error al guardar la foto de identificación:', photoErr)
        setPhotoWarning('La planta se creó correctamente, pero no se pudo guardar la foto. Puedes añadirla desde la pestaña Fotos.')
        // Wait briefly so the user sees the warning (or show as Alert)
        Alert.alert(
          'Foto no guardada',
          'La planta se creó correctamente, pero no se pudo guardar la foto. Puedes añadirla manualmente desde la pestaña Fotos.',
          [{ text: 'Entendido' }],
        )
      }
    }

    router.replace(`/(app)/plants/${plant.id}`)
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Nueva planta', headerTintColor: '#16a34a' }} />
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          {!!photoWarning && (
            <View style={styles.warning}>
              <Text style={styles.warningText}>⚠️ {photoWarning}</Text>
            </View>
          )}

          <PlantIdentifier
            apiBase={apiBase}
            onIdentified={handleIdentified}
          />
          <PlantForm
            key={formKey}
            initialValues={prefill}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
          />
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4' },
  inner:     { padding: 16, paddingBottom: 40 },
  warning:   { backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fde047', borderRadius: 8, padding: 12, marginBottom: 12 },
  warningText:{ color: '#854d0e', fontSize: 13, lineHeight: 18 },
})
