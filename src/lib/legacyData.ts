/**
 * Reads the records written by the previous browser-only version.
 *
 * Before the database, this application kept everything in `localStorage` and
 * uploaded files in `IndexedDB`. Nothing here is used once a record lives in
 * Postgres — it exists so Settings → Data can offer a one-time import instead
 * of making you re-key everything by hand.
 *
 * The keys are frozen deliberately: if these names ever change, an old browser
 * profile would silently read as "no data to import".
 */

import type { AppSettings, Application, Program, Student } from '@/types'
import type { ImportPayload } from '@/store/StoreContext'
import { LEGACY_STORAGE_PREFIX } from './defaults'

const LEGACY_PREFIX = LEGACY_STORAGE_PREFIX
const LEGACY_KEYS = {
  settings: 'settings',
  programs: 'programs',
  applications: 'applications',
  students: 'students',
} as const

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_PREFIX + key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** The document store was a separate IndexedDB database. */
const LEGACY_DOC_DB = 'lcm-documents'
const LEGACY_DOC_STORE = 'files'

/**
 * Collects everything the old version stored, including document bytes so the
 * import can carry attachments across too.
 */
export async function collectLegacyData(): Promise<{
  payload: ImportPayload
  documentCount: number
}> {
  const settings = read<{ college?: AppSettings['college'] }>(LEGACY_KEYS.settings)
  const programs = read<Program[]>(LEGACY_KEYS.programs) ?? []
  const applications = read<Application[]>(LEGACY_KEYS.applications) ?? []
  const students = read<Student[]>(LEGACY_KEYS.students) ?? []

  const documents = await collectLegacyDocuments()
  const byId = new Map(documents.map((entry) => [entry.id, entry]))

  // Attach the recovered bytes to each application's metadata.
  for (const application of applications) {
    for (const label of ['photograph', 'cnic', 'academicCertificate', 'marksSheet'] as const) {
      const meta = application.documents?.[label]
      if (meta && byId.has(meta.id)) {
        application.documents[label] = { ...meta, size: byId.get(meta.id)!.file.size }
      }
    }
  }

  return {
    payload: {
      version: 1,
      exportedAt: new Date().toISOString(),
      programs,
      applications,
      students,
      settings: { college: settings?.college },
    },
    documentCount: documents.length,
  }
}

interface LegacyDocument {
  id: string
  file: Blob
}

function collectLegacyDocuments(): Promise<LegacyDocument[]> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve([])
      return
    }

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(LEGACY_DOC_DB)
    } catch {
      resolve([])
      return
    }

    request.onupgradeneeded = () => {
      // Opening without a version only fires this if the store is missing.
      if (!request.result.objectStoreNames.contains(LEGACY_DOC_STORE)) {
        resolve([])
        request.result.close()
      }
    }
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(LEGACY_DOC_STORE)) {
        db.close()
        resolve([])
        return
      }

      const found: LegacyDocument[] = []
      let transaction: IDBTransaction
      try {
        transaction = db.transaction(LEGACY_DOC_STORE, 'readonly')
      } catch {
        db.close()
        resolve([])
        return
      }

      const cursorRequest = transaction.objectStore(LEGACY_DOC_STORE).openCursor()
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (!cursor) return

        const value = cursor.value as { id?: string; blob?: Blob }
        if (value && typeof value.id === 'string' && value.blob) {
          found.push({ id: value.id, file: value.blob })
        }
        cursor.continue()
      }

      transaction.oncomplete = () => {
        db.close()
        resolve(found)
      }
      transaction.onerror = () => {
        db.close()
        resolve([])
      }
    }
    request.onerror = () => resolve([])
    request.onblocked = () => resolve([])
  })
}

/** How many records a legacy import would bring across. */
export function legacyRecordCount(): number {
  const programs = read<unknown[]>(LEGACY_KEYS.programs)
  const applications = read<unknown[]>(LEGACY_KEYS.applications)
  const students = read<unknown[]>(LEGACY_KEYS.students)
  const settings = read<unknown>(LEGACY_KEYS.settings)

  return (
    (Array.isArray(programs) ? programs.length : 0) +
    (Array.isArray(applications) ? applications.length : 0) +
    (Array.isArray(students) ? students.length : 0) +
    (settings ? 1 : 0)
  )
}

/** Removes the old browser-only copies once the import has succeeded. */
export function clearLegacyData(): void {
  try {
    for (const key of Object.values(LEGACY_KEYS)) {
      window.localStorage.removeItem(LEGACY_PREFIX + key)
    }
  } catch {
    /* ignore */
  }

  try {
    const request = indexedDB.deleteDatabase(LEGACY_DOC_DB)
    request.onsuccess = () => undefined
    request.onerror = () => undefined
    request.onblocked = () => undefined
  } catch {
    /* ignore */
  }
}
