import { DbCore } from './dbCore';
import type { DbBaseOptions } from './dbBase/types';
import {
  dbModelColumn,
  dbModelIndex,
  dbModelIndexType,
  dbModelTransformation,
  type DbModelObject
} from './dbModel';
import {
  FetchSyncTransport,
  type SyncDownloadObject,
  type SyncTransport,
  type SyncUploadResponse,
  type SyncWireObject
} from './syncTransport';

export type SyncResult = number | SyncEvent[];
export type SyncCallback<T = SyncResult> = (result: T | -1) => void;
type SyncLifecycleContext = {
  id: string;
  operation: 'sync' | 'upload' | 'download' | 'restore';
  source: 'manual' | 'auto';
};
export type SyncLifecycleEvent =
  | (SyncLifecycleContext & { phase: 'start' })
  | (SyncLifecycleContext & { phase: 'end'; result: SyncResult; error?: never })
  | (SyncLifecycleContext & { phase: 'end'; error: unknown; result?: never });
export type SyncLifecycleListener = (event: SyncLifecycleEvent) => void;

export type SyncEvent = DbModelObject & {
  isDelete: number;
  objuuid: string;
  data?: DbModelObject | null;
  fromLocal?: boolean;
};

type UploadSnapshot = { event: SyncEvent; wire: SyncWireObject };
type RestoreSnapshot = { event: SyncEvent; wire: SyncWireObject & { id: number } };

export type DbSyncOptions = {
  database?: DbCore;
  dbOptions?: DbBaseOptions;
  transport?: SyncTransport;
  transferLimit?: number;
  uuidFactory?: () => string;
  disableSyncTables?: readonly string[];
};

const transferLimitDefault = 100;
const syncInstances = new Map<string, DbSync>();

registerSyncModels();

export class DbSync {
  private static readonly instances = syncInstances;
  private readonly database: DbCore;
  private readonly transport: SyncTransport;
  private readonly transferLimit: number;
  private readonly uuidFactory: () => string;
  private readonly disabledTables: ReadonlySet<string>;
  private code: string;
  private databaseName: string;
  private serviceUrl: string;
  private uploadBusy = false;
  private downloadBusy = false;
  private restoreBusy = false;
  private hasNewData = false;
  private isWait = -1;
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private autoSocket: WebSocket | null = null;
  private lastSocketAttempt = 0;
  private lastSocketHeartbeat = 0;
  private autoRetrySeconds = 0;
  private autoUploadBusy = false;
  private autoRestoreBusy = false;
  private autoDownloadBusy = false;
  private readonly syncLifecycleListeners = new Set<SyncLifecycleListener>();
  private syncOperationSequence = 0;

  constructor(
    code: string,
    databaseName: string,
    serviceUrl: string,
    dbType?: string,
    options: DbSyncOptions = {}
  ) {
    this.code = code;
    this.databaseName = databaseName;
    this.serviceUrl = normalizeServiceUrl(serviceUrl);
    this.database = options.database ?? DbCore.get(`${databaseName}_${code}`, dbType, options.dbOptions);
    this.transport = options.transport ?? new FetchSyncTransport();
    this.transferLimit = options.transferLimit ?? transferLimitDefault;
    this.uuidFactory = options.uuidFactory ?? createUuid;
    this.disabledTables = new Set(options.disableSyncTables ?? []);
  }

  static get(
    databaseName: string,
    code: string,
    serviceUrl: string,
    dbType?: string,
    options?: DbSyncOptions
  ): DbSync {
    const key = `${databaseName}_${code}`;
    const existing = this.instances.get(key);
    if (existing) return existing;
    const instance = new DbSync(code, databaseName, serviceUrl, dbType, options);
    this.instances.set(key, instance);
    return instance;
  }

  static clearInstances(): void {
    this.instances.clear();
  }

  opObj(
    deleteFlags: readonly number[],
    objects: readonly DbModelObject[],
    callback?: SyncCallback<void>
  ): Promise<void> {
    return this.withCallback(this.operateObjects(deleteFlags, objects), callback);
  }

  async writeObj(objects: DbModelObject | readonly DbModelObject[], callback?: SyncCallback<void | -1>): Promise<void> {
    const list = Array.isArray(objects) ? objects : [objects];
    return this.withCallback(this.writeOrDelete(list, false), callback);
  }

