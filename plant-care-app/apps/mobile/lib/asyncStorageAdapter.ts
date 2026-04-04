import AsyncStorage from '@react-native-async-storage/async-storage'
import type { StorageAdapter } from '@plant-care/core'

/**
 * StorageAdapter implementation backed by React Native AsyncStorage.
 * Pass this to OfflineSyncService so it persists the offline queue
 * across app restarts on mobile.
 */
export const asyncStorageAdapter: StorageAdapter = {
  getItem:    (key)        => AsyncStorage.getItem(key),
  setItem:    (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key)        => AsyncStorage.removeItem(key),
}
