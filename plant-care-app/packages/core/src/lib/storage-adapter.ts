/**
 * Adaptador de almacenamiento local.
 * En web usa localStorage; en móvil se inyecta AsyncStorage de React Native.
 * Los tests pueden inyectar cualquier implementación compatible.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/**
 * Implementación para web (localStorage).
 * Solo disponible en entornos con `window`.
 */
export const localStorageAdapter: StorageAdapter = {
  getItem:    (key)        => Promise.resolve(globalThis.localStorage?.getItem(key) ?? null),
  setItem:    (key, value) => Promise.resolve(void globalThis.localStorage?.setItem(key, value)),
  removeItem: (key)        => Promise.resolve(void globalThis.localStorage?.removeItem(key)),
}

/**
 * Implementación en memoria para tests y SSR.
 */
export function createInMemoryStorage(): StorageAdapter {
  const store = new Map<string, string>()
  return {
    getItem:    (key)        => Promise.resolve(store.get(key) ?? null),
    setItem:    (key, value) => Promise.resolve(void store.set(key, value)),
    removeItem: (key)        => Promise.resolve(void store.delete(key)),
  }
}
