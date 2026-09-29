import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { indexedDB } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';

class MemoryLocalStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

type LegacyDatabase = {
  opObj(flags: number[], objects: Record<string, unknown>[], callback?: (result: void | -1) => void): Promise<void>;
  writeObj(object: Record<string, unknown> | Record<string, unknown>[], callback?: (result: void | -1) => void): Promise<void>;
  deleteObj(object: Record<string, unknown>, callback?: (result: void | -1) => void): Promise<void>;
  dbReadObj(uuid: string, callback?: (result: Record<string, unknown> | -1) => void): Promise<Record<string, unknown>>;
  dbRead(table: string, filters?: unknown, skip?: number, take?: number): Promise<Array<Record<string, unknown>>>;
  dbRead(
    table: string,
    filters: unknown,
    callback: (result: Array<Record<string, unknown>> | -1) => void
  ): Promise<Array<Record<string, unknown>>>;
};

type LegacyGlobal = {
  (code: string, dbName: string, serviceUrl: string, dbType?: string): LegacyDatabase;
  new (code: string, dbName: string, serviceUrl: string, dbType?: string): LegacyDatabase;
  dbModelColumn: Record<string, string[]>;
  dbModelIndex: Record<string, string>;
  dbModelIndexType: Record<string, string>;
  dbModelTransformation: Record<string, unknown>;
  dbModelEvent: Record<string, unknown>;
  MySyncDB: { get: (...args: unknown[]) => unknown };
  tools: {
    arrayExtend: {
      (list: unknown[]): {
        isContain: (value: unknown, compareFunc?: (item: unknown, value: unknown) => boolean) => boolean;
        remove: (value: unknown, compareFunc?: (item: unknown, value: unknown) => boolean) => boolean;
        filter: (filterFunc: (item: unknown, index: number) => boolean) => unknown[];
      };
      new (list: unknown[]): {
        isContain: (value: unknown, compareFunc?: (item: unknown, value: unknown) => boolean) => boolean;
        remove: (value: unknown, compareFunc?: (item: unknown, value: unknown) => boolean) => boolean;
        filter: (filterFunc: (item: unknown, index: number) => boolean) => unknown[];
      };
    };
    timepiece: {
      (): { reset(): void; check(): number; show(message?: string): void };
      new (): { reset(): void; check(): number; show(message?: string): void };
    };
    ExecQueue: new () => {
      locked: number;
      lock(): void;
      push(func: (...args: unknown[]) => unknown, args?: unknown[]): void;
      release(): void;
      fixCallBack<T extends (...args: never[]) => unknown>(callback?: T): T;
    };
    toGlobal(target: object): void;
    uuid: () => string;
  };
};

function loadLegacyBundle(): { JssDB: LegacyGlobal; fetchMock: ReturnType<typeof vi.fn> } {
  const source = readFileSync(resolve(process.cwd(), 'dist/JssDB-2.0.js'), 'utf8');
  const fetchMock = vi.fn(() => Promise.reject(new Error('Unexpected network access in bundle unit test.')));
  const context: Record<string, unknown> = {
    console,
    localStorage: new MemoryLocalStorage(),
    indexedDB,
    crypto: webcrypto,
    fetch: fetchMock,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };

  runInNewContext(source, context, { filename: 'dist/JssDB-2.0.js' });
  return { JssDB: context.JssDB as LegacyGlobal, fetchMock };
}

