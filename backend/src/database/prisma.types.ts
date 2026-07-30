export type DatabaseRecord = Readonly<Record<string, unknown>>;
export type DatabaseInput = Readonly<Record<string, unknown>>;

export interface PrismaDelegate<
  TRecord extends DatabaseRecord,
  TCreate extends DatabaseInput,
  TUpdate extends DatabaseInput,
> {
  findUnique(args: DatabaseInput): Promise<TRecord | null>;
  findMany(args?: DatabaseInput): Promise<readonly TRecord[]>;
  count(args?: DatabaseInput): Promise<number>;
  create(args: { data: TCreate }): Promise<TRecord>;
  update(args: { where: DatabaseInput; data: TUpdate }): Promise<TRecord>;
  delete(args: { where: DatabaseInput }): Promise<TRecord>;
}

export interface PrismaTransactionClient {
  $executeRawUnsafe(
    query: string,
    ...values: readonly unknown[]
  ): Promise<number>;
}

export interface PrismaClientContract extends PrismaTransactionClient {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $transaction<T>(
    work: (transaction: PrismaTransactionClient) => Promise<T>,
  ): Promise<T>;
}

export type WhereInput = Record<string, unknown>;
export type OrderByInput = Record<string, 'asc' | 'desc'>;