  async deleteObj(objects: DbModelObject | readonly DbModelObject[], callback?: SyncCallback<void | -1>): Promise<void> {
    const list = Array.isArray(objects) ? objects : [objects];
    return this.withCallback(this.writeOrDelete(list, true), callback);
  }

  writeObjWithoutSync(
    objects: DbModelObject | readonly DbModelObject[],
    callback?: SyncCallback<void | -1>
  ): Promise<void> {
    return this.withCallback(this.database.dbWriteObj(objects), callback);
  }

  deleteObjWithoutSync(
    objects: DbModelObject | readonly DbModelObject[],
    callback?: SyncCallback<void | -1>
  ): Promise<void> {
    return this.withCallback(this.database.dbDeleteObj(objects), callback);
  }

  dbReadObj(uuid: string, callback?: SyncCallback<DbModelObject>): Promise<DbModelObject> {
    return this.withCallback(this.database.dbReadObj(uuid), callback);
  }

  dbRead(
    table: string,
    filters?: Parameters<DbCore['dbRead']>[1],
    skip?: number,
    take?: number,
    callback?: SyncCallback<DbModelObject[]>
  ): Promise<DbModelObject[]> {
    return this.withCallback(this.database.dbRead(table, filters, skip ?? 0, take ?? 0), callback);
  }

  async readMainIndex(
    beginId = 0,
    skip = 0,
    take = 0,
    callback?: SyncCallback<SyncEvent[]>
  ): Promise<SyncEvent[]> {
    const operation = this.readMainIndexCore(beginId, skip, take);
    return this.withCallback(operation, callback);
  }

  async restore(callback?: SyncCallback<number>): Promise<number> {
    return this.restoreWithSource(callback, 'manual');
  }

  async upload(callback?: SyncCallback<number>): Promise<number> {
    return this.uploadWithSource(callback, 'manual');
  }

  async download(callback?: SyncCallback<SyncResult>): Promise<SyncResult> {
    return this.downloadWithSource(callback, 'manual');
  }

  async sync(callback?: SyncCallback<SyncResult>): Promise<SyncResult> {
    this.isWait = -1;
    const operation = this.runTrackedOperation('sync', 'manual', () => this.syncCore());
    return this.withCallback(operation, callback);
  }

  onSyncEvent(listener: SyncLifecycleListener): () => void {
    this.syncLifecycleListeners.add(listener);
    return () => { this.syncLifecycleListeners.delete(listener); };
  }

  autoSync(callback: SyncCallback<SyncResult>, reconnectionInterval = 30): void {
    if (this.autoTimer !== null) return;
    this.isWait = 0;
    this.autoRetrySeconds = 0;
    this.autoUploadBusy = false;
    this.autoRestoreBusy = false;
    this.autoDownloadBusy = false;
    this.autoTimer = setInterval(() => {
      if (typeof WebSocket !== 'undefined') {
        this.autoSocketTick(callback, reconnectionInterval);
      } else {
        void this.autoPollingTick(callback);
      }
    }, 1000);
  }

  stopAutoSync(): void {
    if (this.autoTimer !== null) clearInterval(this.autoTimer);
    this.autoTimer = null;
    const socket = this.autoSocket;
    this.autoSocket = null;
    if (socket && socket.readyState < 2) socket.close();
    this.autoUploadBusy = false;
    this.autoRestoreBusy = false;
    this.autoDownloadBusy = false;
  }

  clear(callback?: SyncCallback<void>): Promise<void> {
    this.hasNewData = false;
    return this.withCallback(this.database.clearDB(), callback);
  }

  getTable(table: string) {
    return this.database.getTable(table);
  }

  setService(code: string, serviceUrl: string): void {
    this.code = code;
    this.serviceUrl = normalizeServiceUrl(serviceUrl);
  }

  private async writeOrDelete(objects: readonly DbModelObject[], isDelete: boolean): Promise<void> {
    return this.operateObjects(objects.map(() => isDelete ? 1 : 0), objects);
  }

  private async operateObjects(deleteFlags: readonly number[], objects: readonly DbModelObject[]): Promise<void> {
    if (deleteFlags.length !== objects.length) {
      throw new Error('Delete flags and objects must have the same length.');
    }
    const operations: DbModelObject[] = [];
    const flags: number[] = [];
    objects.forEach((object, index) => {
      const isDelete = deleteFlags[index] === 1;
      if (!this.disabledTables.has(object.table) && !object.table.startsWith('mainSync')) {
        operations.push(this.createTempEvent(object, isDelete));
        flags.push(0);
      }
      operations.push(object);
      flags.push(isDelete ? 1 : 0);
    });
    await this.database.dbOpObjs(flags, operations);
    if (operations.length > 0) this.hasNewData = true;
  }

