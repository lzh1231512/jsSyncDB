import { DbBase } from './dbBase/dbBase';
import type { DbBaseOptions, DbCommand } from './dbBase/types';
import {
  dbModelColumn,
  dbModelEvent,
  dbModelIndex,
  dbModelIndexType,
  dbModelTransformation,
  type DbModelObject
} from './dbModel';

export type DbFilterOperator = '<' | '<=' | '>' | '>=' | '=' | 'bt' | 'in' | 'con' | 'sw' | 'em' | 'ne';
export type DbFilter = readonly [field: string, operator: DbFilterOperator, value?: unknown];
export type DbFilters = DbFilter | readonly DbFilter[] | null | undefined;
export type DbCoreCallback<T = void> = (result?: T | -1) => void;

type IndexItem = { u: string; i?: unknown };
type IndexBucket = { r: string; l: number; s: unknown; e: unknown; d?: IndexItem[] };
type TableIndex = { table: string; buckets: IndexBucket[]; entries: IndexItem[] };
type PendingEvent = { oldObject: DbModelObject | null; object: DbModelObject; isDelete: boolean };
type DbReadArguments = { filters: readonly DbFilter[]; skip: number; take: number; callback?: DbCoreCallback<DbModelObject[]> };

const indexLimit = 200;
const coreInstances = new Map<string, DbCore>();

export class DbTable {
  constructor(private readonly database: DbCore, readonly tableName: string) {}

  dbRead(filters?: DbFilters, skip?: number, take?: number, callback?: DbCoreCallback<DbModelObject[]>): Promise<DbModelObject[]>;
  dbRead(filters?: DbFilters, callback?: DbCoreCallback<DbModelObject[]>): Promise<DbModelObject[]>;
  dbRead(
    filters?: DbFilters,
    skipOrCallback?: number | DbCoreCallback<DbModelObject[]>,
    takeOrCallback?: number | DbCoreCallback<DbModelObject[]>,
    callback?: DbCoreCallback<DbModelObject[]>
  ): Promise<DbModelObject[]> {
    return this.database.dbRead(this.tableName, filters, skipOrCallback as number, takeOrCallback as number, callback);
  }
}

export class DbCore {
  private static readonly databases = coreInstances;
  private readonly db: DbBase;
  private writeTail: Promise<void> = Promise.resolve();

  constructor(dbName: string, dbType?: string, options?: DbBaseOptions) {
    this.db = DbBase.get(dbName, dbType, options);
  }

  static get(dbName: string, dbType?: string, options?: DbBaseOptions): DbCore {
    const existing = this.databases.get(dbName);
    if (existing) {
      return existing;
    }
    const database = new DbCore(dbName, dbType, options);
    this.databases.set(dbName, database);
    return database;
  }

  static clearInstances(): void {
    this.databases.clear();
    DbBase.clearInstances();
  }

  async dbOpObjs(
    isDelete: readonly number[],
    objects: readonly DbModelObject[],
    callback?: DbCoreCallback
  ): Promise<void> {
    const operation = this.serializeWrite(() => this.applyOperations(isDelete, objects));
    return this.withCallback(operation, callback);
  }

  async dbWriteObj(
    object: DbModelObject | readonly DbModelObject[],
    callback?: DbCoreCallback
  ): Promise<void> {
    const objects = Array.isArray(object) ? object : [object];
    return this.dbOpObjs(new Array(objects.length).fill(0), objects, callback);
  }

  async dbDeleteObj(
    object: DbModelObject | readonly DbModelObject[],
    callback?: DbCoreCallback
  ): Promise<void> {
    const objects = Array.isArray(object) ? object : [object];
    return this.dbOpObjs(new Array(objects.length).fill(1), objects, callback);
  }

  async dbReadObj(uuid: string, callback?: DbCoreCallback<DbModelObject>): Promise<DbModelObject> {
    const operation = this.readObject(uuid);
    return this.withCallback(operation, callback);
  }

