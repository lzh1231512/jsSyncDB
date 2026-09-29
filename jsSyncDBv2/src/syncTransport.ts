export type SyncWireObject = {
  id?: number;
  objuuid: string;
  isDelete: number;
  data: string;
};

export type SyncUploadRequest = {
  Code: string;
  DBName: string;
  Data: string;
  uuid: string;
  localUUID: string;
  uploadUUID: string;
  restore: '0' | '1';
  localMaxId: number;
};

export type SyncDownloadRequest = {
  Code: string;
  DBName: string;
  uuid: string;
  beginId: number;
  isWait: number;
  take: number;
};

export type SyncUploadResponse = {
  status: number;
  uuid?: string;
  lastId?: number;
  data?: Array<{ id: number; objuuid: string }>;
};

export type SyncDownloadObject = Omit<SyncWireObject, 'id'> & { id: number };

export type SyncDownloadResponse = {
  status: number;
  uuid?: string;
  maxId?: number;
  data?: Array<SyncDownloadObject>;
  delIds?: number[];
};

export interface SyncTransport {
  upload(endpoint: string, request: SyncUploadRequest): Promise<SyncUploadResponse>;
  download(endpoint: string, request: SyncDownloadRequest): Promise<SyncDownloadResponse>;
}

export class FetchSyncTransport implements SyncTransport {
  async upload(endpoint: string, request: SyncUploadRequest): Promise<SyncUploadResponse> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(request)) {
      body.set(key, String(value));
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body
    });
    return readJsonResponse<SyncUploadResponse>(response);
  }

  async download(endpoint: string, request: SyncDownloadRequest): Promise<SyncDownloadResponse> {
    const url = new URL(endpoint, globalThis.location?.href ?? 'http://localhost/');
    for (const [key, value] of Object.entries(request)) {
      url.searchParams.set(key, String(value));
    }
    const response = await fetch(url);
    return readJsonResponse<SyncDownloadResponse>(response);
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Sync request failed with HTTP ${response.status}.`);
  }
  return response.json() as Promise<T>;
}