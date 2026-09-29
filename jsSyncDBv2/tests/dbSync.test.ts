import { indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DbBase,
  DbCore,
  DbSync,
  dbModelColumn,
  type SyncDownloadRequest,
  type SyncDownloadResponse,
  type SyncLifecycleEvent,
  type SyncTransport,
  type SyncUploadRequest,
  type SyncUploadResponse
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

class FakeSyncTransport implements SyncTransport {
  readonly uploads: Array<{ endpoint: string; request: SyncUploadRequest }> = [];
  readonly downloads: Array<{ endpoint: string; request: SyncDownloadRequest }> = [];
  readonly uploadResults: Array<SyncUploadResponse | Error> = [];
  readonly downloadResults: SyncDownloadResponse[] = [];

  async upload(endpoint: string, request: SyncUploadRequest): Promise<SyncUploadResponse> {
    this.uploads.push({ endpoint, request });
    const result = this.uploadResults.shift() ?? { status: 1, data: [] };
    if (result instanceof Error) throw result;
    return result;
  }

  async download(endpoint: string, request: SyncDownloadRequest): Promise<SyncDownloadResponse> {
    this.downloads.push({ endpoint, request });
    return this.downloadResults.shift() ?? { status: 1, maxId: 0, data: [] };
  }
}

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readonly sent: string[] = [];
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  receive(data: string): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.({} as CloseEvent);
  }
}

const databaseNames: string[] = [];
let sequence = 0;

afterEach(async () => {
  vi.useRealTimers();
  DbSync.clearInstances();
  DbCore.clearInstances();
  DbBase.clearInstances();
  for (const name of databaseNames.splice(0)) {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }
});

function createSync(table: string, transport: FakeSyncTransport): DbSync {
  const databaseName = `db-sync-${++sequence}`;
  databaseNames.push(`${databaseName}_${table}`);
  dbModelColumn[table] = ['text'];
  const database = new DbCore(`${databaseName}_${table}`, undefined, {
    indexedDB,
    localStorage: new TestLocalStorage()
  });
  let uuidSequence = 0;
  return new DbSync('test-code', databaseName, 'https://example.invalid/sync', undefined, {
    database,
    transport,
    transferLimit: 2,
    uuidFactory: () => `test-uuid-${++uuidSequence}`
  });
}

function wireRecord(id: number, table: string, uuid: string, text: string, isDelete = 0) {
  return { id, objuuid: uuid, isDelete, data: JSON.stringify({ table, text }) };
}

