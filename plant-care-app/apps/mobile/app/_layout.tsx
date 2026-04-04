// Import Supabase first so setSupabaseClient() is called before any service
import '../lib/supabase'

import { useEffect } from 'react'
import { Stack } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { AuthProvider } from '../components/AuthProvider'
import { getNotificationService } from '../lib/services'
import { useAuth } from '../components/AuthProvider'

// Configure foreground notification behaviour
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
})

function NotificationRegistrar() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return

    async function registerPushToken() {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync()
        let finalStatus = existing
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync()
          finalStatus = status
        }
        if (finalStatus !== 'granted') return

        const tokenData = await Notifications.getExpoPushTokenAsync()
        await getNotificationService().saveFcmToken(user!.id, tokenData.data)
      } catch {
        // Push token registration is non-critical
      }
    }

    void registerPushToken()
  }, [user?.id])

  return null
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationRegistrar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)"  options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  )
}
