import { IndexedDbBackend } from './indexedDbBackend';
import type { DbBaseOptions, DbCommand, DbStorageBackend, DbStorageBackendFactory } from './types';

const instances = new Map<string, DbBase>();
const backendFactories = new Map<string, DbStorageBackendFactory>([
  [IndexedDbBackend.dbname, {
    dbname: IndexedDbBackend.dbname,
    priority: IndexedDbBackend.priority,
    isSupport: IndexedDbBackend.isSupport,
    create: (dbName, indexedDB) => new IndexedDbBackend(dbName, indexedDB)
  }]
]);

export class DbBase {
  private readonly metadataCache = new Map<string, string | null>();
  private readonly recordCache = new Map<string, unknown>();
  private readonly backend: DbStorageBackend;
  private readonly localStorage: Storage;

  constructor(
    readonly dbName: string,
    dbType?: string,
    options: DbBaseOptions = {}
  ) {
    if (!dbName.trim()) {
      throw new Error('Database name cannot be empty.');
    }

    this.localStorage = options.localStorage ?? globalThis.localStorage;
    if (!this.localStorage) {
      throw new Error('LocalStorage is not available in this environment.');
    }

    const preferredType = dbType ?? this.get<string>('dbtype') ?? undefined;
    const selected = this.selectBackend(preferredType, options.indexedDB);
    this.backend = selected.create(dbName, options.indexedDB);
  }

  static get(dbName: string, dbType?: string, options?: DbBaseOptions): DbBase {
    const existing = instances.get(dbName);
    if (existing) {
      return existing;
    }
    const instance = new DbBase(dbName, dbType, options);
    instances.set(dbName, instance);
    return instance;
  }

  static registerBackend(factory: DbStorageBackendFactory): void {
    if (!factory.dbname.trim()) {
      throw new Error('Storage backend name cannot be empty.');
    }
    backendFactories.set(factory.dbname, factory);
  }

  static clearInstances(): void {
    instances.clear();
  }

  static get backends(): ReadonlyMap<string, DbStorageBackendFactory> {
    return backendFactories;
  }

  get<T = string>(key: string, isJSON = false): T | null {
    const value = this.getMetadataValue(key);
    if (value === null) {
      return null;
    }
    return (isJSON ? JSON.parse(value) : value) as T;
  }

  set(key: string, value?: unknown): void {
    const storageKey = this.metadataKey(key);
    if (value === undefined || value === null) {
      this.localStorage.removeItem(storageKey);
      this.metadataCache.set(key, null);
      return;
    }

    const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
    this.localStorage.setItem(storageKey, serialized);
    this.metadataCache.set(key, serialized);
  }

  async getDB<T = unknown>(
    key: string,
    isJSON?: boolean,
    callback?: (value: T | null) => void
  ): Promise<T | null>;
  async getDB<T = unknown>(
    key: string,
    callback: (value: T | null) => void
  ): Promise<T | null>;
  async getDB<T = unknown>(
    keys: readonly string[],
    isJSON?: boolean,
    callback?: (value: Array<T | null>) => void
  ): Promise<Array<T | null>>;
  async getDB<T = unknown>(
    keys: readonly string[],
    callback: (value: Array<T | null>) => void
  ): Promise<Array<T | null>>;
  async getDB<T = unknown>(
    keyOrKeys: string | readonly string[],
    isJSONOrCallback: boolean | ((value: T | null | Array<T | null>) => void) = false,
    callback?: (value: T | null | Array<T | null>) => void
  ): Promise<T | null | Array<T | null>> {
    const isList = Array.isArray(keyOrKeys);
    const isJSON = typeof isJSONOrCallback === 'boolean' ? isJSONOrCallback : false;
    const completion = typeof isJSONOrCallback === 'function' ? isJSONOrCallback : callback;
    const keys = (isList ? keyOrKeys : [keyOrKeys]) as readonly string[];
    const result: Array<T | null> = new Array(keys.length).fill(null);
    const missingKeys: string[] = [];
    const missingIndexes: number[] = [];

    keys.forEach((key, index) => {
      if (this.recordCache.has(key)) {
        result[index] = this.decodeValue<T>(this.recordCache.get(key), isJSON);
      } else {
        missingKeys.push(key);
        missingIndexes.push(index);
      }
    });

    if (missingKeys.length > 0) {
      const values = await this.backend.getVals(missingKeys, isJSON);
      values.forEach((value, index) => {
        const key = missingKeys[index];
        if (key === undefined) {
          return;
        }
        const normalized = value ?? null;
        this.recordCache.set(key, normalized);
        result[missingIndexes[index]!] = this.decodeValue<T>(normalized, false);
      });
    }

    const value = isList ? result : result[0] ?? null;
    if (completion) {
      await Promise.resolve();
      completion(value);
    }
    return value;
  }

