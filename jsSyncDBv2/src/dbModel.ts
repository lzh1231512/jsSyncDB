export type DbModelObject = {
  uuid: string;
  table: string;
  [key: string]: unknown;
};

export type DbModelTransformation = {
  readonly viewModelToEntity: (object: DbModelObject) => unknown;
  readonly entityToViewModel: (entity: unknown) => Record<string, unknown>;
};

export type DbModelEvent = {
  readonly onSave?: (
    previous: DbModelObject | null,
    current: DbModelObject
  ) => void | Promise<void>;
  readonly onDelete?: (previous: DbModelObject) => void | Promise<void>;
};

export const dbModelIndex: Record<string, string> = {};
export const dbModelColumn: Record<string, readonly string[]> = {};
export const dbModelIndexType: Record<string, string> = {};
export const dbModelTransformation: Record<string, DbModelTransformation> = {};
export const dbModelEvent: Record<string, DbModelEvent> = {};

export function dbObj(this: DbModelObject | void, uuid: string, table: string): DbModelObject {
  const target: DbModelObject = this && typeof this === 'object' ? this : { uuid, table };
  target.uuid = uuid;
  target.table = table;
  return target;
}

export const _dbObj = dbObj;