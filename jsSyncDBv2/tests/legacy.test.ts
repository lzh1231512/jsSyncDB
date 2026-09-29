import { indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import JssDB from '../src/legacy';
import { DbBase, DbCore, DbSync } from '../src';

class TestLocalStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

afterEach(() => {
  JssDB.MySyncDB.clearInstances();
  DbSync.clearInstances();
  DbCore.clearInstances();
  DbBase.clearInstances();
  vi.unstubAllGlobals();
});

describe('classic script compatibility entry', () => {
  it('exposes the constructor and mutable model registries expected by legacy scripts', () => {
    expect(typeof JssDB).toBe('function');
    expect(JssDB.dbModelColumn).toBeDefined();
    expect(JssDB.dbModelIndex).toBeDefined();
    expect(JssDB.dbModelIndexType).toBeDefined();
    expect(JssDB.dbModelTransformation).toBeDefined();
    expect(JssDB.dbModelEvent).toBeDefined();
    expect(JssDB.dbBase.get).toBe(DbBase.get);
    expect(JssDB.dbCode.get).toBe(DbCore.get);
    expect(JssDB.MyDB).toBe(DbCore);
    expect(JssDB.MySyncDB).toBe(DbSync);
  });

  it('supports the legacy new JssDB(code, dbName, serviceUrl, dbType) call', async () => {
    vi.stubGlobal('localStorage', new TestLocalStorage());
    vi.stubGlobal('indexedDB', indexedDB);
    JssDB.dbModelColumn.LegacyTable = ['value'];

    const database = new JssDB('legacy-code', 'legacy-db', 'https://example.invalid/api');
    expect(database).toBeInstanceOf(DbSync);

    await database.writeObj({ uuid: 'legacy-record', table: 'LegacyTable', value: 'works' });
    await expect(database.dbReadObj('legacy-record')).resolves.toEqual({
      uuid: 'legacy-record',
      table: 'LegacyTable',
      value: 'works'
    });
  });

  it('restores legacy array, timing, queue, and global-export helpers', async () => {
    const tools = JssDB.tools;
    const objects = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const extended = tools.arrayExtend(objects);
    const constructedArrayTools = new tools.arrayExtend(objects);
    expect(extended.isContain(2, function (item, value) { return item.id === value; })).toBe(true);
    expect(constructedArrayTools.isContain(1, function (item, value) { return item.id === value; })).toBe(true);
    expect(extended.filter(function (item, index) { return this === item && index > 0; })).toEqual(objects.slice(1));
    expect(extended.remove(2, function (item, value) { return item.id === value; })).toBe(true);
    expect(objects.map(({ id }) => id)).toEqual([1, 3]);

    const clock = tools.timepiece();
    const constructedClock = new tools.timepiece();
    expect(clock.check()).toBeGreaterThanOrEqual(0);
    expect(constructedClock.check()).toBeGreaterThanOrEqual(0);
    expect(() => clock.show('legacy helper')).not.toThrow();
    clock.reset();
    expect(clock.check()).toBeGreaterThanOrEqual(0);

    const queue = new tools.ExecQueue();
    const calls: string[] = [];
    queue.lock();
    queue.push(() => { calls.push('queued'); });
    queue.fixCallBack(() => { calls.push('callback'); })();
    expect(calls).toEqual(['callback']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toEqual(['callback', 'queued']);
    expect(queue.locked).toBe(0);

    const target = function () {} as { (): void; [key: string]: unknown };
    tools.toGlobal(target);
    expect(target.arrayExtend).toBe(tools.arrayExtend);
    expect(target.timepiece).toBe(tools.timepiece);
    expect(target.ExecQueue).toBe(tools.ExecQueue);
    expect(target.uuid).toBe(tools.uuid);
  });
});