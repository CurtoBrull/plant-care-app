import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import type { CareLog, CareTaskType, Plant } from '@plant-care/core'
import { getCareService } from '../lib/services'

interface Props {
  plant:     Plant
  onRefresh: () => Promise<void>
}

const TASK_LABELS: Record<CareTaskType, string> = {
  watering:    '💧 Riego',
  fertilizing: '🌱 Fertilizado',
  pruning:     '✂️ Poda',
  repotting:   '🪴 Trasplante',
}

const TASK_KEYS: CareTaskType[] = ['watering', 'fertilizing', 'pruning', 'repotting']

export default function CareSection({ plant, onRefresh }: Props) {
  const [history,  setHistory]  = useState<CareLog[]>([])
  const [loading,  setLoading]  = useState(true)
  const [logging,  setLogging]  = useState<CareTaskType | null>(null)

  useEffect(() => {
    void getCareService().getCareHistory(plant.id)
      .then(setHistory)
      .finally(() => setLoading(false))
  }, [plant.id])

  const next = getCareService().getNextCareDates(plant)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  function isDue(dateStr?: string): boolean {
    if (!dateStr) return false
    return new Date(dateStr) <= today
  }

  function nextMap(): Record<CareTaskType, string | undefined> {
    return {
      watering:    next.watering,
      fertilizing: next.fertilizing,
      pruning:     next.pruning,
      repotting:   next.repotting,
    }
  }

  async function logTask(taskType: CareTaskType) {
    setLogging(taskType)
    try {
      const log = await getCareService().logCareTask(plant.id, {
        taskType,
        performedAt: new Date().toISOString(),
      })
      setHistory((prev) => [log, ...prev])
      await onRefresh()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo registrar la tarea')
    } finally {
      setLogging(null)
    }
  }

  return (
    <View style={styles.container}>
      {/* Due tasks */}
      <Text style={styles.sectionTitle}>Registrar tarea</Text>
      <View style={styles.card}>
        {TASK_KEYS.map((taskType) => {
          const dateStr = nextMap()[taskType]
          const due     = isDue(dateStr)
          return (
            <View key={taskType} style={styles.taskRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.taskLabel}>{TASK_LABELS[taskType]}</Text>
                {dateStr && (
                  <Text style={[styles.taskDate, due && styles.taskDateDue]}>
                    {due ? '⚠️ Vencido: ' : 'Próximo: '}{dateStr}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.logBtn, logging === taskType && styles.logBtnDisabled]}
                onPress={() => void logTask(taskType)}
                disabled={logging !== null}
              >
                {logging === taskType
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.logBtnText}>✓ Hecho</Text>}
              </TouchableOpacity>
            </View>
          )
        })}
      </View>

      {/* History */}
      <Text style={styles.sectionTitle}>Historial reciente</Text>
      {loading
        ? <ActivityIndicator color="#16a34a" style={{ marginTop: 16 }} />
        : history.length === 0
          ? <Text style={styles.empty}>Sin registros todavía.</Text>
          : history.slice(0, 20).map((log) => (
              <View key={log.id} style={styles.historyRow}>
                <Text style={styles.historyTask}>{TASK_LABELS[log.taskType]}</Text>
                <Text style={styles.historyDate}>{log.performedAt.slice(0, 10)}</Text>
              </View>
            ))
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { padding: 16 },
  sectionTitle:   { fontSize: 13, fontWeight: '600', color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  card:           { backgroundColor: '#fff', borderRadius: 12, padding: 8, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  taskRow:        { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  taskLabel:      { fontSize: 14, fontWeight: '500', color: '#1e293b' },
  taskDate:       { fontSize: 12, color: '#64748b', marginTop: 2 },
  taskDateDue:    { color: '#dc2626' },
  logBtn:         { backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  logBtnDisabled: { opacity: 0.6 },
  logBtnText:     { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty:          { color: '#94a3b8', textAlign: 'center', marginTop: 16 },
  historyRow:     { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 6 },
  historyTask:    { fontSize: 13, color: '#1e293b' },
  historyDate:    { fontSize: 13, color: '#64748b' },
})
