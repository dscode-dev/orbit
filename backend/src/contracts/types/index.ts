export type UUID = string & { readonly __brand: 'UUID' };
export type ISODate = string & { readonly __brand: 'ISODate' };
export type Cursor = string & { readonly __brand: 'Cursor' };
export type Timestamp = Date;
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Primitive = string | number | boolean | bigint | symbol | null;
export type JSONValue = Primitive | JSONObject | JSONArray;
export type JSONObject = { readonly [key: string]: JSONValue };
export type JSONArray = readonly JSONValue[];
export type DeepPartial<T> = T extends Primitive
  ? T
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : { [P in keyof T]?: DeepPartial<T[P]> };

export const SortDirection = { ASC: 'asc', DESC: 'desc' } as const;
export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];