  private createTempEvent(object: DbModelObject, isDelete: boolean): SyncEvent {
    const sequence = Number(this.database.get<number>('newTempSyncObjUUID') ?? 0) + 1;
    this.database.set('newTempSyncObjUUID', sequence);
    return {
      uuid: `t${String(sequence).padStart(8, '0')}`,
      table: 'mainSync.Temp',
      isDelete: isDelete ? 1 : 0,
      objuuid: object.uuid
    };
  }

  private async uploadCore(): Promise<number> {
    let restored = false;
    try {
      while (true) {
        const checkpoint = this.database.get<UploadSnapshot[]>('tempUploadData', true);
        const pending = checkpoint?.map(({ event }) => event)
          ?? await this.database.dbRead('mainSync.Temp', null, 0, this.transferLimit) as SyncEvent[];
        if (pending.length === 0) {
          this.clearUploadCheckpoint();
          this.hasNewData = false;
          return 1;
        }

        const snapshot: UploadSnapshot[] = checkpoint ?? await this.makeUploadSnapshot(pending);
        const uploadToken = this.database.get<string>('uploadUUID') || this.uuidFactory();
        this.database.set('uploadUUID', uploadToken);
        this.database.set('tempUploadData', snapshot);

        const response = await this.transport.upload(this.endpoint('UploadDBObj'), {
          Code: this.code,
          DBName: this.databaseName,
          Data: JSON.stringify(snapshot.map(({ wire }) => wire)),
          uuid: this.database.get<string>('uuid') ?? '',
          localUUID: this.getLocalUuid(),
          uploadUUID: uploadToken,
          restore: '0',
          localMaxId: this.currentIndex()
        });

        if (response.status === -2) {
          if (restored) return -2;
          const restoreStatus = await this.restoreFrom(response.lastId ?? 0);
          if (restoreStatus !== 1) return restoreStatus;
          restored = true;
          this.clearUploadCheckpoint();
          continue;
        }
        if (response.status !== 1) return response.status || -9;
        if (response.uuid && !this.database.get('uuid')) this.database.set('uuid', response.uuid);

        const acknowledgements = response.data ?? [];
        const acknowledged = new Set(acknowledgements.map((item) => item.objuuid));
        if (snapshot.some(({ event }) => !acknowledged.has(event.objuuid))) return -9;

        const localIds = this.database.get<Record<string, number>>('localids', true) ?? {};
        for (const item of acknowledgements) localIds[`s${item.id}`] = 1;
        this.database.set('localids', localIds);
        await this.database.dbDeleteObj(snapshot.map(({ event }) => event));
        this.clearUploadCheckpoint();
      }
    } catch {
      return -9;
    }
  }

  private async makeUploadSnapshot(events: readonly SyncEvent[]): Promise<UploadSnapshot[]> {
    const values = await this.database.dbReadObjs(events.map(({ objuuid }) => objuuid));
    return events.map((event, index) => {
      const data = values[index] ? stripUuid(values[index]!) : null;
      return {
        event,
        wire: {
          objuuid: event.objuuid,
          isDelete: Number(event.isDelete),
          data: JSON.stringify(data)
        }
      };
    });
  }

