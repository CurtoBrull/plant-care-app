import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import type { Plant, Problem } from '@plant-care/core'
import { getProblemService } from '../lib/services'

interface Props {
  plant: Plant
}

export default function ProblemsSection({ plant }: Props) {
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [type,     setType]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    void getProblemService().getProblems(plant.id)
      .then(setProblems)
      .finally(() => setLoading(false))
  }, [plant.id])

  async function handleCreate() {
    if (!type.trim() || !desc.trim()) {
      Alert.alert('Faltan datos', 'Completa el tipo y la descripción.')
      return
    }
    setSaving(true)
    try {
      const created = await getProblemService().createProblem(plant.id, {
        type: type.trim(),
        description: desc.trim(),
        detectedAt: new Date().toISOString(),
      })
      setProblems((prev) => [created, ...prev])
      setType('')
      setDesc('')
      setShowForm(false)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al crear el problema')
    } finally {
      setSaving(false)
    }
  }

  async function handleResolve(problem: Problem) {
    try {
      await getProblemService().markAsResolved(problem.id)
      setProblems((prev) =>
        prev.map((p) => p.id === problem.id ? { ...p, resolved: true, resolvedAt: new Date().toISOString() } : p),
      )
    } catch {
      Alert.alert('Error', 'No se pudo marcar como resuelto')
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setShowForm((v) => !v)}
      >
        <Text style={styles.addBtnText}>{showForm ? '✕ Cancelar' : '+ Nuevo problema'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.label}>Tipo de problema *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Plaga, enfermedad, hoja amarilla…"
            placeholderTextColor="#94a3b8"
            value={type}
            onChangeText={setType}
          />
          <Text style={styles.label}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe el problema…"
            placeholderTextColor="#94a3b8"
            value={desc}
            onChangeText={setDesc}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={() => void handleCreate()}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnText}>Guardar</Text>}
          </TouchableOpacity>
        </View>
      )}

      {loading
        ? <ActivityIndicator color="#16a34a" style={{ marginTop: 24 }} />
        : problems.length === 0
          ? <Text style={styles.empty}>Sin problemas registrados.</Text>
          : problems.map((p) => (
              <View key={p.id} style={[styles.problemCard, p.resolved && styles.problemResolved]}>
                <View style={styles.problemHeader}>
                  <Text style={styles.problemType}>{p.type}</Text>
                  <Text style={styles.problemDate}>{p.detectedAt.slice(0, 10)}</Text>
                </View>
                <Text style={styles.problemDesc}>{p.description}</Text>
                {p.resolved
                  ? <Text style={styles.resolvedBadge}>✅ Resuelto {p.resolvedAt?.slice(0, 10)}</Text>
                  : (
                    <TouchableOpacity
                      style={styles.resolveBtn}
                      onPress={() => void handleResolve(p)}
                    >
                      <Text style={styles.resolveBtnText}>Marcar como resuelto</Text>
                    </TouchableOpacity>
                  )
                }
              </View>
            ))
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { padding: 16 },
  addBtn:          { backgroundColor: '#dcfce7', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 12 },
  addBtnText:      { color: '#16a34a', fontWeight: '600', fontSize: 14 },
  form:            { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  label:           { fontSize: 13, color: '#64748b', marginBottom: 4 },
  input:           { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#1e293b', marginBottom: 10 },
  textarea:        { minHeight: 72 },
  saveBtn:         { backgroundColor: '#16a34a', borderRadius: 8, padding: 12, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: '#fff', fontWeight: '600' },
  empty:           { color: '#94a3b8', textAlign: 'center', marginTop: 24 },
  problemCard:     { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#fca5a5', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  problemResolved: { borderLeftColor: '#86efac', opacity: 0.8 },
  problemHeader:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  problemType:     { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  problemDate:     { fontSize: 12, color: '#94a3b8' },
  problemDesc:     { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 8 },
  resolvedBadge:   { fontSize: 13, color: '#16a34a', fontWeight: '500' },
  resolveBtn:      { alignSelf: 'flex-start', backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  resolveBtnText:  { color: '#16a34a', fontSize: 13, fontWeight: '500' },
})