describe('built classic bundle', () => {
  it('attaches the expected legacy API to the global object', () => {
    const { JssDB } = loadLegacyBundle();

    expect(typeof JssDB).toBe('function');
    expect(JssDB.dbModelColumn).toBeDefined();
    expect(JssDB.dbModelIndex).toBeDefined();
    expect(JssDB.dbModelIndexType).toBeDefined();
    expect(JssDB.dbModelTransformation).toBeDefined();
    expect(JssDB.dbModelEvent).toBeDefined();
    expect(typeof JssDB.MySyncDB.get).toBe('function');
    expect(typeof JssDB.tools.arrayExtend).toBe('function');
    expect(typeof JssDB.tools.timepiece).toBe('function');
    expect(typeof JssDB.tools.ExecQueue).toBe('function');
    expect(typeof JssDB.tools.toGlobal).toBe('function');
    expect(Object.hasOwn(Array.prototype, '_d')).toBe(false);
  });

  it('runs legacy array and queue helpers from the generated IIFE', async () => {
    const { JssDB } = loadLegacyBundle();
    const values = [1, 2, 3];
    const list = new JssDB.tools.arrayExtend(values);
    expect(list.isContain(2)).toBe(true);
    expect(list.filter((item) => Number(item) > 1)).toEqual([2, 3]);

    const queue = new JssDB.tools.ExecQueue();
    const called: string[] = [];
    queue.lock();
    queue.push(() => { called.push('next'); });
    queue.fixCallBack(() => { called.push('callback'); })();
    expect(called).toEqual(['callback']);
    await new Promise((resolveResult) => setTimeout(resolveResult, 0));
    expect(called).toEqual(['callback', 'next']);
  });

  it('runs legacy construction, write, read, and callback flows without network access', async () => {
    const { JssDB, fetchMock } = loadLegacyBundle();
    const table = `BundleTable${Date.now()}`;
    JssDB.dbModelColumn[table] = ['name'];
    const database = new JssDB('bundle-code', table, 'https://example.invalid/api');

    await database.writeObj({ uuid: 'bundle-record', table, name: 'from built artifact' });
    await expect(database.dbReadObj('bundle-record')).resolves.toMatchObject({
      uuid: 'bundle-record',
      table,
      name: 'from built artifact'
    });

    const callbackValue = await new Promise<Record<string, unknown>>((resolveResult) => {
      void database.dbReadObj('bundle-record', (result) => resolveResult(result as Record<string, unknown>));
    });
    expect(callbackValue.name).toBe('from built artifact');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves model registration, bulk operations, indexed reads, updates, deletes, and error callbacks', async () => {
    const { JssDB, fetchMock } = loadLegacyBundle();
    const table = `BundleAcceptance${Date.now()}`;
    JssDB.dbModelColumn[table] = ['rank', 'name'];
    JssDB.dbModelIndex[table] = 'rank';
    JssDB.dbModelIndexType[table] = 'int';
    const database = new JssDB('bundle-code', table, 'https://example.invalid/api');
    const first = { uuid: 'bundle-first', table, rank: 1, name: 'first' };
    const second = { uuid: 'bundle-second', table, rank: 2, name: 'second' };

    await database.opObj([0, 0], [first, second]);
    await expect(database.dbRead(table, ['rank', '>=', 2])).resolves.toEqual([second]);

    const updated = { ...first, rank: 3, name: 'updated' };
    await database.writeObj(updated);
    await expect(database.dbRead(table, ['rank', '=', 1])).resolves.toEqual([]);
    await expect(database.dbRead(table, ['rank', '=', 3])).resolves.toEqual([updated]);

    await database.deleteObj(second);
    await expect(database.dbReadObj(second.uuid)).resolves.toEqual({});
    await expect(database.dbRead(table)).resolves.toEqual([updated]);

    const invalid = { uuid: 'unregistered', table: 'MissingBundleModel' };
    let callbackResult: unknown;
    await expect(database.writeObj(invalid, (result) => { callbackResult = result; })).rejects.toThrow(
      'Invalid legacy object. Register its table model first.'
    );
    expect(callbackResult).toBe(-1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('supports KeepPwd model fields, callback-position filters, and encrypted CRUD workflows', async () => {
    const { JssDB, fetchMock } = loadLegacyBundle();
    JssDB.dbModelColumn.DbAc = [
      'title', 'groupId', 'uid', 'eMail', 'summary', 'url', 'createTime', 'updateTime', 'status', 'F2A'
    ];
    JssDB.dbModelIndex.DbAc = 'title';
    JssDB.dbModelIndexType.DbAc = 'string';
    JssDB.dbModelColumn.DbGroup = ['name', 'status'];
    JssDB.dbModelIndex.DbGroup = 'name';
    JssDB.dbModelIndexType.DbGroup = 'string';
    JssDB.dbModelColumn.DbPwd = ['pUUID', 'pwd', 'xh', 'createTime'];
    JssDB.dbModelIndex.DbPwd = 'pUUID';
    JssDB.dbModelIndexType.DbPwd = 'string';

    const database = new JssDB('keeppwd-contract', 'keeppwd-contract', 'https://example.invalid/api');
    const key = 'fixture-key';
    const encrypt = (value: string): string => `${key}:${value}`;
    const decrypt = (value: string): string => value.slice(`${key}:`.length);
    const group = { uuid: 'group-personal', table: 'DbGroup', name: encrypt('Personal'), status: 1 };
    const accounts = [
      {
        uuid: 'account-zulu', table: 'DbAc', title: encrypt('Zulu'), groupId: group.uuid,
        uid: encrypt('alice'), eMail: encrypt('alice@example.test'), summary: encrypt('summary'),
        url: encrypt('https://example.test'), createTime: 100, updateTime: 100, status: 1, F2A: encrypt('totp')
      },
      {
        uuid: 'account-alpha', table: 'DbAc', title: encrypt('Alpha'), groupId: group.uuid,
        uid: encrypt('bob'), eMail: encrypt('bob@example.test'), summary: encrypt('notes'),
        url: encrypt('https://example.test/alpha'), createTime: 200, updateTime: 200, status: 1, F2A: ''
      }
    ];
    const password = {
      uuid: 'password-alpha', table: 'DbPwd', pUUID: accounts[1]!.uuid,
      pwd: encrypt('secret-value'), xh: 1, createTime: 300
    };

    await new Promise<void>((resolveResult) => {
      void database.writeObj(group, (result) => { expect(result).toBeUndefined(); resolveResult(); });
    });
    await new Promise<void>((resolveResult) => {
      void database.writeObj(accounts, (result) => { expect(result).toBeUndefined(); resolveResult(); });
    });
    await new Promise<void>((resolveResult) => {
      void database.writeObj(password, (result) => { expect(result).toBeUndefined(); resolveResult(); });
    });

    const filteredAccounts = await new Promise<Array<Record<string, unknown>>>((resolveResult) => {
      void database.dbRead('DbAc', [
        ['groupId', 'in', [group.uuid]],
        ['status', 'in', ['1']]
      ], (result) => resolveResult(result as Array<Record<string, unknown>>));
    });
    const visibleAccounts = filteredAccounts
      .map((account) => ({ uuid: account.uuid, title: decrypt(account.title as string) }))
      .sort((left, right) => String(left.title).localeCompare(String(right.title)));
    expect(visibleAccounts.map((account) => ({ uuid: account.uuid, title: account.title }))).toEqual([
      { uuid: 'account-alpha', title: 'Alpha' },
      { uuid: 'account-zulu', title: 'Zulu' }
    ]);

    const rawAccount = await new Promise<Record<string, unknown>>((resolveResult) => {
      void database.dbReadObj(accounts[1]!.uuid, (result) => resolveResult(result as Record<string, unknown>));
    });
    expect(rawAccount.title).toBe(encrypt('Alpha'));
    expect(decrypt(rawAccount.uid as string)).toBe('bob');

    const updated = { ...accounts[1]!, title: encrypt('Beta'), summary: encrypt('changed'), updateTime: 400 };
    let updateCallback: unknown = 'not-called';
    await database.writeObj(updated, (result) => { updateCallback = result; });
    expect(updateCallback).toBeUndefined();
    await expect(database.dbReadObj(updated.uuid)).resolves.toMatchObject(updated);

    let deleteCallback: unknown = 'not-called';
    await database.deleteObj(password, (result) => { deleteCallback = result; });
    expect(deleteCallback).toBeUndefined();
    await expect(database.dbReadObj(password.uuid)).resolves.toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});