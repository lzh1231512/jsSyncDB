import { DbBase } from './dbBase/dbBase';
import { DbCore, MyDB } from './dbCore';
import { DbSync, MySyncDB } from './dbSync';
import {
  dbModelColumn,
  dbModelEvent,
  dbModelIndex,
  dbModelIndexType,
  dbModelTransformation,
  dbObj
} from './dbModel';
import { IndexedDbBackend } from './dbBase/indexedDbBackend';

type LegacyArrayExtend<T> = {
  lst: T[];
  isContain(value?: unknown, compareFunc?: (this: T, item: T, value: unknown) => unknown): boolean;
  remove(value: unknown, compareFunc?: (this: T, item: T, value: unknown) => unknown): boolean;
  filter(filterFunc: (this: T, item: T, index: number) => unknown): T[];
};

type LegacyExecQueue = {
  locked: number;
  lock(): void;
  push(func: (...args: unknown[]) => unknown, args?: unknown[]): void;
  release(): void;
  fixCallBack<T extends (...args: never[]) => unknown>(callback?: T): T;
};

type LegacyTimepiece = {
  reset(): void;
  check(): number;
  show(message?: string): void;
};

type LegacyArrayExtendFactory = {
  <T>(list: T[]): LegacyArrayExtend<T>;
  new <T>(list: T[]): LegacyArrayExtend<T>;
};

type LegacyTimepieceFactory = {
  (): LegacyTimepiece;
  new (): LegacyTimepiece;
};

type LegacyTools = {
  uuid: () => string;
  clone: <T>(value: T) => T;
  arrayExtend: LegacyArrayExtendFactory;
  _check: (condition: unknown, label?: string) => boolean;
  _log: (...values: unknown[]) => void;
  isArray: (value: unknown) => value is unknown[];
  timepiece: LegacyTimepieceFactory;
  ExecQueue: new () => LegacyExecQueue;
  toGlobal: (target: object) => void;
};

type LegacyJssDBFunction = {
  (code: string, dbName: string, serviceUrl: string, dbType?: string): DbSync;
  new (code: string, dbName: string, serviceUrl: string, dbType?: string): DbSync;
  dbBase: typeof DbBase & { IndexedDB: typeof IndexedDbBackend };
  dbCode: typeof DbCore;
  dbModelIndex: typeof dbModelIndex;
  dbModelColumn: typeof dbModelColumn;
  dbModelIndexType: typeof dbModelIndexType;
  dbModelTransformation: typeof dbModelTransformation;
  dbModelEvent: typeof dbModelEvent;
  _dbObj: typeof dbObj;
  MyDB: typeof MyDB;
  MySyncDB: typeof MySyncDB;
  tools: LegacyTools;
};

const createArrayExtend = function <T>(list: T[]): LegacyArrayExtend<T> {
  return {
    lst: list,
    isContain(value?: unknown, compareFunc?: (this: T, item: T, value: unknown) => unknown): boolean {
      if (typeof value === 'function') {
        compareFunc = value as (this: T, item: T, value: unknown) => unknown;
        value = null;
      }
      return list.some((item) => compareFunc
        ? Boolean(compareFunc.apply(item, [item, value]))
        : item == value);
    },
    remove(value: unknown, compareFunc?: (this: T, item: T, value: unknown) => unknown): boolean {
      const index = list.findIndex((item) => compareFunc
        ? Boolean(compareFunc.apply(item, [item, value]))
        : item == value);
      if (index < 0) return false;
      list.splice(index, 1);
      return true;
    },
    filter(filterFunc: (this: T, item: T, index: number) => unknown): T[] {
      return list.filter((item, index) => Boolean(filterFunc.apply(item, [item, index])));
    }
  };
} as LegacyArrayExtendFactory;

const createTimepiece = function (): LegacyTimepiece {
  let startedAt = Date.now();
  return {
    reset: () => { startedAt = Date.now(); },
    check: () => (Date.now() - startedAt) / 1000,
    show: (message = '') => console.log(`time spent: ${(Date.now() - startedAt) / 1000}s ${message}`)
  };
} as LegacyTimepieceFactory;

class LegacyExecQueueImpl implements LegacyExecQueue {
  locked = 0;
  private readonly pending: Array<[func: (...args: unknown[]) => unknown, args: unknown[]]> = [];

  lock(): void {
    this.locked = 1;
  }

  push(func: (...args: unknown[]) => unknown, args: unknown[] = []): void {
    this.pending.push([func, args]);
  }

  release(): void {
    this.locked = 0;
    const next = this.pending.shift();
    if (next) next[0].apply(this, next[1]);
  }

  fixCallBack<T extends (...args: never[]) => unknown>(callback?: T): T {
    const queue = this;
    return function (this: unknown, ...args: never[]) {
      setTimeout(() => {
        queue.locked = 0;
        const next = queue.pending.shift();
        if (next) next[0].apply(queue, next[1]);
      }, 0);
      if (callback) callback.apply(this, args);
    } as T;
  }
}

function createUuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const JssDB = function (code: string, dbName: string, serviceUrl: string, dbType?: string): DbSync {
  return new DbSync(code, dbName, serviceUrl, dbType);
} as LegacyJssDBFunction;

const tools: LegacyTools = {
  uuid: createUuid,
  clone: <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T,
  arrayExtend: createArrayExtend,
  isArray: (value: unknown): value is unknown[] => Array.isArray(value),
  timepiece: createTimepiece,
  ExecQueue: LegacyExecQueueImpl,
  toGlobal: (target: object): void => {
    Object.assign(target, {
      uuid: tools.uuid,
      clone: tools.clone,
      arrayExtend: tools.arrayExtend,
      _check: tools._check,
      _log: tools._log,
      isArray: tools.isArray,
      timepiece: tools.timepiece,
      ExecQueue: tools.ExecQueue
    });
  },
  _check: (condition: unknown, label = 'check'): boolean => {
    const passed = Boolean(condition);
    if (!passed) console.error(`${label} check:failed`);
    return passed;
  },
  _log: (...values: unknown[]): void => console.log(...values)
};

Object.assign(JssDB, {
  dbBase: Object.assign(DbBase, { IndexedDB: IndexedDbBackend }),
  dbCode: DbCore,
  dbModelIndex,
  dbModelColumn,
  dbModelIndexType,
  dbModelTransformation,
  dbModelEvent,
  _dbObj: dbObj,
  MyDB,
  MySyncDB,
  tools
});

export default JssDB;