  async dbReadObjs(
    uuids: readonly string[],
    callback?: DbCoreCallback<Array<DbModelObject | null>>
  ): Promise<Array<DbModelObject | null>> {
    const operation = this.writeTail.then(() => this.readObjects(uuids));
    return this.withCallback(operation, callback);
  }

  dbRead(table: string, callback?: DbCoreCallback<DbModelObject[]>): Promise<DbModelObject[]>;
  dbRead(table: string, filters: DbFilters, callback?: DbCoreCallback<DbModelObject[]>): Promise<DbModelObject[]>;
  dbRead(table: string, filters: DbFilters, skip: number, callback?: DbCoreCallback<DbModelObject[]>): Promise<DbModelObject[]>;
  dbRead(table: string, filters: DbFilters, skip: number, take: number, callback?: DbCoreCallback<DbModelObject[]>): Promise<DbModelObject[]>;
  dbRead(
    table: string,
    filtersOrCallback?: DbFilters | DbCoreCallback<DbModelObject[]>,
    skipOrCallback: number | DbCoreCallback<DbModelObject[]> = 0,
    takeOrCallback: number | DbCoreCallback<DbModelObject[]> = 0,
    callback?: DbCoreCallback<DbModelObject[]>
  ): Promise<DbModelObject[]> {
    const args = this.parseReadArguments(filtersOrCallback, skipOrCallback, takeOrCallback, callback);
    const operation = this.readTable(table, args);
    return this.withCallback(operation, args.callback);
  }

  async clearDB(callback?: DbCoreCallback): Promise<void> {
    const operation = this.serializeWrite(() => this.db.clear());
    return this.withCallback(operation, callback);
  }

  checkFormat(object: unknown): object is DbModelObject {
    if (!object || typeof object !== 'object') {
      return false;
    }
    const candidate = object as Partial<DbModelObject>;
    return Boolean(
      typeof candidate.uuid === 'string' && candidate.uuid.length > 0 &&
      typeof candidate.table === 'string' && candidate.table.length > 0 &&
      Array.isArray(dbModelColumn[candidate.table])
    );
  }

  get<T = string>(key: string, isJSON = false): T | null {
    return this.db.get<T>(key, isJSON);
  }

  set(key: string, value?: unknown): void {
    this.db.set(key, value);
  }

  getTable(table: string): DbTable {
    return new DbTable(this, table);
  }

  private async applyOperations(
    deleteFlags: readonly number[],
    inputObjects: readonly DbModelObject[]
  ): Promise<void> {
    if (deleteFlags.length !== inputObjects.length) {
      throw new Error('Delete flags and objects must have the same length.');
    }
    if (inputObjects.length === 0) {
      return;
    }

    const latest = new Map<string, { isDelete: boolean; object: DbModelObject }>();
    inputObjects.forEach((object, index) => {
      if (!this.checkFormat(object)) {
        throw new Error('Invalid legacy object. Register its table model first.');
      }
      latest.delete(object.uuid);
      latest.set(object.uuid, { isDelete: deleteFlags[index] === 1, object: cloneObject(object) });
    });

    const objects = [...latest.values()];
    const oldObjects = await this.readObjects(objects.map(({ object }) => object.uuid));
    const oldByUuid = new Map<string, DbModelObject>();
    oldObjects.forEach((object) => {
      if (object && this.checkFormat(object)) {
        oldByUuid.set(object.uuid, object);
      }
    });

    const affectedTables = new Map<string, TableIndex>();
    for (const { object } of objects) {
      if (!affectedTables.has(object.table)) {
        affectedTables.set(object.table, await this.loadTableIndex(object.table));
      }
    }
    for (const object of oldByUuid.values()) {
      if (!affectedTables.has(object.table)) {
        affectedTables.set(object.table, await this.loadTableIndex(object.table));
      }
    }

    for (const { isDelete, object } of objects) {
      const previous = oldByUuid.get(object.uuid);
      if (previous) {
        const oldIndex = affectedTables.get(previous.table)!;
        oldIndex.entries = oldIndex.entries.filter((entry) => entry.u !== previous.uuid);
      }
      if (!isDelete) {
        const index = affectedTables.get(object.table)!;
        index.entries.push(this.createIndexItem(object));
      }
    }

    const commands: DbCommand[] = [];
    for (const { isDelete, object } of objects) {
      if (isDelete) {
        this.db.setDBcmd(object.uuid, commands);
      } else {
        const encoded = this.viewModelToEntity(object);
        this.db.setDBcmd(object.uuid, encoded, commands);
      }
    }
    for (const index of affectedTables.values()) {
      this.writeTableIndex(index, commands);
    }

    await this.db.setDB(commands);
    for (const { isDelete, object } of objects) {
      const previous = oldByUuid.get(object.uuid) ?? null;
      await this.emitModelEvent(object, previous, isDelete);
    }
  }

