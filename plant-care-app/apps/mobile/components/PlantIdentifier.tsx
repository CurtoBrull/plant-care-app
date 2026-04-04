import { useState } from 'react'
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'

// Re-use the same shape as the web API response
export interface PlantIdentification {
  commonName:    string
  species:       string
  scientificName?: string
  description?:  string
  location?:     'interior' | 'exterior'
  careSchedule?: {
    wateringFrequencyDays?:    number
    fertilizingFrequencyDays?: number
    fertilizerType?:           string
    lightNeeds?:               'directa' | 'indirecta' | 'sombra'
    temperatureMinC?:          number
    temperatureMaxC?:          number
    pruningFrequencyMonths?:   number
    repottingFrequencyMonths?: number
  }
}

interface Props {
  apiBase:     string                 // Full URL, e.g. https://api.example.com
  onIdentified:(data: PlantIdentification, uri: string) => void
}

export default function PlantIdentifier({ apiBase, onIdentified }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<PlantIdentification | null>(null)

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') {
      Alert.alert('Permisos', 'Necesitamos acceso a las fotos.')
      return
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsEditing: true })
    if (picked.canceled || !picked.assets[0]) return
    setPreview(picked.assets[0].uri)
    setResult(null)
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (perm.status !== 'granted') {
      Alert.alert('Permisos', 'Necesitamos acceso a la cámara.')
      return
    }
    const taken = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true })
    if (taken.canceled || !taken.assets[0]) return
    setPreview(taken.assets[0].uri)
    setResult(null)
  }

  async function identify() {
    if (!preview) return
    setLoading(true)
    try {
      // Build FormData with a React Native–style file object
      const fd = new FormData()
      fd.append('image', {
        uri:  preview,
        name: 'plant.jpg',
        type: 'image/jpeg',
      } as unknown as Blob)

      const res  = await fetch(`${apiBase}/api/ai/identify`, { method: 'POST', body: fd })
      const json = await res.json() as PlantIdentification & { error?: string }
      if (!res.ok) {
        Alert.alert('Error', json.error ?? 'No se pudo identificar la planta')
        return
      }
      setResult(json)
    } catch {
      Alert.alert('Error', 'Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function confirm() {
    if (result && preview) {
      onIdentified(result, preview)
      setResult(null)
      setPreview(null)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>🤖</Text>
        <Text style={styles.title}>Identificar con IA</Text>
        <Text style={styles.subtitle}> — sube una foto y rellenamos el formulario</Text>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btn} onPress={() => void takePhoto()}>
          <Text style={styles.btnText}>📷 Cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void pickImage()}>
          <Text style={styles.btnText}>🖼 Galería</Text>
        </TouchableOpacity>
      </View>

      {preview && (
        <Image source={{ uri: preview }} style={styles.preview} />
      )}

      {preview && !result && (
        <TouchableOpacity
          style={[styles.identifyBtn, loading && styles.btnDisabled]}
          onPress={() => void identify()}
          disabled={loading}
        >
          {loading
            ? <><ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} /><Text style={styles.identifyBtnText}>Identificando…</Text></>
            : <Text style={styles.identifyBtnText}>🔍 Identificar</Text>}
        </TouchableOpacity>
      )}

      {result && (
        <View style={styles.result}>
          <View style={styles.resultHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultName}>{result.commonName}</Text>
              <Text style={styles.resultScientific}>{result.scientificName}</Text>
              {result.description ? <Text style={styles.resultDesc}>{result.description}</Text> : null}
            </View>
            <TouchableOpacity style={styles.useBtn} onPress={confirm}>
              <Text style={styles.useBtnText}>✔ Usar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { backgroundColor: '#f0fdf4', borderWidth: 1.5, borderColor: '#16a34a', borderStyle: 'dashed', borderRadius: 12, padding: 14, marginBottom: 16 },
  header:          { flexDirection: 'row', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' },
  icon:            { fontSize: 20, marginRight: 4 },
  title:           { fontWeight: '700', fontSize: 15, color: '#14532d' },
  subtitle:        { fontSize: 12, color: '#64748b' },
  btnRow:          { flexDirection: 'row', gap: 10, marginBottom: 12 },
  btn:             { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#16a34a', borderRadius: 8, padding: 10, alignItems: 'center' },
  btnText:         { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  preview:         { width: '100%', height: 160, borderRadius: 8, marginBottom: 12, resizeMode: 'cover' },
  identifyBtn:     { flexDirection: 'row', backgroundColor: '#16a34a', borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  btnDisabled:     { opacity: 0.6 },
  identifyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  result:          { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginTop: 8 },
  resultHeader:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  resultName:      { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  resultScientific:{ fontSize: 13, color: '#64748b', fontStyle: 'italic', marginTop: 2 },
  resultDesc:      { fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 18 },
  useBtn:          { backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  useBtnText:      { color: '#fff', fontWeight: '700', fontSize: 13 },
})
