/**
 * Thin typed wrapper around localStorage.
 * All reads are defensive — corrupt JSON falls back to the supplied default.
 */

const PREFIX = 'lcm:'

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeStore<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (error) {
    // Quota exceeded — surface rather than silently lose data.
    throw new Error(
      error instanceof Error && error.name === 'QuotaExceededError'
        ? 'Browser storage is full. Remove uploaded documents or clear data from Settings.'
        : 'Unable to save data to browser storage.',
    )
  }
}

export function removeStore(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
}

export function clearAllStores(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(PREFIX)) keys.push(key)
    }
    keys.forEach((k) => window.localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

/** Approximate size of all persisted app data, in bytes. */
export function storageUsageBytes(): number {
  try {
    let total = 0
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(PREFIX)) {
        total += (window.localStorage.getItem(key) ?? '').length + key.length
      }
    }
    return total
  } catch {
    return 0
  }
}