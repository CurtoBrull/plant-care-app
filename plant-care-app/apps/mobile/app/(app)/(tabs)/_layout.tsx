import { Tabs } from 'expo-router'
import { Text } from 'react-native'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   '#16a34a',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle:             { backgroundColor: '#fff', borderTopColor: '#d1fae5' },
        headerShown:             false,
      }}
    >
      <Tabs.Screen
        name="plants/index"
        options={{
          title:       'Mis plantas',
          tabBarIcon:  ({ color }) => <Text style={{ fontSize: 20, color }}>🌿</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title:       'Ajustes',
          tabBarIcon:  ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>,
        }}
      />
    </Tabs>
  )
}
