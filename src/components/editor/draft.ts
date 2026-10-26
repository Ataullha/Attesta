import type { Design } from '@/lib/design';

/**
 * A design kept in this browser while its author goes to sign in or create an account, so the work
 * they did before deciding to sign up comes back with them. IndexedDB rather than localStorage,
 * because it can hold the images a guest added: those exist only in the page until there is an
 * account to upload them to.
 */
export type Draft = { design: Design; name: string; values: Record<string, string>; images: Record<string, Blob> };

/** Where sign-in and sign-up send the author back to; the editor restores the draft when it opens there. */
export const DRAFT_RETURN = '/create?draft=1';

const DB_NAME = 'attesta';
const STORE = 'drafts';
const KEY = 'editor';
/** Long enough to confirm an email address and come back; short enough not to surprise anyone. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function inStore<T>(mode: IDBTransactionMode, use: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = use(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** False when the browser will not store it (a private window can refuse); the caller carries on regardless. */
export async function saveDraft(draft: Draft) {
  try {
    await inStore('readwrite', (s) => s.put({ ...draft, savedAt: Date.now() }, KEY));
    return true;
  } catch {
    return false;
  }
}

/** The kept draft, removed as it is read so it is restored once. */
export async function takeDraft(): Promise<Draft | null> {
  try {
    const kept = await inStore<(Draft & { savedAt: number }) | undefined>('readonly', (s) => s.get(KEY));
    if (!kept) return null;
    await inStore('readwrite', (s) => s.delete(KEY));
    return Date.now() - kept.savedAt < MAX_AGE_MS ? kept : null;
  } catch {
    return null;
  }
}