  private async downloadCore(): Promise<SyncResult> {
    const changes: SyncEvent[] = [];
    try {
      while (true) {
        const beginId = this.currentIndex() + 1;
        const isWait = this.isWait;
        if (this.isWait === 0) this.isWait = 1;
        const response = await this.transport.download(this.endpoint('DownloadDBObj'), {
          Code: this.code,
          DBName: this.databaseName,
          uuid: this.database.get<string>('uuid') ?? '',
          beginId,
          isWait,
          take: this.transferLimit
        });
        if (response.status === -2) {
          return await this.restoreFrom(response.maxId ?? 0);
        }
        if (response.status !== 1) return response.status || -9;
        if (response.uuid && !this.database.get('uuid')) this.database.set('uuid', response.uuid);

        const rows: SyncDownloadObject[] = response.data ?? [];
        if (rows.length === 0) return changes.length > 0 ? changes : 1;
        if (Number(rows[rows.length - 1]!.id) < beginId) return -9;
        const localIds = this.database.get<Record<string, number>>('localids', true) ?? {};
        const flags: number[] = [];
        const objects: DbModelObject[] = [];

        for (const row of rows) {
          const fromLocal = localIds[`s${row.id}`] === 1;
          if (fromLocal) delete localIds[`s${row.id}`];
          const data = parseWireData(row.data, row.objuuid);
          if (!fromLocal && data) {
            objects.push(data);
            flags.push(row.isDelete === 1 ? 1 : 0);
          }
          objects.push(makeSyncEvent(row.id, row.objuuid, row.isDelete));
          flags.push(0);
          changes.push({
            ...makeSyncEvent(row.id, row.objuuid, row.isDelete),
            fromLocal,
            ...(data ? { data } : {})
          });
        }
        for (const id of response.delIds ?? []) {
          objects.push({ uuid: String(id), table: 'mainSync' });
          flags.push(1);
        }

        await this.database.dbOpObjs(flags, objects);
        this.database.set('localids', localIds);
        this.database.set('index', Number(rows[rows.length - 1]!.id));
        const lastId = Number(rows[rows.length - 1]!.id);
        if (lastId >= Number(response.maxId ?? lastId)) return changes;
      }
    } catch {
      return -9;
    }
  }

  private async restoreCore(): Promise<number> {
    return this.restoreFrom(this.restoreSeek());
  }

  private async restoreFrom(startAfter: number): Promise<number> {
    let seek = startAfter;
    this.database.set('restoreSeek', seek);
    try {
      while (true) {
        const events = await this.database.dbRead('mainSync', ['uuid', '>', seek], 0, this.transferLimit) as SyncEvent[];
        if (events.length === 0) {
          this.database.set('restoreSeek', -1);
          this.database.set('uploadUUIDForRestore', null);
          this.database.set('restoreUploadData', null);
          return 1;
        }
        const storedSnapshot = this.database.get<RestoreSnapshot[]>('restoreUploadData', true);
        const snapshot = storedSnapshot ?? await this.makeRestoreSnapshot(events);
        const uploadToken = this.database.get<string>('uploadUUIDForRestore') || this.uuidFactory();
        this.database.set('uploadUUIDForRestore', uploadToken);
        this.database.set('restoreUploadData', snapshot);
        const response = await this.transport.upload(this.endpoint('UploadDBObj'), {
          Code: this.code,
          DBName: this.databaseName,
          Data: JSON.stringify(snapshot.map(({ wire }) => ({ ...wire, id: Number(wire.id) }))),
          uuid: this.database.get<string>('uuid') ?? '',
          localUUID: this.getLocalUuid(),
          uploadUUID: uploadToken,
          restore: '1',
          localMaxId: seek
        });
        if (response.status !== 1) return response.status || -9;
        if (response.uuid && !this.database.get('uuid')) this.database.set('uuid', response.uuid);
        seek = Number(snapshot[snapshot.length - 1]!.event.uuid);
        this.database.set('restoreSeek', seek);
        this.database.set('uploadUUIDForRestore', null);
        this.database.set('restoreUploadData', null);
      }
    } catch {
      return -9;
    }
  }

  private async makeRestoreSnapshot(events: readonly SyncEvent[]): Promise<RestoreSnapshot[]> {
    const values = await this.database.dbReadObjs(events.map(({ objuuid }) => objuuid));
    return events.map((event, index) => ({
      event,
      wire: {
        id: Number(event.uuid),
        objuuid: event.objuuid,
        isDelete: Number(event.isDelete),
        data: JSON.stringify(values[index] ? stripUuid(values[index]!) : null)
      }
    }));
  }

  private async syncCore(): Promise<SyncResult> {
    if (this.restoreSeek() >= 0) {
      const restoreStatus = await this.executeRestore();
      if (restoreStatus !== 1) return restoreStatus;
    }
    const uploadStatus = await this.executeUpload();
    if (uploadStatus !== 1) return -9;
    return this.executeDownload();
  }

  private async restoreWithSource(callback: SyncCallback<number> | undefined, source: 'manual' | 'auto'): Promise<number> {
    if (this.restoreBusy) return this.withCallback(Promise.resolve(-2), callback);
    const operation = this.runTrackedOperation('restore', source, () => this.executeRestore());
    return this.withCallback(operation, callback);
  }

