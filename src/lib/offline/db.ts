export type OfflineOperationType = "sale" | "payment" | "payment_purchase" | "expense";
export type OfflineOperationStatus = "pending" | "failed";

export interface OfflineOperation {
  id: string;
  userId: string;
  type: OfflineOperationType;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  status: OfflineOperationStatus;
  attempts: number;
  lastError?: string | null;
}

type CacheEntry<T = unknown> = {
  key: string;
  value: T;
  updatedAt: string;
};

const DB_NAME = "sacoleiro-offline";
const DB_VERSION = 1;
const OPERATIONS_STORE = "operations";
const CACHE_STORE = "cache";
const IDENTITY_KEY = "__identity";

function ensureBrowser() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("IndexedDB indisponível neste dispositivo.");
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha no IndexedDB."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Transação local cancelada."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Falha na transação local."));
  });
}

export function openOfflineDb(): Promise<IDBDatabase> {
  ensureBrowser();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OPERATIONS_STORE)) {
        const store = db.createObjectStore(OPERATIONS_STORE, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o banco offline."));
  });
}

export async function setCachedValue<T>(key: string, value: T): Promise<void> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction(CACHE_STORE, "readwrite");
    tx.objectStore(CACHE_STORE).put({ key, value, updatedAt: new Date().toISOString() } satisfies CacheEntry<T>);
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function getCachedValue<T>(key: string): Promise<T | null> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction(CACHE_STORE, "readonly");
    const entry = await requestToPromise(tx.objectStore(CACHE_STORE).get(key)) as CacheEntry<T> | undefined;
    await transactionDone(tx);
    return entry?.value ?? null;
  } finally {
    db.close();
  }
}

export async function setOfflineIdentity(userId: string): Promise<void> {
  await setCachedValue(IDENTITY_KEY, { userId });
}

export async function getOfflineIdentity(): Promise<string | null> {
  const identity = await getCachedValue<{ userId: string }>(IDENTITY_KEY);
  return identity?.userId ?? null;
}

export async function addOfflineOperation(
  type: OfflineOperationType,
  payload: Record<string, unknown>
): Promise<OfflineOperation> {
  const userId = await getOfflineIdentity();
  if (!userId) {
    throw new Error("Abra o sistema conectado à internet pelo menos uma vez antes de usar o modo offline.");
  }

  const now = new Date().toISOString();
  const operation: OfflineOperation = {
    id: crypto.randomUUID(),
    userId,
    type,
    payload,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    attempts: 0,
    lastError: null,
  };

  const db = await openOfflineDb();
  try {
    const tx = db.transaction(OPERATIONS_STORE, "readwrite");
    tx.objectStore(OPERATIONS_STORE).add(operation);
    await transactionDone(tx);
  } finally {
    db.close();
  }
  notifyOfflineChange();
  return operation;
}

export async function listOfflineOperations(options?: { includeForeignUsers?: boolean }): Promise<OfflineOperation[]> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction(OPERATIONS_STORE, "readonly");
    const all = await requestToPromise(tx.objectStore(OPERATIONS_STORE).getAll()) as OfflineOperation[];
    await transactionDone(tx);
    const userId = options?.includeForeignUsers ? null : await getOfflineIdentity();
    return all
      .filter((op) => !userId || op.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } finally {
    db.close();
  }
}

export async function getOfflineOperation(id: string): Promise<OfflineOperation | null> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction(OPERATIONS_STORE, "readonly");
    const value = await requestToPromise(tx.objectStore(OPERATIONS_STORE).get(id)) as OfflineOperation | undefined;
    await transactionDone(tx);
    return value ?? null;
  } finally {
    db.close();
  }
}

export async function updateOfflineOperation(operation: OfflineOperation): Promise<void> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction(OPERATIONS_STORE, "readwrite");
    tx.objectStore(OPERATIONS_STORE).put({ ...operation, updatedAt: new Date().toISOString() });
    await transactionDone(tx);
  } finally {
    db.close();
  }
  notifyOfflineChange();
}

export async function removeOfflineOperation(id: string): Promise<void> {
  const db = await openOfflineDb();
  try {
    const tx = db.transaction(OPERATIONS_STORE, "readwrite");
    tx.objectStore(OPERATIONS_STORE).delete(id);
    await transactionDone(tx);
  } finally {
    db.close();
  }
  notifyOfflineChange();
}

export async function clearOfflineStorage(): Promise<void> {
  if (typeof window === "undefined") return;

  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  notifyOfflineChange();
}

export function notifyOfflineChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sacoleiro:offline-change"));
  }
}
