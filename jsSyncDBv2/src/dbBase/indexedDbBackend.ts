import type { DbCommand, DbStorageBackend } from './types';

type StoredValue = {
  readonly key: string;
  readonly val: unknown;
};

export class IndexedDbBackend implements DbStorageBackend {
  static readonly dbname = 'IndexedDB';
  static readonly priority = 3;

  private readonly databasePromise: Promise<IDBDatabase>;

  constructor(
    databaseName: string,
    private readonly indexedDBFactory: IDBFactory | undefined = globalThis.indexedDB,
    private readonly storeName = 't_main'
  ) {
    if (!databaseName.trim()) {
      throw new Error('Database name cannot be empty.');
    }
    if (!this.indexedDBFactory) {
      throw new Error('IndexedDB is not available in this environment.');
    }
    this.databasePromise = this.openDatabase(databaseName);
  }

  static isSupport(indexedDBFactory: IDBFactory | undefined = globalThis.indexedDB): boolean {
    return indexedDBFactory !== undefined;
  }

  async getVals(keys: readonly string[], isJSON = false): Promise<unknown[]> {
    if (keys.length === 0) {
      return [];
    }

    const database = await this.databasePromise;
    return new Promise<unknown[]>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(this.storeName, 'readonly');
      } catch (error) {
        reject(error);
        return;
      }

      const results: unknown[] = new Array(keys.length).fill(null);
      let settled = false;
      transaction.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve(isJSON ? results.map(parseJsonValue) : results);
        }
      };
      transaction.onerror = () => {
        if (!settled) {
          settled = true;
          reject(transaction.error ?? new Error('IndexedDB read transaction failed.'));
        }
      };
      transaction.onabort = () => {
        if (!settled) {
          settled = true;
          reject(transaction.error ?? new Error('IndexedDB read transaction was aborted.'));
        }
      };

      const store = transaction.objectStore(this.storeName);
      keys.forEach((key, index) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const stored = request.result as StoredValue | undefined;
          results[index] = stored?.val ?? null;
        };
      });
    });
  }

  async exec(commands: readonly DbCommand[]): Promise<void> {
    if (commands.length === 0) {
      return;
    }

    const database = await this.databasePromise;
    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(this.storeName, 'readwrite');
      } catch (error) {
        reject(error);
        return;
      }

      let settled = false;
      transaction.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      transaction.onerror = () => {
        if (!settled) {
          settled = true;
          reject(transaction.error ?? new Error('IndexedDB write transaction failed.'));
        }
      };
      transaction.onabort = () => {
        if (!settled) {
          settled = true;
          reject(transaction.error ?? new Error('IndexedDB write transaction was aborted.'));
        }
      };

      const store = transaction.objectStore(this.storeName);
      try {
        for (const command of commands) {
          if (command.ac === 'del') {
            store.delete(command.key);
          } else {
            store.put({ key: command.key, val: command.val } satisfies StoredValue);
          }
        }
      } catch (error) {
        try {
          transaction.abort();
        } catch {
          // The transaction may already have been aborted by IndexedDB.
        }
        if (!settled) {
          settled = true;
          reject(error);
        }
      }
    });
  }

  async clear(): Promise<void> {
    const database = await this.databasePromise;
    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(this.storeName, 'readwrite');
      } catch (error) {
        reject(error);
        return;
      }

      let settled = false;
      transaction.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      transaction.onerror = () => {
        if (!settled) {
          settled = true;
          reject(transaction.error ?? new Error('IndexedDB clear transaction failed.'));
        }
      };
      transaction.onabort = () => {
        if (!settled) {
          settled = true;
          reject(transaction.error ?? new Error('IndexedDB clear transaction was aborted.'));
        }
      };

      transaction.objectStore(this.storeName).clear();
    });
  }

  private openDatabase(databaseName: string): Promise<IDBDatabase> {
    const factory = this.indexedDBFactory;
    if (!factory) {
      return Promise.reject(new Error('IndexedDB is not available in this environment.'));
    }

    return new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = factory.open(databaseName, 1);
      } catch (error) {
        reject(error);
        return;
      }

      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(this.storeName)) {
          request.result.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
      request.onblocked = () => reject(new Error(`Opening IndexedDB database "${databaseName}" was blocked.`));
    });
  }
}

function parseJsonValue(value: unknown): unknown {
  if (value === null || value === undefined || value === '') {
    return value ?? null;
  }
  return typeof value === 'string' ? JSON.parse(value) : value;
}