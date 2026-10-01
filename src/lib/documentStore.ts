/**
 * IndexedDB storage for uploaded document binaries.
 *
 * Only file metadata lives in localStorage (inside Application.documents).
 * The actual bytes are stored here as Blobs, which keeps localStorage well
 * under quota even with photographs attached.
 */

const DB_NAME = 'lcm-documents'
const DB_VERSION = 1
const STORE = 'files'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })

  return dbPromise
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDatabase().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null)
          return
        }
        try {
          const tx = db.transaction(STORE, mode)
          const request = work(tx.objectStore(STORE))
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => resolve(null)
          tx.onabort = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

/** Maximum accepted upload size per document (4 MB). */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024

export async function putDocument(id: string, file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer()
  const record = {
    id,
    blob: new Blob([buffer], { type: file.type || 'application/octet-stream' }),
    fileName: file.name,
    mimeType: file.type,
    savedAt: new Date().toISOString(),
  }
  const result = await runTransaction('readwrite', (store) => store.put(record))
  return result !== null
}

export async function getDocument(id: string): Promise<Blob | null> {
  const record = await runTransaction<{ blob: Blob } | undefined>('readonly', (store) =>
    store.get(id),
  )
  return record?.blob ?? null
}

export async function deleteDocument(id: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(id))
}

export async function clearDocuments(): Promise<void> {
  await runTransaction('readwrite', (store) => store.clear())
}

/**
 * Reads a document and returns an object URL for preview/download.
 * The caller is responsible for revoking the URL.
 */
export async function documentObjectUrl(id: string): Promise<string | null> {
  const blob = await getDocument(id)
  return blob ? URL.createObjectURL(blob) : null
}