  private async readObject(uuid: string): Promise<DbModelObject> {
    await this.writeTail;
    const stored = await this.db.getDB<unknown>(uuid, false);
    return stored === null ? {} as DbModelObject : this.entityToViewModel(stored, uuid) ?? {} as DbModelObject;
  }

  private async readObjects(uuids: readonly string[]): Promise<Array<DbModelObject | null>> {
    const stored = await this.db.getDB<unknown>(uuids, false);
    return stored.map((entity, index) => entity === null
      ? null
      : this.entityToViewModel(entity, uuids[index] ?? '')
    );
  }

  private async readTable(table: string, args: DbReadArguments): Promise<DbModelObject[]> {
    await this.writeTail;
    const index = await this.loadTableIndex(table);
    const usable = index.buckets.filter((bucket) => bucket.l > 0);
    const candidateBuckets = this.selectBuckets(table, usable, args.filters);
    const uuids = candidateBuckets.flatMap((bucket) => bucket.d?.map((item) => item.u) ?? []);
    if (uuids.length === 0) {
      return [];
    }

    const stored = await this.db.getDB<unknown>(uuids, false);
    const matched: DbModelObject[] = [];
    for (let index = 0; index < stored.length; index += 1) {
      const value = stored[index];
      if (value === null) {
        continue;
      }
      const object = this.entityToViewModel(value, uuids[index] ?? '');
      if (object?.table === table && matchesFilters(object, args.filters)) {
        matched.push(object);
      }
    }

    const offset = Math.max(args.skip, 0);
    const end = args.take > 0 ? offset + args.take : undefined;
    return matched.slice(offset, end);
  }

  private async loadTableIndex(table: string): Promise<TableIndex> {
    const storedIndex = await this.db.getDB<unknown>('table.' + table, true);
    const descriptors = Array.isArray(storedIndex) ? storedIndex as IndexBucket[] : [];
    const refs = descriptors.map((bucket) => bucket.r).filter((ref): ref is string => typeof ref === 'string');
    const values = refs.length > 0 ? await this.db.getDB<string>(refs, false) : [];
    const buckets: IndexBucket[] = [];
    const entries: IndexItem[] = [];

    descriptors.forEach((descriptor, index) => {
      if (!descriptor || typeof descriptor.r !== 'string') {
        return;
      }
      const raw = values[index];
      const bucketEntries = parseIndexEntries(raw ?? null, table, Boolean(dbModelIndex[table] && dbModelIndex[table] !== 'uuid'), dbModelIndexType[table]);
      const bucket: IndexBucket = {
        r: descriptor.r,
        l: bucketEntries.length,
        s: bucketEntries.length ? indexValue(bucketEntries[0]!, table) : descriptor.s,
        e: bucketEntries.length ? indexValue(bucketEntries[bucketEntries.length - 1]!, table) : descriptor.e,
        d: bucketEntries
      };
      buckets.push(bucket);
      entries.push(...bucketEntries);
    });

    return { table, buckets, entries };
  }

