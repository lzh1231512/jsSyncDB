import { readFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { IDBFactory } from 'fake-indexeddb';
import { beforeAll, describe, expect, it } from 'vitest';

class MemoryLocalStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

type SyncResult = number | Array<Record<string, unknown>>;
type LegacySyncDb = {
  writeObj(object: Record<string, unknown> | Record<string, unknown>[]): Promise<void>;
  writeObjWithoutSync(object: Record<string, unknown> | Record<string, unknown>[]): Promise<void>;
  deleteObj(object: Record<string, unknown>): Promise<void>;
  dbReadObj(uuid: string): Promise<Record<string, unknown>>;
  dbRead(table: string, filters?: unknown): Promise<Array<Record<string, unknown>>>;
  sync(): Promise<SyncResult>;
  autoSync(callback: (result: SyncResult) => void, reconnectionInterval?: number): void;
  stopAutoSync(): void;
  setService(code: string, serviceUrl: string): void;
};

type LegacyJssDB = {
  new (code: string, dbName: string, serviceUrl: string): LegacySyncDb;
  dbModelColumn: Record<string, string[]>;
  dbModelIndex: Record<string, string>;
  dbModelIndexType: Record<string, string>;
};

type UploadRequest = {
  uploadUUID: string;
  restore: string;
  Data: string;
};

const baseUrl = process.env.JSSYNCDB_INTEGRATION_BASE_URL;
const hostRoot = process.env.JSSYNCDB_INTEGRATION_HOST_ROOT;
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const testsTable = 'JssSyncDbIntegrationRecord';

const keepPwdSchemas = {
  DbAc: {
    columns: ['title', 'groupId', 'uid', 'eMail', 'summary', 'url', 'createTime', 'updateTime', 'status', 'F2A'],
    index: 'title'
  },
  DbGroup: { columns: ['name', 'status'], index: 'name' },
  DbPwd: { columns: ['pUUID', 'pwd', 'xh', 'createTime'], index: 'pUUID' }
} as const;

beforeAll(async () => {
  if (!baseUrl || !hostRoot) {
    throw new Error('Integration environment is incomplete. Run npm run test:integration.');
  }
  await waitForServer(baseUrl);
});

describe('classic bundle against the real .NET service', () => {
  it('initializes an empty remote database without a pre-created SQLite file', async () => {
    const scenario = createScenario('empty');
    const client = scenario.client();

    await expect(client.sync()).resolves.toBe(1);

    const remoteFile = remoteDatabasePath(scenario.code, scenario.dbName);
    expect(await fileExists(remoteFile)).toBe(true);
    expect((await client.dbRead('mainSync')).length).toBe(0);
  });

  it('round-trips the KeepPwd DbAc, DbGroup, and DbPwd model shapes', async () => {
    const scenario = createScenario('keeppwd-models');
    const clientA = scenario.client();
    const clientB = scenario.client();
    const objects = [
      {
        uuid: `account-${scenario.id}`, table: 'DbAc', title: "O'Brien vault", groupId: `group-${scenario.id}`,
        uid: 'alice@example.test', eMail: 'alice@example.test', summary: 'safe summary',
        url: 'https://example.test/login?x=1&y=2', createTime: 1_750_000_000_001,
        updateTime: 1_750_000_000_002, status: 1, F2A: 'otpauth://totp/test?secret=ABC'
      },
      { uuid: `group-${scenario.id}`, table: 'DbGroup', name: 'Personal', status: 1 },
      {
        uuid: `password-${scenario.id}`, table: 'DbPwd', pUUID: `account-${scenario.id}`,
        pwd: 'opaque-ciphertext/with+symbols=', xh: 3, createTime: 1_750_000_000_003
      }
    ];

    await clientA.writeObj(objects);
    const uploaded = await clientA.sync();
    expect(Array.isArray(uploaded)).toBe(true);
    expect(uploaded).toHaveLength(objects.length);

    const downloaded = await clientB.sync();
    expect(Array.isArray(downloaded)).toBe(true);
    expect(downloaded).toHaveLength(objects.length);
    for (const object of objects) {
      await expect(clientB.dbReadObj(object.uuid as string)).resolves.toEqual(object);
    }
    await expect(clientB.dbRead('DbAc', ['title', '=', "O'Brien vault"])).resolves.toEqual([objects[0]]);
    await expect(clientB.dbRead('DbPwd', ['pUUID', '=', `account-${scenario.id}`])).resolves.toEqual([objects[2]]);
  });

  it('uploads and downloads across multiple 100-record pages while preserving update and delete history', async () => {
    const scenario = createScenario('paging');
    const clientA = scenario.client();
    const clientB = scenario.client();
    const records = Array.from({ length: 205 }, (_, index) => ({
      uuid: `record-${scenario.id}-${String(index).padStart(3, '0')}`,
      table: testsTable,
      value: `value-${index}-${index === 7 ? "O'Brien" : 'plain'}`
    }));

    await clientA.writeObj(records);
    const uploadResult = await clientA.sync();
    expect(Array.isArray(uploadResult)).toBe(true);
    expect(uploadResult).toHaveLength(205);

    const downloadResult = await clientB.sync();
    expect(Array.isArray(downloadResult)).toBe(true);
    expect(downloadResult).toHaveLength(205);
    for (const record of records) {
      await expect(clientB.dbReadObj(record.uuid)).resolves.toEqual(record);
    }

    const revised = { ...records[7]!, value: 'revised across sync history' };
    await clientA.writeObj(revised);
    await clientA.deleteObj(records[8]!);
    const mutationResult = await clientA.sync();
    expect(Array.isArray(mutationResult)).toBe(true);

    const remoteMutations = await clientB.sync();
    expect(Array.isArray(remoteMutations)).toBe(true);
    expect(remoteMutations).toHaveLength(2);
    expect(remoteMutations).toEqual(expect.arrayContaining([
      expect.objectContaining({ objuuid: revised.uuid, fromLocal: false }),
      expect.objectContaining({ objuuid: records[8]!.uuid, isDelete: 1, fromLocal: false })
    ]));
    await expect(clientB.dbReadObj(revised.uuid)).resolves.toEqual(revised);
    await expect(clientB.dbReadObj(records[8]!.uuid)).resolves.toEqual({});
    const remoteHistory = await clientB.dbRead('mainSync');
    expect(remoteHistory.filter((event) => event.objuuid === revised.uuid)).toHaveLength(1);
    expect(remoteHistory.filter((event) => event.objuuid === records[8]!.uuid)).toHaveLength(1);
  }, 45_000);

  it('retries a committed upload with the same idempotency token after losing its HTTP response', async () => {
    const scenario = createScenario('lost-response');
    const capturedUploads: UploadRequest[] = [];
    let loseFirstUploadResponse = true;
    const clientA = scenario.client(async (input, init) => {
      const request = new Request(input, init);
      if (new URL(request.url).pathname.endsWith('/UploadDBObj')) {
        const form = new URLSearchParams(await request.clone().text());
        capturedUploads.push({
          uploadUUID: form.get('uploadUUID') ?? '',
          restore: form.get('restore') ?? '',
          Data: form.get('Data') ?? ''
        });
        const response = await fetch(request);
        if (loseFirstUploadResponse && form.get('restore') === '0') {
          loseFirstUploadResponse = false;
          throw new Error('Simulated response loss after server commit.');
        }
        return response;
      }
      return fetch(request);
    });
    const clientB = scenario.client();
    const record = { uuid: `retry-${scenario.id}`, table: testsTable, value: 'commit before response loss' };
    await clientA.writeObj(record);

    await expect(clientA.sync()).resolves.toBe(-9);
    await expect(clientA.sync()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ objuuid: record.uuid, fromLocal: true })
    ]));

    const regularUploads = capturedUploads.filter((upload) => upload.restore === '0');
    expect(regularUploads).toHaveLength(2);
    expect(regularUploads[1]!.uploadUUID).toBe(regularUploads[0]!.uploadUUID);
    expect(JSON.parse(regularUploads[0]!.Data)).toEqual(JSON.parse(regularUploads[1]!.Data));

    const remoteChanges = await clientB.sync();
    expect(remoteChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ objuuid: record.uuid, fromLocal: false })
    ]));
    expect(await clientB.dbRead('mainSync')).toHaveLength(1);
    await expect(clientB.dbReadObj(record.uuid)).resolves.toEqual(record);
  });

  it('returns UUID mismatch and missing-history statuses from the real download endpoint', async () => {
    const scenario = createScenario('protocol-guards');
    let serverUuid = '';
    const client = scenario.client(async (input, init) => {
      const request = new Request(input, init);
      if (new URL(request.url).pathname.endsWith('/DownloadDBObj')) {
        serverUuid = new URL(request.url).searchParams.get('uuid') ?? '';
      }
      return fetch(request);
    });
    const record = { uuid: `protocol-${scenario.id}`, table: testsTable, value: 'server identity' };
    await client.writeObj(record);
    await expect(client.sync()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ objuuid: record.uuid })
    ]));
    expect(serverUuid).not.toBe('');

    const mismatch = await downloadStatus(scenario.code, scenario.dbName, 'wrong-client-uuid', 1);
    const historyGap = await downloadStatus(scenario.code, scenario.dbName, serverUuid, 3);
    expect(mismatch).toBe(-1);
    expect(historyGap).toBe(-2);
  });

  it('notifies an auto-syncing client through the real WebSocket endpoint after another client uploads', async () => {
    const scenario = createScenario('websocket-notify');
    const writer = scenario.client();
    const listener = scenario.client();
    const record = { uuid: `websocket-${scenario.id}`, table: testsTable, value: 'delivered by notification' };
    await expect(writer.sync()).resolves.toBe(1);

    let resolveConnected!: () => void;
    let resolveReceived!: (events: Array<Record<string, unknown>>) => void;
    const connected = new Promise<void>((resolvePromise) => { resolveConnected = resolvePromise; });
    const received = new Promise<Array<Record<string, unknown>>>((resolvePromise) => { resolveReceived = resolvePromise; });
    listener.autoSync((result) => {
      if (Array.isArray(result) && result.some((event) => event.objuuid === record.uuid)) {
        resolveReceived(result);
      } else if (result === 1) {
        resolveConnected();
      }
    });

    try {
      await withTimeout(connected, 10_000, 'WebSocket client did not complete its initial download.');
      await writer.writeObj(record);
      await expect(writer.sync()).resolves.toEqual(expect.arrayContaining([
        expect.objectContaining({ objuuid: record.uuid, fromLocal: true })
      ]));

      const notification = await withTimeout(received, 10_000, 'WebSocket notification did not trigger a download.');
      expect(notification).toEqual(expect.arrayContaining([
        expect.objectContaining({ objuuid: record.uuid, fromLocal: false })
      ]));
      await expect(listener.dbReadObj(record.uuid)).resolves.toEqual(record);
    } finally {
      listener.stopAutoSync();
    }
  }, 25_000);

  it('replays local history when the remote SQLite database is lost', async () => {
    const scenario = createScenario('database-loss');
    const client = scenario.client();
    const record = { uuid: `restore-${scenario.id}`, table: testsTable, value: 'must survive remote loss' };
    await client.writeObj(record);
    const initialSync = await client.sync();
    expect(Array.isArray(initialSync)).toBe(true);

    await unlink(remoteDatabasePath(scenario.code, scenario.dbName));
    const restored = await client.sync();
    expect(restored).toBe(1);

    const secondClient = scenario.client();
    const downloaded = await secondClient.sync();
    expect(Array.isArray(downloaded)).toBe(true);
    expect(downloaded).toEqual(expect.arrayContaining([
      expect.objectContaining({ objuuid: record.uuid, fromLocal: false })
    ]));
    await expect(secondClient.dbReadObj(record.uuid)).resolves.toEqual(record);
  });
});

