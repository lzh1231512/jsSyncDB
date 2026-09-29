import { indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DbBase,
  DbCore,
  dbModelColumn,
  dbModelEvent,
  dbModelIndex,
  dbModelIndexType,
  dbModelTransformation,
  dbObj,
  _dbObj
} from '../src';

class TestLocalStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

const databaseNames: string[] = [];
let sequence = 0;

afterEach(async () => {
  DbCore.clearInstances();
  DbBase.clearInstances();
  for (const name of databaseNames.splice(0)) {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }
});

function createDatabase(table: string): DbCore {
  const name = `db-core-${++sequence}`;
  databaseNames.push(name);
  dbModelColumn[table] = ['rank', 'label'];
  dbModelIndex[table] = 'rank';
  dbModelIndexType[table] = 'int';
  return new DbCore(name, undefined, { indexedDB, localStorage: new TestLocalStorage() });
}

describe('DbCore', () => {
  it('keeps the original MyDB and _dbObj construction surface', () => {
    const target = {} as ReturnType<typeof dbObj>;
    const databaseName = `singleton-${sequence + 1}`;
    databaseNames.push(databaseName);
    expect(_dbObj.call(target, 'legacy-id', 'legacy-table')).toBe(target);
    expect(target).toEqual({ uuid: 'legacy-id', table: 'legacy-table' });
    const database = DbCore.get(databaseName, undefined, { indexedDB, localStorage: new TestLocalStorage() });
    expect(database).toBeInstanceOf(DbCore);
    expect(DbCore.get(databaseName)).toBe(database);
  });

  it('round-trips the compact entity and returns indexed, paginated matches', async () => {
    const table = `indexed-${sequence + 1}`;
    const database = createDatabase(table);
    const records = [
      { ...dbObj('item-c', table), rank: 7, label: 'seven' },
      { ...dbObj('item-a', table), rank: 2, label: 'two' },
      { ...dbObj('item-b', table), rank: 4, label: 'four' }
    ];

    await database.dbWriteObj(records);

    await expect(database.dbReadObj('item-b')).resolves.toEqual(records[2]);
    await expect(database.dbRead(table, ['rank', '>=', 2], 1, 1)).resolves.toEqual([records[2]]);
    await expect(database.dbRead(table, ['rank', '=', 7])).resolves.toEqual([records[0]]);
  });

  it('updates and deletes index entries atomically, keeping callbacks compatible', async () => {
    const table = `mutations-${sequence + 1}`;
    const database = createDatabase(table);
    const record = { ...dbObj('mutable', table), rank: 1, label: 'before' };
    await database.dbWriteObj(record);

    const updated = { ...record, rank: 5, label: 'after' };
    let callbackResult: unknown;
    await database.dbWriteObj(updated, (result) => { callbackResult = result; });
    expect(callbackResult).toBeUndefined();
    await expect(database.dbRead(table, ['rank', '=', 1])).resolves.toEqual([]);
    await expect(database.dbRead(table, ['rank', '=', 5])).resolves.toEqual([updated]);

    await database.dbDeleteObj(updated);
    await expect(database.dbReadObj('mutable')).resolves.toEqual({});
    await expect(database.dbRead(table)).resolves.toEqual([]);
  });

  it('keeps em/ne semantics for null, empty, and missing fields', async () => {
    const table = `empty-${sequence + 1}`;
    const database = createDatabase(table);
    const records = [
      { ...dbObj('null-value', table), rank: 1, label: null },
      { ...dbObj('empty-value', table), rank: 2, label: '' },
      { ...dbObj('missing-value', table), rank: 3 }
    ];
    await database.dbWriteObj(records);

    await expect(database.dbRead(table, ['label', 'em'])).resolves.toEqual([records[0], records[1]]);
    await expect(database.dbRead(table, ['label', 'ne'])).resolves.toEqual([records[2]]);
  });

  it('supports model transformations and save/delete events', async () => {
    const table = `transformed-${sequence + 1}`;
    const database = createDatabase(table);
    dbModelTransformation[table] = {
      viewModelToEntity: (object) => `${String(object.rank)}:${String(object.label)}`,
      entityToViewModel: (value) => {
        const [rank, label] = String(value).split(':');
        return { rank: Number(rank), label };
      }
    };
    const events: string[] = [];
    dbModelEvent[table] = {
      onSave: (previous, current) => { events.push(`${previous ? 'update' : 'insert'}:${current.uuid}`); },
      onDelete: (previous) => { events.push(`delete:${previous.uuid}`); }
    };
    const record = { ...dbObj('converted', table), rank: 3, label: 'three' };

    await database.dbWriteObj(record);
    await expect(database.dbReadObj('converted')).resolves.toEqual(record);
    await database.dbDeleteObj(record);
    expect(events).toEqual(['insert:converted', 'delete:converted']);
  });

  it('handles 10,000 records with numeric index ordering and pagination', async () => {
    const table = `scale-${sequence + 1}`;
    const database = createDatabase(table);
    const records = Array.from({ length: 10_000 }, (_, rank) => ({
      ...dbObj(`record-${String(rank).padStart(5, '0')}`, table),
      rank,
      label: `row-${rank}`
    }));

    await database.dbWriteObj(records);
    const result = await database.dbRead(table, ['rank', '>=', 9_990], 2, 5);
    expect(result.map(({ rank }) => rank)).toEqual([9_992, 9_993, 9_994, 9_995, 9_996]);
  }, 15_000);
});