  private async uploadWithSource(callback: SyncCallback<number> | undefined, source: 'manual' | 'auto'): Promise<number> {
    if (this.uploadBusy || this.restoreBusy) return this.withCallback(Promise.resolve(-3), callback);
    const operation = this.runTrackedOperation('upload', source, () => this.executeUpload());
    return this.withCallback(operation, callback);
  }

  private async downloadWithSource(
    callback: SyncCallback<SyncResult> | undefined,
    source: 'manual' | 'auto'
  ): Promise<SyncResult> {
    if (this.downloadBusy || this.restoreBusy) return this.withCallback(Promise.resolve(-2), callback);
    const operation = this.runTrackedOperation('download', source, () => this.executeDownload());
    return this.withCallback(operation, callback);
  }

  private async executeRestore(): Promise<number> {
    if (this.restoreBusy) return -2;
    this.restoreBusy = true;
    try {
      return await this.restoreCore();
    } finally {
      this.restoreBusy = false;
    }
  }

  private async executeUpload(): Promise<number> {
    if (this.uploadBusy || this.restoreBusy) return -3;
    this.uploadBusy = true;
    try {
      return await this.uploadCore();
    } finally {
      this.uploadBusy = false;
    }
  }

  private async executeDownload(): Promise<SyncResult> {
    if (this.downloadBusy || this.restoreBusy) return -2;
    this.downloadBusy = true;
    try {
      return await this.downloadCore();
    } finally {
      this.downloadBusy = false;
    }
  }

  private async runTrackedOperation<T extends SyncResult>(
    operation: SyncLifecycleEvent['operation'],
    source: SyncLifecycleEvent['source'],
    action: () => Promise<T>
  ): Promise<T> {
    const id = String(++this.syncOperationSequence);
    this.emitSyncEvent({ phase: 'start', id, operation, source });
    try {
      const result = await action();
      this.emitSyncEvent({ phase: 'end', id, operation, source, result });
      return result;
    } catch (error) {
      this.emitSyncEvent({ phase: 'end', id, operation, source, error });
      throw error;
    }
  }

  private emitSyncEvent(event: SyncLifecycleEvent): void {
    for (const listener of [...this.syncLifecycleListeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error('Sync lifecycle listener failed.', error);
      }
    }
  }

  private autoSocketTick(callback: SyncCallback<SyncResult>, reconnectionInterval: number): void {
    const socket = this.autoSocket;
    if (socket?.readyState === 1) {
      if (Date.now() - this.lastSocketHeartbeat >= 300_000) {
        try {
          socket.send('1');
          this.lastSocketHeartbeat = Date.now();
        } catch {
          socket.close();
        }
      }
    } else if (this.lastSocketAttempt === 0 || Date.now() - this.lastSocketAttempt >= Math.max(reconnectionInterval, 1) * 1000) {
      this.openAutoSocket(callback);
    }

    if (this.autoRetrySeconds > 0) {
      this.autoRetrySeconds -= 1;
      return;
    }
    if (this.restoreSeek() >= 0) {
      void this.runAutoRestore();
    } else if (this.hasNewData) {
      void this.runAutoUpload();
    }
  }

  private openAutoSocket(callback: SyncCallback<SyncResult>): void {
    this.lastSocketAttempt = Date.now();
    const previous = this.autoSocket;
    if (previous && previous.readyState < 2) previous.close();

    let socket: WebSocket;
    try {
      socket = new WebSocket(createWebSocketUrl(this.serviceUrl));
    } catch (error) {
      console.error('WebSocket connection failed.', error);
      return;
    }
    this.autoSocket = socket;
    socket.onopen = () => {
      if (this.autoSocket !== socket) return;
      this.lastSocketHeartbeat = Date.now();
      try {
        socket.send(JSON.stringify({ DBName: this.databaseName, Code: this.code }));
      } catch {
        socket.close();
        return;
      }
      void this.downloadWithSource(callback, 'auto');
    };
    socket.onmessage = (event: MessageEvent) => {
      if (this.autoSocket === socket && event.data === '1') void this.downloadWithSource(callback, 'auto');
    };
    socket.onclose = () => {
      if (this.autoSocket === socket) this.autoSocket = null;
    };
    socket.onerror = (event: Event) => {
      console.error('WebSocket connection error.', event);
    };
  }