function createScenario(name: string): {
  id: string;
  code: string;
  dbName: string;
  client: (fetchOverride?: typeof fetch) => LegacySyncDb;
} {
  const id = `${name}-${runId}`;
  const code = `it-${id}`;
  const dbName = `Integration-${id}`;
  return {
    id,
    code,
    dbName,
    client: (fetchOverride) => createClient(code, dbName, fetchOverride)
  };
}

function createClient(code: string, dbName: string, fetchOverride?: typeof fetch): LegacySyncDb {
  const legacy = loadLegacyBundle(fetchOverride);
  registerKeepPwdModels(legacy);
  legacy.dbModelColumn[testsTable] = ['value'];
  legacy.dbModelIndex[testsTable] = 'uuid';
  legacy.dbModelIndexType[testsTable] = 'string';
  return new legacy(code, dbName, baseUrl!) as LegacySyncDb;
}

function registerKeepPwdModels(legacy: LegacyJssDB): void {
  for (const [table, schema] of Object.entries(keepPwdSchemas)) {
    legacy.dbModelColumn[table] = [...schema.columns];
    legacy.dbModelIndex[table] = schema.index;
    legacy.dbModelIndexType[table] = 'string';
  }
}

function loadLegacyBundle(fetchOverride: typeof fetch = globalThis.fetch.bind(globalThis)): LegacyJssDB {
  const context: Record<string, unknown> = {
    console,
    localStorage: new MemoryLocalStorage(),
    indexedDB: new IDBFactory(),
    crypto: webcrypto,
    fetch: fetchOverride,
    URL,
    URLSearchParams,
    Request,
    Response,
    WebSocket: globalThis.WebSocket,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };
  const source = readFileSync(resolve(process.cwd(), 'dist/JssDB-2.0.js'), 'utf8');
  runInNewContext(source, context, { filename: 'dist/JssDB-2.0.js' });
  return context.JssDB as LegacyJssDB;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => rejectPromise(new Error(message)), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timeout); resolvePromise(value); },
      (error: unknown) => { clearTimeout(timeout); rejectPromise(error); }
    );
  });
}

function remoteDatabasePath(code: string, dbName: string): string {
  return resolve(hostRoot!, 'wwwroot', 'uploadFile', code, `${dbName}.db`);
}

async function downloadStatus(code: string, dbName: string, uuid: string, beginId: number): Promise<number> {
  const query = new URLSearchParams({
    Code: code,
    DBName: dbName,
    uuid,
    beginId: String(beginId),
    isWait: '-1',
    take: '100'
  });
  const response = await fetch(`${baseUrl}/DownloadDBObj?${query}`);
  const result = await response.json() as { status: number };
  return result.status;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await import('node:fs/promises').then(({ access }) => access(filePath));
    return true;
  }
  catch {
    return false;
  }
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/Home/Index`);
      if (response.ok) return;
      lastError = new Error(`Backend readiness returned HTTP ${response.status}.`);
    }
    catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`Backend did not become ready at ${url}: ${String(lastError)}`);
}