  private selectBuckets(table: string, buckets: readonly IndexBucket[], filters: readonly DbFilter[]): IndexBucket[] {
    const indexedField = dbModelIndex[table] ?? 'uuid';
    const indexFilter = filters.find(([field, operator]) => field === indexedField && operator !== 'con' && operator !== 'em' && operator !== 'ne');
    if (!indexFilter || indexFilter[2] === undefined || indexFilter[2] === null) {
      return [...buckets];
    }

    const [, operator, value] = indexFilter;
    return buckets.filter((bucket) => bucketRangeMatches(bucket, operator, value));
  }

  private writeTableIndex(index: TableIndex, commands: DbCommand[]): void {
    const { table } = index;
    const indexedField = dbModelIndex[table] ?? 'uuid';
    const hasCustomIndex = indexedField !== 'uuid';
    index.entries.sort((left, right) => compareValues(indexValue(left, table), indexValue(right, table)));

    const chunks: IndexItem[][] = [];
    for (let offset = 0; offset < index.entries.length; offset += indexLimit) {
      chunks.push(index.entries.slice(offset, offset + indexLimit));
    }

    const nextBuckets: IndexBucket[] = chunks.map((chunk, chunkIndex) => {
      const previous = index.buckets[chunkIndex];
      const ref = previous?.r ?? `r${this.nextIndexIdentity()}`;
      const first = chunk[0]!;
      const last = chunk[chunk.length - 1]!;
      const bucket: IndexBucket = {
        r: ref,
        l: chunk.length,
        s: indexValue(first, table),
        e: indexValue(last, table)
      };
      const serialized = hasCustomIndex
        ? chunk.map((entry) => `${entry.u},${String(entry.i ?? '')}`).join(',')
        : chunk.map((entry) => entry.u).join(',');
      this.db.setDBcmd(ref, serialized, commands);
      return bucket;
    });

    for (const removed of index.buckets.slice(chunks.length)) {
      this.db.setDBcmd(removed.r, commands);
      this.recycleIndexIdentity(removed.r);
    }
    this.db.setDBcmd(`table.${table}`, nextBuckets, commands);
  }

  private createIndexItem(object: DbModelObject): IndexItem {
    const indexedField = dbModelIndex[object.table] ?? 'uuid';
    return dbModelIndexType[object.table] === 'int'
      ? { u: object.uuid, ...(indexedField === 'uuid' ? {} : { i: parseInt(String(object[indexedField]), 10) }) }
      : { u: object.uuid, ...(indexedField === 'uuid' ? {} : { i: object[indexedField] }) };
  }

  private viewModelToEntity(object: DbModelObject): unknown {
    const table = object.table;
    const tableId = this.getTableIdentity(table);
    const transformation = dbModelTransformation[table];
    if (transformation) {
      return `${tableId},${String(transformation.viewModelToEntity(object))}`;
    }

    const columns = dbModelColumn[table];
    if (!columns) {
      throw new Error(`No column model is registered for table "${table}".`);
    }
    const entity: Record<string, unknown> = { b: tableId };
    columns.forEach((column, index) => {
      entity[columnName(index + 2)] = object[column];
    });
    return entity;
  }

