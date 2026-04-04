import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useAuth } from '../components/AuthProvider'

/**
 * Entry point: redirect to the correct stack depending on auth state.
 */
export default function IndexScreen() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user) {
      router.replace('/(app)/(tabs)/plants')
    } else {
      router.replace('/(auth)/login')
    }
  }, [user, loading, router])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdf4' }}>
      <ActivityIndicator size="large" color="#16a34a" />
    </View>
  )
}
