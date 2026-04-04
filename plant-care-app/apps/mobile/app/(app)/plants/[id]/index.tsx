import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import type { Plant } from '@plant-care/core'
import { getPlantService } from '../../../../lib/services'
import { useAuth } from '../../../../components/AuthProvider'
import CareSection    from '../../../../components/CareSection'
import PhotoSection   from '../../../../components/PhotoSection'
import ProblemsSection from '../../../../components/ProblemsSection'
import AISection      from '../../../../components/AISection'

type Tab = 'resumen' | 'cuidados' | 'fotos' | 'problemas' | 'ia'
const TABS: { key: Tab; label: string }[] = [
  { key: 'resumen',   label: 'Resumen'    },
  { key: 'cuidados',  label: 'Cuidados'   },
  { key: 'fotos',     label: 'Fotos'      },
  { key: 'problemas', label: 'Problemas'  },
  { key: 'ia',        label: '🤖 IA'      },
]

export default function PlantDetailScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>()
  const router     = useRouter()
  const { user }   = useAuth()

  const [plant,   setPlant]   = useState<Plant | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<Tab>('resumen')

  const loadPlant = useCallback(async () => {
    if (!id || !user?.id) return
    try {
      const plants = await getPlantService().getPlants(user.id)
      const found  = plants.find((p) => p.id === id)
      if (!found) { router.replace('/(app)/(tabs)/plants'); return }
      setPlant(found)
    } catch {
      Alert.alert('Error', 'No se pudo cargar la planta')
    }
  }, [id, user?.id])

  useEffect(() => {
    void loadPlant().finally(() => setLoading(false))
  }, [loadPlant])

  async function handleDelete() {
    Alert.alert(
      'Eliminar planta',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await getPlantService().deletePlant(id!)
              router.back()
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la planta')
            }
          },
        },
      ],
    )
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
      <Stack.Screen
        options={{
          title:      plant.commonName,
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push(`/(app)/plants/${plant.id}/edit`)} style={{ marginRight: 8 }}>
              <Text style={{ color: '#16a34a', fontSize: 15 }}>Editar</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        {/* Tab bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, tab === t.key && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab content */}
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 32 }}>
          {tab === 'resumen'   && <ResumenTab plant={plant} onDelete={handleDelete} />}
          {tab === 'cuidados'  && <CareSection   plant={plant} onRefresh={loadPlant} />}
          {tab === 'fotos'     && <PhotoSection  plant={plant} onUpdated={setPlant} />}
          {tab === 'problemas' && <ProblemsSection plant={plant} />}
          {tab === 'ia'        && <AISection     plant={plant} />}
        </ScrollView>
      </View>
    </>
  )
}

// ---------------------------------------------------------------------------
// Resumen tab
// ---------------------------------------------------------------------------

function ResumenTab({ plant, onDelete }: { plant: Plant; onDelete: () => void }) {
  const cs = plant.careSchedule

  function row(label: string, value: string | undefined) {
    if (!value) return null
    return (
      <View style={rStyles.row} key={label}>
        <Text style={rStyles.label}>{label}</Text>
        <Text style={rStyles.value}>{value}</Text>
      </View>
    )
  }

  return (
    <View style={rStyles.container}>
      <View style={rStyles.card}>
        <Text style={rStyles.cardTitle}>Información general</Text>
        {row('Nombre común',     plant.commonName)}
        {row('Especie',          plant.species)}
        {row('Nombre científico',plant.scientificName)}
        {row('Ubicación',        plant.location === 'interior' ? '🏠 Interior' : plant.location === 'exterior' ? '☀️ Exterior' : undefined)}
        {row('Adquisición',      plant.acquisitionDate)}
        {!!plant.notes && (
          <View style={rStyles.notesBox}>
            <Text style={rStyles.label}>Notas</Text>
            <Text style={rStyles.notesText}>{plant.notes}</Text>
          </View>
        )}
      </View>

      {Object.values(cs).some(Boolean) && (
        <View style={rStyles.card}>
          <Text style={rStyles.cardTitle}>Programa de cuidados</Text>
          {row('Riego',        cs.wateringFrequencyDays     ? `Cada ${cs.wateringFrequencyDays} días`    : undefined)}
          {row('Fertilizado',  cs.fertilizingFrequencyDays  ? `Cada ${cs.fertilizingFrequencyDays} días` : undefined)}
          {row('Poda',         cs.pruningFrequencyMonths    ? `Cada ${cs.pruningFrequencyMonths} meses`  : undefined)}
          {row('Trasplante',   cs.repottingFrequencyMonths  ? `Cada ${cs.repottingFrequencyMonths} meses`: undefined)}
          {row('Luz',          cs.lightNeeds)}
          {row('Fertilizante', cs.fertilizerType)}
          {(cs.temperatureMinC != null || cs.temperatureMaxC != null) && row(
            'Temperatura',
            `${cs.temperatureMinC ?? '?'}°C – ${cs.temperatureMaxC ?? '?'}°C`,
          )}
        </View>
      )}

      <TouchableOpacity style={rStyles.deleteBtn} onPress={onDelete}>
        <Text style={rStyles.deleteBtnText}>🗑 Eliminar planta</Text>
      </TouchableOpacity>
    </View>
  )
}

const rStyles = StyleSheet.create({
  container:   { padding: 16 },
  card:        { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardTitle:   { fontSize: 14, fontWeight: '600', color: '#16a34a', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  label:       { fontSize: 13, color: '#64748b' },
  value:       { fontSize: 13, color: '#1e293b', fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  notesBox:    { paddingTop: 8 },
  notesText:   { fontSize: 13, color: '#334155', marginTop: 4, lineHeight: 20 },
  deleteBtn:   { marginTop: 8, backgroundColor: '#fee2e2', borderRadius: 10, padding: 14, alignItems: 'center' },
  deleteBtnText:{ color: '#b91c1c', fontWeight: '600', fontSize: 15 },
})

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0fdf4' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdf4' },
  tabBar:         { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', maxHeight: 48, flexGrow: 0 },
  tabBarContent:  { paddingHorizontal: 8, alignItems: 'center' },
  tab:            { paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 2 },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: '#16a34a' },
  tabText:        { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  tabTextActive:  { color: '#16a34a', fontWeight: '700' },
  content:        { flex: 1 },
})