  private entityToViewModel(value: unknown, uuid: string): DbModelObject | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string') {
      const comma = value.indexOf(',');
      if (comma > 0 && /^\d+$/.test(value.slice(0, comma))) {
        const table = this.getTableName(value.slice(0, comma));
        const transform = dbModelTransformation[table];
        if (!table || !transform) {
          throw new Error(`No entity transformation is registered for table index "${value.slice(0, comma)}".`);
        }
        return { ...transform.entityToViewModel(value.slice(comma + 1)), uuid, table };
      }
      const parsed = JSON.parse(value) as unknown;
      return this.entityToViewModel(parsed, uuid);
    }
    if (typeof value !== 'object') {
      return null;
    }

    const entity = value as Record<string, unknown>;
    const table = this.getTableName(entity.b);
    const columns = dbModelColumn[table];
    if (!table || !columns) {
      if (typeof entity.uuid === 'string' && typeof entity.table === 'string') {
        return { ...entity, uuid, table: entity.table } as DbModelObject;
      }
      throw new Error(`No column model is registered for stored table index "${String(entity.b)}".`);
    }
    const object: Record<string, unknown> = { uuid, table };
    columns.forEach((column, index) => {
      object[column] = entity[columnName(index + 2)];
    });
    return object as DbModelObject;
  }

  private getTableIdentity(table: string): number {
    const existing = this.db.get<number>(`tableName.${table}`);
    if (existing !== null) {
      return Number(existing);
    }
    const next = Number(this.db.get<number>('tableIndexIdentity') ?? 1);
    this.db.set('tableIndexIdentity', next + 1);
    this.db.set(`tableName.${table}`, next);
    this.db.set(`tableIndex.${next}`, table);
    return next;
  }

  private getTableName(identity: unknown): string {
    if (identity === undefined || identity === null) {
      return '';
    }
    return this.db.get<string>(`tableIndex.${identity}`) ?? '';
  }

  private nextIndexIdentity(): number {
    const recycled = this.db.get<number[]>('indexidentityRe', true) ?? [];
    if (recycled.length > 0) {
      const identity = recycled.shift()!;
      this.db.set('indexidentityRe', recycled);
      return identity;
    }
    const identity = Number(this.db.get<number>('indexidentity') ?? 1);
    this.db.set('indexidentity', identity + 1);
    return identity;
  }

  private recycleIndexIdentity(ref: string): void {
    const identity = Number.parseInt(ref.slice(1), 10);
    if (!Number.isFinite(identity)) {
      return;
    }
    const recycled = this.db.get<number[]>('indexidentityRe', true) ?? [];
    recycled.push(identity);
    this.db.set('indexidentityRe', recycled);
  }

  private async emitModelEvent(object: DbModelObject, previous: DbModelObject | null, isDelete: boolean): Promise<void> {
    const event = dbModelEvent[object.table];
    if (isDelete && previous && event?.onDelete) {
      await event.onDelete(previous);
    } else if (!isDelete && event?.onSave) {
      await event.onSave(previous, object);
    }
  }

  private parseReadArguments(
    filtersOrCallback: DbFilters | DbCoreCallback<DbModelObject[]> | undefined,
    skipOrCallback: number | DbCoreCallback<DbModelObject[]>,
    takeOrCallback: number | DbCoreCallback<DbModelObject[]>,
    callback?: DbCoreCallback<DbModelObject[]>
  ): DbReadArguments {
    let filters: DbFilters = typeof filtersOrCallback === 'function' ? undefined : filtersOrCallback;
    let skip = typeof skipOrCallback === 'number' ? skipOrCallback : 0;
    let take = typeof takeOrCallback === 'number' ? takeOrCallback : 0;
    let actualCallback = callback;
    if (typeof filtersOrCallback === 'function') {
      actualCallback = filtersOrCallback;
      filters = undefined;
    } else if (typeof skipOrCallback === 'function') {
      actualCallback = skipOrCallback;
      skip = 0;
      take = 0;
    } else if (typeof takeOrCallback === 'function') {
      actualCallback = takeOrCallback;
      take = 0;
    }
    return { filters: normalizeFilters(filters), skip, take, callback: actualCallback };
  }

  private serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeTail.then(operation);
    this.writeTail = result.then(() => undefined, () => undefined);
    return result;
  }

  private withCallback<T>(operation: Promise<T>, callback?: DbCoreCallback<T>): Promise<T> {
    if (callback) {
      void operation.then(
        (result) => callback(result),
        () => callback(-1)
      );
    }
    return operation;
  }
}

export { DbCore as MyDB };

function normalizeFilters(filters: DbFilters): readonly DbFilter[] {
  if (!filters) {
    return [];
  }
  const candidate = filters as readonly unknown[];
  if (typeof candidate[0] === 'string') {
    return [filters as DbFilter];
  }
  return candidate as readonly DbFilter[];
}

