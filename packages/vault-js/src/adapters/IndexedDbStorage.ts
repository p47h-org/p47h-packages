import type { IStorage } from '../domain/IStorage';
import type { EncryptedVaultBlob } from '../domain/types';
import { StorageError } from '../domain/errors';

export class BrowserStorage implements IStorage {
  private readonly dbName = 'p47h-vault';
  private readonly storeName = 'keystores';
  private readonly version = 2;

  /**
   * Open database connection with migration logic
   */
  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      // Check for support
      if (typeof indexedDB === 'undefined') {
        return reject(new StorageError('IndexedDB not supported in this environment'));
      }

      const req = indexedDB.open(this.dbName, this.version);

      req.onerror = () => reject(new StorageError('Failed to open database', req.error));

      req.onsuccess = () => resolve(req.result);

      req.onupgradeneeded = (event) => {
        const db = req.result;
        // Migration logic: Clear old stores if version changed radically or init
        if (event.oldVersion < 2) {
          if (db.objectStoreNames.contains(this.storeName)) {
            db.deleteObjectStore(this.storeName);
          }
          // Create store with 'did' as primary key
          db.createObjectStore(this.storeName, { keyPath: 'did' });
        }
      };
    });
  }

  /**
   * Execute a transaction
   */
  private async withStore<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T> | void
  ): Promise<T | undefined> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.storeName, mode);
      const store = tx.objectStore(this.storeName);
      
      const req = callback(store);
      
      // Wait for transaction to complete
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          // If request returned a result, use it
          if (req instanceof IDBRequest) {
            resolve(req.result);
          } else {
            resolve(undefined);
          }
        };
        tx.onerror = () => reject(new StorageError('Transaction failed', tx.error));
        // Fallback for request errors that bubble up
        if (req instanceof IDBRequest) {
            req.onerror = () => reject(new StorageError('Request failed', req.error));
        }
      });
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError('Database operation failed', error);
    }
  }

  // --- IStorage Implementation ---

  async save(key: string, data: EncryptedVaultBlob): Promise<void> {
    if (data.did !== key) {
        throw new StorageError(`Integrity check: Key ${key} does not match DID ${data.did}`);
    }
    await this.withStore('readwrite', (store) => store.put(data));
  }

  async get(key: string): Promise<EncryptedVaultBlob | null> {
    const result = await this.withStore<EncryptedVaultBlob>('readonly', (store) => store.get(key));
    return result || null;
  }

  async remove(key: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.delete(key));
  }

  async listKeys(): Promise<string[]> {
    const keys = await this.withStore<string[]>('readonly', (store) => store.getAllKeys() as IDBRequest<string[]>);
    return keys ?? [];
  }

  async clear(): Promise<void> {
    await this.withStore('readwrite', (store) => store.clear());
  }
}