import type { SnapshotStore } from "./session-snapshot";

const DATABASE = "hotseat";
const STORE = "session-snapshot";
const SINGLE_SLOT = "current";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DATABASE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  return requestResult(request);
}

async function inStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await requestResult(run(database.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    database.close();
  }
}

export const indexedDbSnapshotStore: SnapshotStore = {
  async read() {
    return inStore("readonly", (store) => store.get(SINGLE_SLOT));
  },
  async write(snapshot) {
    await inStore("readwrite", (store) => store.put(snapshot, SINGLE_SLOT));
  },
  async remove() {
    await inStore("readwrite", (store) => store.delete(SINGLE_SLOT));
  },
};
