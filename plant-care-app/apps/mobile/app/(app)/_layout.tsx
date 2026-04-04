import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import NetInfo from '@react-native-community/netinfo'
import { useAuth } from '../../components/AuthProvider'
import { getOfflineSyncService } from '../../lib/services'

export default function AppLayout() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login')
    }
  }, [user, loading, router])

  // Flush offline queue when connectivity is restored
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void getOfflineSyncService().flushPendingChanges()
      }
    })
    return unsubscribe
  }, [])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="plants/new"
        options={{ headerShown: true, title: 'Nueva planta', headerTintColor: '#16a34a' }}
      />
      <Stack.Screen
        name="plants/[id]/index"
        options={{ headerShown: true, title: 'Planta', headerTintColor: '#16a34a' }}
      />
    </Stack>
  )
}