  private autoPollingTick(callback: SyncCallback<SyncResult>): void {
    if (this.autoRetrySeconds > 0) {
      this.autoRetrySeconds -= 1;
      return;
    }
    if (this.restoreSeek() >= 0) {
      if (!this.autoRestoreBusy) void this.runAutoRestore();
      return;
    }
    if (this.hasNewData && !this.autoUploadBusy) void this.runAutoUpload();
    if (this.autoDownloadBusy) return;
    this.autoDownloadBusy = true;
    void this.downloadWithSource(callback, 'auto')
      .then((result) => {
        if (result === -9) this.autoRetrySeconds = 30;
      })
      .finally(() => { this.autoDownloadBusy = false; });
  }

  private async runAutoRestore(): Promise<void> {
    if (this.autoRestoreBusy) return;
    this.autoRestoreBusy = true;
    try {
      const status = await this.restoreWithSource(undefined, 'auto');
      if (status === -9) this.autoRetrySeconds = 30;
    } finally {
      this.autoRestoreBusy = false;
    }
  }

  private async runAutoUpload(): Promise<void> {
    if (this.autoUploadBusy) return;
    this.autoUploadBusy = true;
    try {
      const status = await this.uploadWithSource(undefined, 'auto');
      if (status === -9) this.autoRetrySeconds = 30;
    } finally {
      this.autoUploadBusy = false;
    }
  }

  private async readMainIndexCore(beginId: number, skip: number, take: number): Promise<SyncEvent[]> {
    const events = await this.database.dbRead('mainSync', ['uuid', '>=', beginId], skip, take) as SyncEvent[];
    const visible = events.filter((event) => !event.isDelete);
    const data = await this.database.dbReadObjs(visible.map(({ objuuid }) => objuuid));
    let dataIndex = 0;
    return events.map((event) => {
      if (event.isDelete) return event;
      const value = data[dataIndex++];
      return value ? { ...event, data: value } : event;
    });
  }

  private currentIndex(): number {
    return Number(this.database.get('index') ?? 0) || 0;
  }

  private restoreSeek(): number {
    const value = Number(this.database.get('restoreSeek') ?? -1);
    return Number.isFinite(value) ? value : -1;
  }

  private getLocalUuid(): string {
    let localUuid = this.database.get<string>('localUUID');
    if (!localUuid) {
      localUuid = this.uuidFactory();
      this.database.set('localUUID', localUuid);
    }
    return localUuid;
  }

  private clearUploadCheckpoint(): void {
    this.database.set('uploadUUID', null);
    this.database.set('tempUploadData', null);
  }

  private endpoint(path: string): string {
    return `${this.serviceUrl}${path}`;
  }

  private withCallback<T>(operation: Promise<T>, callback?: (result: T | -1) => void): Promise<T> {
    if (callback) {
      void operation.then((result) => callback(result), () => callback(-1));
    }
    return operation;
  }
}

export { DbSync as MySyncDB };

function registerSyncModels(): void {
  dbModelColumn.mainSync = ['isDelete', 'objuuid'];
  dbModelIndex.mainSync = 'uuid';
  dbModelIndexType.mainSync = 'int';
  dbModelTransformation.mainSync = {
    viewModelToEntity: (object) => `${Number(object.isDelete)},${String(object.objuuid)}`,
    entityToViewModel: (entity) => {
      const [isDelete, objuuid] = String(entity).split(',');
      return { isDelete: Number.parseInt(isDelete ?? '0', 10), objuuid: objuuid ?? '' };
    }
  };
  dbModelColumn['mainSync.Temp'] = ['isDelete', 'objuuid'];
  dbModelIndex['mainSync.Temp'] = 'uuid';
  dbModelTransformation['mainSync.Temp'] = dbModelTransformation.mainSync;
}

function normalizeServiceUrl(url: string): string {
  return url && !url.endsWith('/') ? `${url}/` : url;
}

function createWebSocketUrl(serviceUrl: string): string {
  const url = new URL('ws', serviceUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

function createUuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function stripUuid(object: DbModelObject): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...object };
  delete copy.uuid;
  return copy;
}

function parseWireData(value: string | null | undefined, uuid: string): DbModelObject | null {
  if (!value || value === 'null') return null;
  const parsed = typeof value === 'string' ? JSON.parse(value) as Record<string, unknown> : value;
  if (!parsed || typeof parsed !== 'object' || typeof parsed.table !== 'string') return null;
  return { ...parsed, uuid } as DbModelObject;
}

function makeSyncEvent(id: number | string, objuuid: string, isDelete: number): SyncEvent {
  return {
    uuid: String(id),
    table: 'mainSync',
    isDelete: Number(isDelete),
    objuuid
  };
}