function matchesFilters(object: DbModelObject, filters: readonly DbFilter[]): boolean {
  return filters.every(([field, operator, expected]) => {
    const actual = object[field];
    switch (operator) {
      case '<': return actual !== undefined && compareValues(actual, expected) < 0;
      case '<=': return actual !== undefined && compareValues(actual, expected) <= 0;
      case '>': return actual !== undefined && compareValues(actual, expected) > 0;
      case '>=': return actual !== undefined && compareValues(actual, expected) >= 0;
      case '=': return actual === expected || actual == expected;
      case 'bt': return Array.isArray(expected) && actual !== undefined && compareValues(actual, expected[0]) >= 0 && compareValues(actual, expected[1]) < 0;
      case 'in': return Array.isArray(expected) && expected.some((value) => actual == value);
      case 'con': return typeof actual === 'string' && actual.includes(String(expected));
      case 'sw': return typeof actual === 'string' && actual.startsWith(String(expected));
      case 'em': return actual === null || actual === '';
      case 'ne': return actual !== null && actual !== '';
    }
  });
}

function compareValues(left: unknown, right: unknown): number {
  if (left == right) return 0;
  if (left === undefined || left === null) return -1;
  if (right === undefined || right === null) return 1;
  if (typeof left === 'string' && typeof right === 'string') {
    return left < right ? -1 : 1;
  }
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber < rightNumber ? -1 : 1;
  }
  return String(left) < String(right) ? -1 : 1;
}

function indexValue(item: IndexItem, table: string): unknown {
  if (dbModelIndex[table] && dbModelIndex[table] !== 'uuid') {
    return item.i;
  }
  return dbModelIndexType[table] === 'int' ? Number(item.u) : item.u;
}

function parseIndexEntries(raw: string | null, table: string, hasCustomIndex: boolean, indexType?: string): IndexItem[] {
  if (!raw) {
    return [];
  }
  const values = raw.split(',');
  const result: IndexItem[] = [];
  if (hasCustomIndex) {
    for (let index = 0; index + 1 < values.length; index += 2) {
      result.push({
        u: values[index]!,
        i: indexType === 'int' ? Number.parseInt(values[index + 1]!, 10) : values[index + 1]
      });
    }
  } else {
    for (const uuid of values) {
      result.push({ u: indexType === 'int' ? Number.parseInt(uuid, 10) + '' : uuid });
    }
  }
  return result;
}

function bucketRangeMatches(bucket: IndexBucket, operator: DbFilterOperator, value: unknown): boolean {
  const min = bucket.s;
  const max = bucket.e;
  switch (operator) {
    case '<': return min !== undefined && compareValues(min, value) < 0;
    case '<=': return min !== undefined && compareValues(min, value) <= 0;
    case '>': return max !== undefined && compareValues(max, value) > 0;
    case '>=': return max !== undefined && compareValues(max, value) >= 0;
    case '=': return min !== undefined && max !== undefined && compareValues(min, value) <= 0 && compareValues(max, value) >= 0;
    case 'bt': return Array.isArray(value) && min !== undefined && max !== undefined && compareValues(max, value[0]) >= 0 && compareValues(min, value[1]) < 0;
    case 'in': return Array.isArray(value) && value.some((item) => min !== undefined && max !== undefined && compareValues(min, item) <= 0 && compareValues(max, item) >= 0);
    case 'sw': {
      if (typeof min !== 'string' || typeof max !== 'string') return true;
      const prefix = String(value);
      const rangeStart = min.slice(0, prefix.length);
      const rangeEnd = max.slice(0, prefix.length);
      return rangeEnd >= prefix && rangeStart <= prefix;
    }
    default: return true;
  }
}

function columnName(index: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < alphabet.length) return alphabet[index]!;
  return alphabet[Math.floor(index / alphabet.length)]! + alphabet[index % alphabet.length]!;
}

function cloneObject(object: DbModelObject): DbModelObject {
  return JSON.parse(JSON.stringify(object)) as DbModelObject;
}