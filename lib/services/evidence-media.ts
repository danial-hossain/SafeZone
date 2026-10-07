const databaseName = "safezone-evidence";
const storeName = "media";
const sessionMedia = new Map<string, Blob>();

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Local media storage is unavailable."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local media storage could not be opened."));
  });
}

export type MediaStorageScope = "browser storage" | "this session only";

/** Store binary evidence outside localStorage; retain a session-only fallback if IndexedDB is unavailable. */
export async function saveEvidenceMedia(reference: string, blob: Blob): Promise<MediaStorageScope> {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(blob, reference);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Local media storage failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Local media storage was interrupted."));
    });
    database.close();
    return "browser storage";
  } catch {
    sessionMedia.set(reference, blob);
    return "this session only";
  }
}

export async function readEvidenceMedia(reference: string): Promise<Blob | null> {
  const sessionValue = sessionMedia.get(reference);
  if (sessionValue) return sessionValue;
  try {
    const database = await openDatabase();
    const result = await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(storeName, "readonly").objectStore(storeName).get(reference);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error("Local media could not be read."));
    });
    database.close();
    return result;
  } catch {
    return null;
  }
}

/** Remove a media reference from session memory and IndexedDB when available. */
export async function deleteEvidenceMedia(reference: string): Promise<boolean> {
  sessionMedia.delete(reference);
  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database!.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).delete(reference);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Local media deletion failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Local media deletion was interrupted."));
    });
    return true;
  } catch {
    return false;
  } finally {
    database?.close();
  }
}
