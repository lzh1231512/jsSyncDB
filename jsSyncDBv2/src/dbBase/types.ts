export type DbCommand =
  | { readonly ac: 'del'; readonly key: string }
  | { readonly ac: 'set'; readonly key: string; readonly val: unknown };

export interface DbStorageBackend {
  getVals(keys: readonly string[], isJSON?: boolean): Promise<unknown[]>;
  exec(commands: readonly DbCommand[]): Promise<void>;
  clear(): Promise<void>;
}

export type DbStorageBackendFactory = {
  readonly dbname: string;
  readonly priority: number;
  isSupport(indexedDB?: IDBFactory): boolean;
  create(dbName: string, indexedDB?: IDBFactory): DbStorageBackend;
};

export type DbBaseOptions = {
  readonly localStorage?: Storage;
  readonly indexedDB?: IDBFactory;
};