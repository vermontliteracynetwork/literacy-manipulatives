import type { Folder, Procedure } from './types';

// The procedure library, like a drive of slide decks in folders. Kept in this browser (IndexedDB, so pictures on
// the boards fit); Download and Open a file move a procedure to another computer.
const DB = 'lm-procedures';
const VERSION = 1;
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('procedures')) db.createObjectStore('procedures', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export const listProcedures = () => run<Procedure[]>('procedures', 'readonly', (s) => s.getAll());
export const getProcedure = (id: string) => run<Procedure | undefined>('procedures', 'readonly', (s) => s.get(id));
export const saveProcedure = (p: Procedure) => run<IDBValidKey>('procedures', 'readwrite', (s) => s.put({ ...p, saved: true, updatedAt: new Date().toISOString() }));
export const deleteProcedure = (id: string) => run<undefined>('procedures', 'readwrite', (s) => s.delete(id));
export const listFolders = () => run<Folder[]>('folders', 'readonly', (s) => s.getAll());
export const saveFolder = (f: Folder) => run<IDBValidKey>('folders', 'readwrite', (s) => s.put(f));
export const deleteFolder = (id: string) => run<undefined>('folders', 'readwrite', (s) => s.delete(id));

// The procedure open right now, so a refresh keeps unsaved work (this tab only, like the whiteboard).
const OPEN = 'lm-procedure-open';
export function readOpen(): Procedure | null { try { return JSON.parse(sessionStorage.getItem(OPEN) ?? 'null'); } catch { return null; } }
export function writeOpen(p: Procedure) { try { sessionStorage.setItem(OPEN, JSON.stringify(p)); } catch { /* too big for this tab: kept in memory */ } }

export function downloadProcedure(p: Procedure) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(p)], { type: 'application/json' }));
  a.download = `${p.title.replace(/[^\w\- ]+/g, '').trim() || 'procedure'}.procedure.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