  async setDB(
    key: string,
    value?: unknown,
    callback?: () => void
  ): Promise<void>;
  async setDB(commands: readonly DbCommand[], callback?: () => void): Promise<void>;
  async setDB(
    keyOrCommands: string | readonly DbCommand[],
    valueOrCallback?: unknown | (() => void),
    callback?: () => void
  ): Promise<void> {
    let commands: readonly DbCommand[];
    let completion = callback;

    if (typeof keyOrCommands === 'string') {
      if (typeof valueOrCallback === 'function') {
        completion = valueOrCallback as () => void;
        commands = [{ ac: 'del', key: keyOrCommands }];
      } else {
        commands = [{
          ac: 'set',
          key: keyOrCommands,
          val: encodeLegacyValue(valueOrCallback)
        }];
      }
    } else {
      commands = keyOrCommands;
      if (typeof valueOrCallback === 'function') {
        completion = valueOrCallback as () => void;
      }
    }

    await this.backend.exec(commands);
    for (const command of commands) {
      if (command.ac === 'del') {
        this.recordCache.set(command.key, null);
      } else {
        this.recordCache.set(command.key, command.val);
      }
    }
    completion?.();
  }

  setDBcmd(key: string, commands: DbCommand[]): void;
  setDBcmd(key: string, value: unknown, commands: DbCommand[]): void;
  setDBcmd(key: string, valueOrCommands: unknown | DbCommand[], commands?: DbCommand[]): void {
    const target = commands ?? valueOrCommands as DbCommand[];
    target.push({ ac: 'del', key });
    if (commands) {
      commands.push({ ac: 'set', key, val: encodeLegacyValue(valueOrCommands) });
    }
  }

  async clear(callback?: () => void): Promise<void> {
    await this.backend.clear();
    const keysToRemove: string[] = [];
    for (let index = 0; index < this.localStorage.length; index += 1) {
      const key = this.localStorage.key(index);
      if (key?.startsWith(`${this.dbName}.`)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      this.localStorage.removeItem(key);
    }
    this.metadataCache.clear();
    this.recordCache.clear();
    callback?.();
  }

  private getMetadataValue(key: string): string | null {
    if (this.metadataCache.has(key)) {
      return this.metadataCache.get(key) ?? null;
    }
    const value = this.localStorage.getItem(this.metadataKey(key));
    this.metadataCache.set(key, value);
    return value;
  }

  private metadataKey(key: string): string {
    return `${this.dbName}.${key}`;
  }

  private selectBackend(preferredType: string | undefined, indexedDB?: IDBFactory): DbStorageBackendFactory {
    if (preferredType) {
      const preferred = backendFactories.get(preferredType);
      if (preferred?.isSupport(indexedDB)) {
        return preferred;
      }
    }

    const available = [...backendFactories.values()]
      .filter((factory) => factory.isSupport(indexedDB))
      .sort((left, right) => right.priority - left.priority);
    const selected = available[0];
    if (!selected) {
      throw new Error('No supported local database backend is available.');
    }
    return selected;
  }

  private decodeValue<T>(value: unknown, isJSON: boolean): T | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (isJSON && typeof value === 'string') {
      return JSON.parse(value) as T;
    }
    return value as T;
  }
}

function encodeLegacyValue(value: unknown): unknown {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (value) {
    return String(value);
  }
  return value;
}