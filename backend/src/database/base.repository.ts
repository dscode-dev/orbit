import type {
  ICrudRepository,
  IEntity,
  IRepositoryQuery,
  UUID,
} from '../contracts';
import { EntityNotFoundException } from '../exceptions';
import { FilterBuilder, OrderBuilder } from './builders/query.builders';
import { PaginationHelper, SoftDeleteHelper } from './helpers/database.helpers';
import type {
  DatabaseInput,
  DatabaseRecord,
  PrismaDelegate,
  PrismaTransactionClient,
} from './prisma.types';
import { RlsTransaction } from './rls/rls-transaction';

export abstract class BaseRepository<
  TEntity extends IEntity,
  TRecord extends DatabaseRecord,
  TCreate extends DatabaseInput,
  TUpdate extends DatabaseInput,
> implements ICrudRepository<TEntity, TCreate, TUpdate> {
  protected abstract readonly entityName: string;
  protected readonly filterableFields?: ReadonlySet<string>;
  protected readonly sortableFields?: ReadonlySet<string>;

  protected constructor(private readonly transactions: RlsTransaction) {}

  protected abstract delegate(
    transaction: PrismaTransactionClient,
  ): PrismaDelegate<TRecord, TCreate, TUpdate>;
  protected abstract toEntity(record: TRecord): TEntity;

  async findById(id: UUID): Promise<TEntity | null> {
    const record = await this.transactions.run((transaction) =>
      this.delegate(transaction).findUnique({
        where: { id, ...SoftDeleteHelper.active() },
      }),
    );
    return record ? this.toEntity(record) : null;
  }

  async exists(id: UUID): Promise<boolean> {
    return (await this.findById(id)) !== null;
  }

  async findMany(options: IRepositoryQuery = {}): Promise<readonly TEntity[]> {
    const pagination = options.pagination
      ? PaginationHelper.toPrisma(options.pagination)
      : {};
    const records = await this.transactions.run((transaction) =>
      this.delegate(transaction).findMany({
        where: {
          ...SoftDeleteHelper.active(options.includeDeleted),
          ...FilterBuilder.build(options.filters, this.filterableFields),
        },
        orderBy: OrderBuilder.build(options.sort, this.sortableFields),
        ...pagination,
      }),
    );
    return records.map((record) => this.toEntity(record));
  }

  async create(data: TCreate): Promise<TEntity> {
    const record = await this.transactions.run((transaction) =>
      this.delegate(transaction).create({ data }),
    );
    return this.toEntity(record);
  }

  async update(id: UUID, data: TUpdate): Promise<TEntity> {
    await this.require(id);
    const record = await this.transactions.run((transaction) =>
      this.delegate(transaction).update({ where: { id }, data }),
    );
    return this.toEntity(record);
  }

  async delete(id: UUID): Promise<void> {
    await this.require(id);
    await this.transactions.run(async (transaction) => {
      await this.delegate(transaction).delete({ where: { id } });
    });
  }

  protected async require(id: UUID): Promise<TEntity> {
    const entity = await this.findById(id);
    if (!entity) throw new EntityNotFoundException(this.entityName, id);
    return entity;
  }
}
