const DB_NAME = 'clinicapp-offline'
const DB_VERSION = 1

const STORES = {
  consultations: 'consultations',
  labOrders: 'labOrders',
  pendingActions: 'pendingActions',
} as const

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORES.consultations)) {
        db.createObjectStore(STORES.consultations, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.labOrders)) {
        db.createObjectStore(STORES.labOrders, { keyPath: 'consultation_id' })
      }
      if (!db.objectStoreNames.contains(STORES.pendingActions)) {
        db.createObjectStore(STORES.pendingActions, { autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function tx(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store)
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

// --- Consultations ---

export async function cacheConsultation(data: Record<string, unknown>): Promise<void> {
  const db = await openDb()
  await req(tx(db, STORES.consultations, 'readwrite').put(JSON.parse(JSON.stringify(data))))
}

export async function getCachedConsultation(id: string): Promise<Record<string, unknown> | undefined> {
  const db = await openDb()
  return req(tx(db, STORES.consultations, 'readonly').get(id))
}

// --- Lab Orders ---

export async function cacheLabOrder(consultationId: string, data: Record<string, unknown>): Promise<void> {
  const db = await openDb()
  const plain = JSON.parse(JSON.stringify({ ...data, consultation_id: consultationId }))
  await req(tx(db, STORES.labOrders, 'readwrite').put(plain))
}

export async function getCachedLabOrder(consultationId: string): Promise<Record<string, unknown> | undefined> {
  const db = await openDb()
  return req(tx(db, STORES.labOrders, 'readonly').get(consultationId))
}

// --- Pending Actions (offline queue) ---

export interface PendingAction {
  type: 'update-consultation' | 'update-lab-order-item' | 'add-lab-order-item' | 'remove-lab-order-item'
  url: string
  method: 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  createdAt: number
}

export async function queueAction(action: PendingAction): Promise<void> {
  const db = await openDb()
  await req(tx(db, STORES.pendingActions, 'readwrite').add(action))
}

export async function getPendingActions(): Promise<{ key: IDBValidKey; action: PendingAction }[]> {
  const db = await openDb()
  const store = tx(db, STORES.pendingActions, 'readonly')
  return new Promise((resolve, reject) => {
    const results: { key: IDBValidKey; action: PendingAction }[] = []
    const cursor = store.openCursor()
    cursor.onsuccess = () => {
      const c = cursor.result
      if (c) {
        results.push({ key: c.key, action: c.value })
        c.continue()
      } else {
        resolve(results)
      }
    }
    cursor.onerror = () => reject(cursor.error)
  })
}

export async function removePendingAction(key: IDBValidKey): Promise<void> {
  const db = await openDb()
  await req(tx(db, STORES.pendingActions, 'readwrite').delete(key))
}

export async function getPendingActionCount(): Promise<number> {
  const db = await openDb()
  return req(tx(db, STORES.pendingActions, 'readonly').count())
}
