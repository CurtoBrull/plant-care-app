import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native'
import * as Notifications from 'expo-notifications'
import { useAuth } from '../../../components/AuthProvider'
import { getAuthService, getNotificationService } from '../../../lib/services'
import { supabase } from '../../../lib/supabase'

export default function SettingsScreen() {
  const { user }   = useAuth()
  const userId     = user?.id ?? ''

  const [reminderTime,  setReminderTime]  = useState('08:00')
  const [notifStatus,   setNotifStatus]   = useState<string>('desconocido')
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [success,       setSuccess]       = useState('')

  useEffect(() => {
    if (!userId) return
    async function load() {
      try {
        const time = await getNotificationService().getReminderTime(userId)
        if (time) setReminderTime(time)
        const perm = await Notifications.getPermissionsAsync()
        setNotifStatus(perm.status)
      } catch {
        // Use defaults
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [userId])

  async function handleRequestPermission() {
    const { status } = await Notifications.requestPermissionsAsync()
    setNotifStatus(status)
    if (status === 'granted') {
      showSuccess('Notificaciones activadas')
    } else {
      Alert.alert('Permisos denegados', 'Activa las notificaciones en los ajustes del sistema.')
    }
  }

  async function handleSaveTime() {
    if (!userId) return
    setSaving(true)
    try {
      await getNotificationService().setReminderTime(userId, reminderTime)
      showSuccess('Hora guardada')
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut()
    } catch {
      // Ignore errors
    }
  }

  function showSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Ajustes</Text>
      </View>

      {!!success && <Text style={styles.success}>{success}</Text>}

      {/* Account */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cuenta</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Correo</Text>
          <Text style={styles.rowValue}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={() => void handleSignOut()}>
          <Text style={styles.signOutBtnText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notificaciones</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Estado del sistema</Text>
          <Text style={[
            styles.rowValue,
            notifStatus === 'granted' ? styles.statusGranted : styles.statusDenied,
          ]}>
            {notifStatus === 'granted' ? '✅ Activadas' : '⛔ ' + notifStatus}
          </Text>
        </View>
        {notifStatus !== 'granted' && (
          <TouchableOpacity style={styles.permBtn} onPress={() => void handleRequestPermission()}>
            <Text style={styles.permBtnText}>Activar notificaciones</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Reminder time */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hora del recordatorio diario</Text>
        <View style={styles.timeRow}>
          <TextInput
            style={styles.timeInput}
            value={reminderTime}
            onChangeText={setReminderTime}
            placeholder="HH:MM"
            placeholderTextColor="#94a3b8"
            keyboardType="numbers-and-punctuation"
          />
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={() => void handleSaveTime()}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnText}>Guardar</Text>}
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>El recordatorio se envía una vez al día para las plantas con tareas vencidas.</Text>
      </View>

      {/* Snooze info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Posponer recordatorio</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 El posponer un recordatorio específico está disponible desde el perfil de cada planta, en la pestaña <Text style={{ fontWeight: '700' }}>Cuidados</Text>.
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f0fdf4' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdf4' },
  header:       { padding: 16, paddingTop: 56 },
  title:        { fontSize: 22, fontWeight: '700', color: '#14532d' },
  success:      { backgroundColor: '#dcfce7', color: '#166534', padding: 12, borderRadius: 8, marginHorizontal: 16, marginBottom: 8, fontSize: 14 },
  card:         { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardTitle:    { fontSize: 13, fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowLabel:     { fontSize: 14, color: '#475569' },
  rowValue:     { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  statusGranted:{ color: '#16a34a' },
  statusDenied: { color: '#dc2626' },
  permBtn:      { marginTop: 10, backgroundColor: '#16a34a', borderRadius: 9, padding: 11, alignItems: 'center' },
  permBtnText:  { color: '#fff', fontWeight: '600' },
  timeRow:      { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 8 },
  timeInput:    { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 9, padding: 11, fontSize: 16, color: '#1e293b' },
  saveBtn:      { backgroundColor: '#16a34a', borderRadius: 9, paddingHorizontal: 20, paddingVertical: 11 },
  btnDisabled:  { opacity: 0.6 },
  saveBtnText:  { color: '#fff', fontWeight: '600' },
  hint:         { fontSize: 12, color: '#94a3b8', lineHeight: 18 },
  infoBox:      { backgroundColor: '#fefce8', borderRadius: 8, padding: 12 },
  infoText:     { fontSize: 13, color: '#92400e', lineHeight: 20 },
  signOutBtn:   { marginTop: 12, backgroundColor: '#fee2e2', borderRadius: 9, padding: 11, alignItems: 'center' },
  signOutBtnText:{ color: '#b91c1c', fontWeight: '600' },
})
