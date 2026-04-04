import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import { useAuth } from '../../components/AuthProvider'

export default function AuthLayout() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/(app)/(tabs)/plants')
    }
  }, [user, loading, router])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login"    options={{ title: 'Iniciar sesión' }} />
      <Stack.Screen name="register" options={{ title: 'Crear cuenta' }} />
    </Stack>
  )
}
