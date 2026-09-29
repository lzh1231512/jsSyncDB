import { indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { DbBase } from '../src';

class TestLocalStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
}

const databaseNames: string[] = [];
let databaseSequence = 0;

afterEach(async () => {
  DbBase.clearInstances();
  for (const databaseName of databaseNames.splice(0)) {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }
});

function createDbBase(dbName = `db-base-${++databaseSequence}`): {
  database: DbBase;
  localStorage: TestLocalStorage;
} {
  databaseNames.push(dbName);
  const localStorage = new TestLocalStorage();
  return {
    database: new DbBase(dbName, undefined, { indexedDB, localStorage }),
    localStorage
  };
}

describe('DbBase', () => {
  it('keeps metadata get/set synchronous and JSON-compatible', () => {
    const { database, localStorage } = createDbBase('metadata-db');

    expect(database.get('missing')).toBeNull();
    expect(database.set('cursor', 12)).toBeUndefined();
    expect(database.get('cursor')).toBe('12');

    database.set('state', { index: 4 });
    expect(database.get('state', true)).toEqual({ index: 4 });
    expect(localStorage.getItem('metadata-db.state')).toBe('{"index":4}');

    database.set('state', null);
    expect(database.get('state')).toBeNull();
  });

  it('preserves the original t_main {key, val} record format', async () => {
    const { database } = createDbBase('legacy-layout-db');
    await database.setDB('record-1', { text: 'stored' });
    await database.setDB('null-record', null);

    const rawDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('legacy-layout-db', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stored = await new Promise<unknown>((resolve, reject) => {
      const request = rawDatabase.transaction('t_main').objectStore('t_main').get('record-1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    expect(stored).toEqual({ key: 'record-1', val: '{"text":"stored"}' });
    const storedNull = await new Promise<unknown>((resolve, reject) => {
      const request = rawDatabase.transaction('t_main').objectStore('t_main').get('null-record');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(storedNull).toEqual({ key: 'null-record', val: 'null' });
    rawDatabase.close();
    await expect(database.getDB('record-1', true)).resolves.toEqual({ text: 'stored' });
  });

  it('keeps requested order and duplicate keys in batch reads', async () => {
    const { database } = createDbBase();
    await database.setDB([
      { ac: 'set', key: 'first', val: 'A' },
      { ac: 'set', key: 'second', val: 'B' }
    ]);

    await expect(database.getDB(['second', 'missing', 'first', 'second'])).resolves.toEqual([
      'B',
      null,
      'A',
      'B'
    ]);
    await expect(database.getDB('missing')).resolves.toBeNull();
  });

  it('supports the legacy getDB callback as well as its Promise result', async () => {
    const { database } = createDbBase();
    await database.setDB('legacy-callback', 'callback-value');

    let callbackValue: unknown;
    let callbackWasSynchronous = true;
    const operation = database.getDB('legacy-callback', (value) => {
      callbackValue = value;
      expect(callbackWasSynchronous).toBe(false);
    });
    callbackWasSynchronous = false;

    await expect(operation).resolves.toBe('callback-value');
    expect(callbackValue).toBe('callback-value');
  });

  it('does not expose or cache writes from an aborted transaction', async () => {
    const { database } = createDbBase();

    await expect(database.setDB([
      { ac: 'set', key: 'committed-only-on-success', val: 'temporary' },
      { ac: 'set', key: 'uncloneable', val: () => 'cannot be cloned' }
    ])).rejects.toBeDefined();

    await expect(database.getDB('committed-only-on-success')).resolves.toBeNull();
  });

  it('clears only this database namespace and invokes its callback after completion', async () => {
    const first = createDbBase('clear-db');
    const second = createDbBase('clear-db-extra');
    first.localStorage.setItem('clear-db.cursor', '5');
    first.localStorage.setItem('clear-db-extra.cursor', '9');
    await first.database.setDB('first-record', 'value');
    await second.database.setDB('second-record', 'value');

    let callbackCalled = false;
    await first.database.clear(() => {
      callbackCalled = true;
    });

    expect(callbackCalled).toBe(true);
    expect(first.localStorage.getItem('clear-db.cursor')).toBeNull();
    expect(first.localStorage.getItem('clear-db-extra.cursor')).toBe('9');
    await expect(first.database.getDB('first-record')).resolves.toBeNull();
    await expect(second.database.getDB('second-record')).resolves.toBe('value');
  });

  it('updates the record cache only after a successful write', async () => {
    const { database } = createDbBase();
    const originalSetItem = database.setDB.bind(database);
    let callbackCalled = false;
    await originalSetItem('record', 'ok', () => {
      callbackCalled = true;
    });

    expect(callbackCalled).toBe(true);
    await expect(database.getDB('record')).resolves.toBe('ok');
  });
});