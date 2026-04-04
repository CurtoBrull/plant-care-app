import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import type { Plant } from '@plant-care/core'
import { useAuth } from '../../../../components/AuthProvider'
import { getPlantService } from '../../../../lib/services'

export default function PlantsScreen() {
  const { user }   = useAuth()
  const router     = useRouter()

  const [plants,    setPlants]    = useState<Plant[]>([])
  const [query,     setQuery]     = useState('')
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)

  const load = useCallback(async (q = '') => {
    if (!user?.id) return
    try {
      const result = q.trim()
        ? await getPlantService().searchPlants(user.id, q.trim())
        : await getPlantService().getPlants(user.id)
      setPlants(result)
    } catch {
      // silently fail on refresh
    }
  }, [user?.id])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => void load(query), 300)
    return () => clearTimeout(t)
  }, [query, load])

  async function handleRefresh() {
    setRefreshing(true)
    await load(query)
    setRefreshing(false)
  }

  function dueLabel(plant: Plant): string {
    try {
      const { getCareService } = require('../../../../lib/services') as typeof import('../../../../lib/services')
      const next = getCareService().getNextCareDates(plant)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dates = [next.watering, next.fertilizing, next.pruning, next.repotting]
        .filter(Boolean) as string[]
      const overdue = dates.some(d => new Date(d) <= today)
      return overdue ? '🔴 Tareas pendientes' : '✅ Al día'
    } catch {
      return ''
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mis plantas</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(app)/plants/new')}
        >
          <Text style={styles.addBtnText}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar plantas…"
        placeholderTextColor="#94a3b8"
        value={query}
        onChangeText={setQuery}
      />

      {/* List */}
      <FlatList
        data={plants}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor="#16a34a" />}
        contentContainerStyle={plants.length === 0 ? styles.emptyContainer : { paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Text style={styles.emptyEmoji}>🪴</Text>
            <Text style={styles.emptyTitle}>
              {query ? 'Sin resultados' : 'Todavía no tienes plantas'}
            </Text>
            {!query && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/(app)/plants/new')}
              >
                <Text style={styles.emptyBtnText}>Añadir primera planta</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(app)/plants/${item.id}`)}
          >
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.commonName}</Text>
                <Text style={styles.cardSpecies}>{item.species}</Text>
                {item.location && (
                  <Text style={styles.cardLocation}>
                    {item.location === 'interior' ? '🏠 Interior' : '☀️ Exterior'}
                  </Text>
                )}
              </View>
              <Text style={styles.cardDue}>{dueLabel(item)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f0fdf4' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdf4' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  title:          { fontSize: 22, fontWeight: '700', color: '#14532d' },
  addBtn:         { backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText:     { color: '#fff', fontWeight: '600', fontSize: 14 },
  searchInput:    { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1fae5', borderRadius: 10, padding: 12, fontSize: 15, color: '#1e293b' },
  emptyContainer: { flexGrow: 1 },
  emptyInner:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyEmoji:     { fontSize: 56, marginBottom: 12 },
  emptyTitle:     { fontSize: 16, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  emptyBtn:       { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText:   { color: '#fff', fontWeight: '700' },
  card:           { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardRow:        { flexDirection: 'row', alignItems: 'center' },
  cardName:       { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  cardSpecies:    { fontSize: 13, color: '#64748b', marginTop: 2 },
  cardLocation:   { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  cardDue:        { fontSize: 12, marginLeft: 8, textAlign: 'right' },
})
