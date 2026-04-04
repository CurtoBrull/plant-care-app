export interface User {
  id: string
  email: string
  displayName: string
  notificationsEnabled: boolean
  reminderTime: string    // "HH:mm"
  fcmToken?: string
  createdAt: string       // ISO timestamp
}
