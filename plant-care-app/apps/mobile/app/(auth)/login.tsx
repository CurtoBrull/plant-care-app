import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native'
import { Link } from 'expo-router'
import { getAuthService } from '../../lib/services'

export default function LoginScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleLogin() {
    if (!email.trim() || !password) return
    setError('')
    setLoading(true)
    try {
      await getAuthService().signInWithEmail(email.trim(), password)
      // Navigation handled by AuthProvider → (auth)/_layout.tsx redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🌿</Text>
        <Text style={styles.title}>Plant Care</Text>
        <Text style={styles.subtitle}>Gestiona tu colección de plantas</Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#94a3b8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={() => void handleLogin()}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Iniciar sesión</Text>}
        </TouchableOpacity>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={styles.linkRow}>
            <Text style={styles.linkText}>¿No tienes cuenta? <Text style={styles.linkBold}>Crear cuenta</Text></Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: '#f0fdf4' },
  container:  { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logo:       { fontSize: 56, textAlign: 'center', marginBottom: 8 },
  title:      { fontSize: 28, fontWeight: '700', color: '#14532d', textAlign: 'center' },
  subtitle:   { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 32 },
  error:      { backgroundColor: '#fee2e2', color: '#b91c1c', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 },
  input:      { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1fae5', borderRadius: 10, padding: 14, fontSize: 15, color: '#1e293b', marginBottom: 14 },
  btn:        { backgroundColor: '#16a34a', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkRow:    { marginTop: 20, alignItems: 'center' },
  linkText:   { color: '#64748b', fontSize: 14 },
  linkBold:   { color: '#16a34a', fontWeight: '600' },
})
