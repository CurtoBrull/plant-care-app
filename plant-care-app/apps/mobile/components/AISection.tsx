import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import type { AnalysisReport, ChatMessage, ChatSession, Plant } from '@plant-care/core'
import { getAIService } from '../lib/services'

interface Props {
  plant: Plant
}

function emptySession(plantId: string): ChatSession {
  return { plantId, messages: [] }
}

export default function AISection({ plant }: Props) {
  const [reports,  setReports]  = useState<AnalysisReport[]>([])
  const [session,  setSession]  = useState<ChatSession>(() => emptySession(plant.id))
  const [text,     setText]     = useState('')
  const [sending,  setSending]  = useState(false)
  const [analyzing,setAnalyzing]= useState(false)
  const scrollRef  = useRef<ScrollView>(null)

  useEffect(() => {
    void getAIService().getAnalysisReports(plant.id).then(setReports)
  }, [plant.id])

  // ── Visual analysis ──────────────────────────────────────────────────────

  async function handleAnalyze() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') {
      Alert.alert('Permisos', 'Necesitamos acceso a las fotos.')
      return
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 })
    if (picked.canceled || !picked.assets[0]) return

    setAnalyzing(true)
    try {
      const report = await getAIService().analyzeImage(plant.id, picked.assets[0].uri)
      setReports((prev) => [report, ...prev])
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo analizar la imagen')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  async function handleSend() {
    const msg = text.trim()
    if (!msg) return
    setText('')
    setSending(true)
    try {
      const { session: newSession } = await getAIService().sendChatMessage(session, msg, plant)
      setSession(newSession)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al enviar mensaje')
    } finally {
      setSending(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* Analysis section */}
        <Text style={styles.sectionTitle}>Análisis visual</Text>
        <TouchableOpacity
          style={[styles.analyzeBtn, analyzing && styles.btnDisabled]}
          onPress={() => void handleAnalyze()}
          disabled={analyzing}
        >
          {analyzing
            ? <><ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} /><Text style={styles.analyzeBtnText}>Analizando…</Text></>
            : <Text style={styles.analyzeBtnText}>🔍 Analizar foto</Text>}
        </TouchableOpacity>

        {reports.map((r) => (
          <View key={r.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportStatus}>Estado: {r.generalStatus}</Text>
              <Text style={styles.reportDate}>{r.createdAt.slice(0, 10)}</Text>
            </View>
            {r.detectedProblems.length > 0 && (
              <View style={styles.reportSection}>
                <Text style={styles.reportLabel}>Problemas detectados</Text>
                {r.detectedProblems.map((p, i) => (
                  <Text key={i} style={styles.reportItem}>• {p}</Text>
                ))}
              </View>
            )}
            {r.recommendations.length > 0 && (
              <View style={styles.reportSection}>
                <Text style={styles.reportLabel}>Recomendaciones</Text>
                {r.recommendations.map((rec, i) => (
                  <Text key={i} style={styles.reportItem}>💡 {rec}</Text>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Chat section */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Chat con IA</Text>
        <View style={styles.chatBox}>
          {session.messages.length === 0
            ? <Text style={styles.chatEmpty}>Haz una pregunta sobre {plant.commonName}…</Text>
            : session.messages.map((msg, i) => (
                <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                  <Text style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
                    {msg.content}
                  </Text>
                </View>
              ))
          }
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.chatInput}
            placeholder="Escribe un mensaje…"
            placeholderTextColor="#94a3b8"
            value={text}
            onChangeText={setText}
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (sending || !text.trim()) && styles.btnDisabled]}
            onPress={() => void handleSend()}
            disabled={sending || !text.trim()}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendBtnText}>➤</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:          { flex: 1, padding: 16 },
  sectionTitle:       { fontSize: 13, fontWeight: '600', color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  analyzeBtn:         { flexDirection: 'row', backgroundColor: '#7c3aed', borderRadius: 10, padding: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  btnDisabled:        { opacity: 0.6 },
  analyzeBtnText:     { color: '#fff', fontWeight: '600', fontSize: 14 },
  reportCard:         { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#7c3aed', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  reportHeader:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reportStatus:       { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  reportDate:         { fontSize: 12, color: '#94a3b8' },
  reportSection:      { marginBottom: 6 },
  reportLabel:        { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 2 },
  reportItem:         { fontSize: 13, color: '#334155', lineHeight: 18 },
  chatBox:            { backgroundColor: '#fff', borderRadius: 12, padding: 12, minHeight: 80, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  chatEmpty:          { color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 8 },
  bubble:             { borderRadius: 12, padding: 10, marginBottom: 8, maxWidth: '85%' },
  bubbleUser:         { alignSelf: 'flex-end', backgroundColor: '#16a34a' },
  bubbleAssistant:    { alignSelf: 'flex-start', backgroundColor: '#f1f5f9' },
  bubbleText:         { fontSize: 14, lineHeight: 20 },
  bubbleTextUser:     { color: '#fff' },
  bubbleTextAssistant:{ color: '#1e293b' },
  inputRow:           { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  chatInput:          { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 14, color: '#1e293b', maxHeight: 100 },
  sendBtn:            { backgroundColor: '#16a34a', borderRadius: 12, padding: 13, justifyContent: 'center', alignItems: 'center' },
  sendBtnText:        { color: '#fff', fontSize: 16, fontWeight: '700' },
})