describe('DbSync with an injected transport', () => {
  it('uploads local changes, then recognizes the downloaded server echo without rewriting them', async () => {
    const transport = new FakeSyncTransport();
    const table = `notes-${sequence + 1}`;
    const sync = createSync(table, transport);
    transport.uploadResults.push({
      status: 1,
      uuid: 'remote-database-id',
      data: [{ id: 10, objuuid: 'note-1' }]
    });
    transport.downloadResults.push({
      status: 1,
      uuid: 'remote-database-id',
      maxId: 10,
      data: [wireRecord(10, table, 'note-1', 'local value')]
    });

    await sync.writeObj({ uuid: 'note-1', table, text: 'local value' });
    const result = await sync.sync();

    expect(transport.uploads).toHaveLength(1);
    expect(transport.uploads[0]!.endpoint).toBe('https://example.invalid/sync/UploadDBObj');
    expect(JSON.parse(transport.uploads[0]!.request.Data)).toEqual([
      { objuuid: 'note-1', isDelete: 0, data: JSON.stringify({ table, text: 'local value' }) }
    ]);
    expect(transport.downloads[0]!.request.beginId).toBe(1);
    expect(result).toMatchObject([{ uuid: '10', fromLocal: true, objuuid: 'note-1' }]);
    await expect(sync.dbReadObj('note-1')).resolves.toEqual({ uuid: 'note-1', table, text: 'local value' });
    await expect(sync.dbRead('mainSync.Temp')).resolves.toEqual([]);
  });

  it('emits one paired manual lifecycle event for sync, including a negative result', async () => {
    const transport = new FakeSyncTransport();
    const table = `lifecycle-${sequence + 1}`;
    const sync = createSync(table, transport);
    transport.downloadResults.push({ status: -7 });
    const events: SyncLifecycleEvent[] = [];
    sync.onSyncEvent((event) => { events.push(event); });

    await expect(sync.sync()).resolves.toBe(-7);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ phase: 'start', operation: 'sync', source: 'manual' });
    expect(events[1]).toMatchObject({
      phase: 'end',
      id: events[0]!.id,
      operation: 'sync',
      source: 'manual',
      result: -7
    });
  });

  it('applies remote pages in order and prunes superseded sync history IDs', async () => {
    const transport = new FakeSyncTransport();
    const table = `pages-${sequence + 1}`;
    const sync = createSync(table, transport);
    transport.downloadResults.push(
      { status: 1, uuid: 'remote-pages', maxId: 11, data: [wireRecord(10, table, 'remote-1', 'first')] },
      {
        status: 1,
        uuid: 'remote-pages',
        maxId: 11,
        data: [wireRecord(11, table, 'remote-1', 'updated')],
        delIds: [10]
      }
    );

    const changes = await sync.download();

    expect(transport.downloads.map(({ request }) => request.beginId)).toEqual([1, 11]);
    expect(changes).toHaveLength(2);
    await expect(sync.dbReadObj('remote-1')).resolves.toEqual({ uuid: 'remote-1', table, text: 'updated' });
    await expect(sync.dbRead('mainSync')).resolves.toMatchObject([
      { uuid: '11', objuuid: 'remote-1', isDelete: 0 }
    ]);
  });

  it('keeps the upload checkpoint and reuses its idempotency token after transport failure', async () => {
    const transport = new FakeSyncTransport();
    const table = `retry-${sequence + 1}`;
    const sync = createSync(table, transport);
    transport.uploadResults.push(
      new Error('offline'),
      { status: 1, uuid: 'remote-retry', data: [{ id: 20, objuuid: 'retry-1' }] }
    );
    await sync.writeObj({ uuid: 'retry-1', table, text: 'retry me' });

    await expect(sync.upload()).resolves.toBe(-9);
    await expect(sync.upload()).resolves.toBe(1);

    expect(transport.uploads).toHaveLength(2);
    expect(transport.uploads[1]!.request.uploadUUID).toBe(transport.uploads[0]!.request.uploadUUID);
    await expect(sync.dbRead('mainSync.Temp')).resolves.toEqual([]);
  });

  it('restores acknowledged history before retrying an upload when the server reports a gap', async () => {
    const transport = new FakeSyncTransport();
    const table = `restore-${sequence + 1}`;
    const sync = createSync(table, transport);
    await sync.writeObjWithoutSync({ uuid: 'history-object', table, text: 'history' });
    await sync.writeObjWithoutSync({
      uuid: '5',
      table: 'mainSync',
      isDelete: 0,
      objuuid: 'history-object'
    });
    await sync.writeObj({ uuid: 'new-object', table, text: 'new change' });
    transport.uploadResults.push(
      { status: -2, lastId: 0 },
      { status: 1, uuid: 'restored-server', data: [{ id: 5, objuuid: 'history-object' }] },
      { status: 1, uuid: 'restored-server', data: [{ id: 6, objuuid: 'new-object' }] }
    );

    await expect(sync.upload()).resolves.toBe(1);

    expect(transport.uploads.map(({ request }) => request.restore)).toEqual(['0', '1', '0']);
    expect(JSON.parse(transport.uploads[1]!.request.Data)).toMatchObject([
      { id: 5, objuuid: 'history-object', isDelete: 0 }
    ]);
    await expect(sync.dbRead('mainSync.Temp')).resolves.toEqual([]);
  });

  it('uses the legacy WebSocket registration, initial download, notification, heartbeat, and close flow', async () => {
    FakeWebSocket.instances = [];
    const transport = new FakeSyncTransport();
    const table = `socket-${sequence + 1}`;
    const sync = createSync(table, transport);
    const callbacks: Array<number | unknown[]> = [];
    transport.uploadResults.push({ status: 1, data: [{ id: 1, objuuid: 'local-socket-note' }] });
    await sync.writeObj({ uuid: 'local-socket-note', table, text: 'upload while connected' });
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);

    sync.autoSync((result) => { callbacks.push(result as number | unknown[]); });
    await vi.advanceTimersByTimeAsync(1000);

    const socket = FakeWebSocket.instances[0]!;
    expect(socket.url).toBe('wss://example.invalid/sync/ws');
    expect(transport.downloads).toHaveLength(0);
    socket.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(JSON.parse(socket.sent[0]!)).toEqual({ DBName: expect.any(String), Code: 'test-code' });
    expect(transport.downloads).toHaveLength(1);
    expect(transport.downloads[0]!.request.isWait).toBe(0);
    expect(callbacks).toEqual([1]);

    socket.receive('1');
    await vi.advanceTimersByTimeAsync(0);
    expect(transport.downloads).toHaveLength(2);
    expect(transport.downloads[1]!.request.isWait).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(transport.uploads).toHaveLength(1);
    expect(transport.uploads[0]!.request.Data).toContain('local-socket-note');

    socket.close();
    await vi.advanceTimersByTimeAsync(28_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);

    const reconnectedSocket = FakeWebSocket.instances[1]!;
    reconnectedSocket.open();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(reconnectedSocket.sent.at(-1)).toBe('1');
    sync.stopAutoSync();
    expect(reconnectedSocket.readyState).toBe(3);
  });

  it('falls back to one-second long-polling when the WebSocket API is unavailable', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', undefined);
    const transport = new FakeSyncTransport();
    const table = `poll-${sequence + 1}`;
    const sync = createSync(table, transport);
    const callbacks: Array<number | unknown[]> = [];
    const lifecycle: SyncLifecycleEvent[] = [];
    sync.onSyncEvent((event) => { lifecycle.push(event); });

    sync.autoSync((result) => { callbacks.push(result as number | unknown[]); });
    await vi.advanceTimersByTimeAsync(1000);
    expect(transport.downloads).toHaveLength(1);
    expect(transport.downloads[0]!.request.isWait).toBe(0);
    expect(lifecycle).toHaveLength(2);
    expect(lifecycle[0]).toMatchObject({ phase: 'start', operation: 'download', source: 'auto' });
    expect(lifecycle[1]).toMatchObject({
      phase: 'end',
      id: lifecycle[0]!.id,
      operation: 'download',
      source: 'auto',
      result: 1
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(transport.downloads).toHaveLength(2);
    expect(transport.downloads[1]!.request.isWait).toBe(1);
    expect(callbacks).toEqual([1, 1]);
    sync.stopAutoSync();
  });

  it('uploads local changes while a fallback long-poll download is still pending', async () => {
    vi.stubGlobal('WebSocket', undefined);
    let resolveUploadStarted!: () => void;
    let releaseDownload!: (response: SyncDownloadResponse) => void;
    const uploadStarted = new Promise<void>((resolvePromise) => { resolveUploadStarted = resolvePromise; });
    const transport = new class extends FakeSyncTransport {
      override async upload(endpoint: string, request: SyncUploadRequest): Promise<SyncUploadResponse> {
        const response = await super.upload(endpoint, request);
        resolveUploadStarted();
        return response;
      }

      override download(endpoint: string, request: SyncDownloadRequest): Promise<SyncDownloadResponse> {
        this.downloads.push({ endpoint, request });
        return new Promise((resolvePromise) => { releaseDownload = resolvePromise; });
      }
    }();
    const table = `pending-poll-${sequence + 1}`;
    const sync = createSync(table, transport);
    transport.uploadResults.push({ status: 1, data: [{ id: 1, objuuid: 'poll-pending-note' }] });
    await sync.writeObj({ uuid: 'poll-pending-note', table, text: 'upload without waiting for long poll' });
    sync.autoSync(() => undefined);

    try {
      await uploadStarted;
      expect(transport.downloads).toHaveLength(1);
      expect(transport.downloads[0]!.request.isWait).toBe(0);
      expect(JSON.parse(transport.uploads[0]!.request.Data)).toMatchObject([
        { objuuid: 'poll-pending-note' }
      ]);
    } finally {
      sync.stopAutoSync();
      releaseDownload({ status: 1, maxId: 0, data: [] });
    }
  }, 10_000);
});