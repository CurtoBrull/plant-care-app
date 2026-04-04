import { useEffect, useState } from 'react'
import { View, ScrollView, StyleSheet, ActivityIndicator, Alert, Text } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import type { CreatePlantInput, Plant } from '@plant-care/core'
import { getPlantService } from '../../../../lib/services'
import { useAuth } from '../../../../components/AuthProvider'
import PlantForm from '../../../../components/PlantForm'

export default function EditPlantScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>()
  const router    = useRouter()
  const { user }  = useAuth()

  const [plant,   setPlant]   = useState<Plant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !user?.id) return
    void getPlantService().getPlants(user.id)
      .then((plants) => {
        const found = plants.find((p) => p.id === id)
        if (!found) { Alert.alert('Error', 'Planta no encontrada'); return }
        setPlant(found)
      })
      .catch(() => Alert.alert('Error', 'No se pudo cargar la planta'))
      .finally(() => setLoading(false))
  }, [id, user?.id])

  async function handleSubmit(input: CreatePlantInput) {
    if (!id) return
    await getPlantService().updatePlant(id, input)
    router.back()
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    )
  }

  if (!plant) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#64748b' }}>Planta no encontrada</Text>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Editar planta', headerTintColor: '#16a34a' }} />
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <PlantForm
          initialValues={plant}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
        />
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdf4' },
})
