/**
 * Regras do Inventory Engine, sem banco.
 *
 * Prova o que é decisão de domínio: quem pode ter estoque, o que cada rota
 * envia ao ledger, como a recusa do banco vira recusa de negócio. **Não** prova
 * concorrência, saldo negativo nem atomicidade da transferência — essas são
 * garantias do Postgres, e um mock delas provaria apenas que o mock funciona.
 * Ver o E2E.
 */
import { ConflictException, ValidationException } from '../../exceptions';
import { InventoryMapper } from './inventory.mapper';
import {
  InsufficientStock,
  type InventoryRepository,
} from './inventory.repository';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const repository = {
    record: jest.fn(),
    transfer: jest.fn(),
    setMinimum: jest.fn(),
    listBalances: jest.fn(),
    listMovements: jest.fn(),
    findBalance: jest.fn(),
    itemBalances: jest.fn(),
    stockCounts: jest.fn(),
    movementTotals: jest.fn(),
    consumptionByItem: jest.fn(),
    findBusinessUnit: jest.fn(),
    findCatalogItem: jest.fn(),
    findOperation: jest.fn(),
  };

  const service = new InventoryService(
    repository as unknown as InventoryRepository,
    new InventoryMapper(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findBusinessUnit.mockResolvedValue({ id: 'unit-id' });
    repository.findCatalogItem.mockResolvedValue({
      id: 'item-id',
      kind: 'PART',
      name: 'Filtro',
      status: 'ACTIVE',
    });
    repository.record.mockResolvedValue({ id: 'movement-id' });
  });

  /* ---------------------------------------------------------------- */
  /* Estocável                                                         */
  /* ---------------------------------------------------------------- */

  it('recusa serviço: hora de mão de obra não fica na prateleira', async () => {
    repository.findCatalogItem.mockResolvedValue({
      id: 'item-id',
      kind: 'SERVICE',
      name: 'Limpeza',
      status: 'ACTIVE',
    });
    await expect(
      service.entry('org-id', 'unit-id', 'user-id', {
        catalogItemId: 'item-id',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ValidationException);
    expect(repository.record).not.toHaveBeenCalled();
  });

  it('aceita PRODUCT e PART', async () => {
    for (const kind of ['PRODUCT', 'PART']) {
      repository.findCatalogItem.mockResolvedValue({
        id: 'item-id',
        kind,
        name: 'Item',
        status: 'ACTIVE',
      });
      await service.entry('org-id', 'unit-id', 'user-id', {
        catalogItemId: 'item-id',
        quantity: 1,
      });
    }
    expect(repository.record).toHaveBeenCalledTimes(2);
  });

  it('exige unidade: estoque é da unidade', async () => {
    await expect(
      service.entry('org-id', null, 'user-id', {
        catalogItemId: 'item-id',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  /* ---------------------------------------------------------------- */
  /* Direção e quantidade                                              */
  /* ---------------------------------------------------------------- */

  it('cada rota fixa o próprio tipo — não há campo genérico', async () => {
    await service.entry('org-id', 'unit-id', 'user-id', {
      catalogItemId: 'item-id',
      quantity: 2,
    });
    await service.consumption('org-id', 'unit-id', 'user-id', {
      catalogItemId: 'item-id',
      quantity: 1,
    });
    await service.return('org-id', 'unit-id', 'user-id', {
      catalogItemId: 'item-id',
      quantity: 1,
    });

    const types = repository.record.mock.calls.map(
      ([input]) => (input as { type: string }).type,
    );
    expect(types).toEqual(['ENTRY', 'CONSUMPTION', 'RETURN']);
  });

  it('ajuste escolhe o tipo pela direção', async () => {
    await service.adjustment('org-id', 'unit-id', 'user-id', {
      catalogItemId: 'item-id',
      quantity: 3,
      direction: 'OUT',
      reason: 'Contagem de inventário',
    });
    const [input] = repository.record.mock.calls[0] as [{ type: string }];
    expect(input.type).toBe('ADJUSTMENT_OUT');
  });

  it('quantidade viaja com três casas', async () => {
    await service.entry('org-id', 'unit-id', 'user-id', {
      catalogItemId: 'item-id',
      quantity: 2.5,
    });
    const [input] = repository.record.mock.calls[0] as [{ quantity: string }];
    expect(input.quantity).toBe('2.500');
  });

  /* ---------------------------------------------------------------- */
  /* Procedência e idempotência                                        */
  /* ---------------------------------------------------------------- */

  it('sem origem, o movimento é manual — e manual não é idempotente', async () => {
    await service.entry('org-id', 'unit-id', 'user-id', {
      catalogItemId: 'item-id',
      quantity: 1,
    });
    const [input] = repository.record.mock.calls[0] as [
      { source: string; sourceEntityId: string | null },
    ];
    expect(input.source).toBe('MANUAL');
    expect(input.sourceEntityId).toBeNull();
  });

  it('consumo com operação e origem vira procedência OPERATION', async () => {
    repository.findOperation.mockResolvedValue({
      id: 'operation-id',
      businessUnitId: 'unit-id',
    });
    await service.consumption('org-id', 'unit-id', 'user-id', {
      catalogItemId: 'item-id',
      quantity: 1,
      operationId: 'operation-id',
      sourceEntityId: '019f0000-0000-7000-8000-000000000000',
    });
    const [input] = repository.record.mock.calls[0] as [{ source: string }];
    expect(input.source).toBe('OPERATION');
  });

  it('recusa consumo com operação inexistente', async () => {
    repository.findOperation.mockResolvedValue(null);
    await expect(
      service.consumption('org-id', 'unit-id', 'user-id', {
        catalogItemId: 'item-id',
        quantity: 1,
        operationId: 'operation-id',
      }),
    ).rejects.toThrow();
  });

  it('origem repetida devolve null — retry, não erro', async () => {
    repository.record.mockResolvedValue(null);
    const result = await service.entry('org-id', 'unit-id', 'user-id', {
      catalogItemId: 'item-id',
      quantity: 1,
      sourceEntityId: '019f0000-0000-7000-8000-000000000000',
    });
    expect(result).toBeNull();
  });

  /* ---------------------------------------------------------------- */
  /* Saldo insuficiente                                                */
  /* ---------------------------------------------------------------- */

  it('a recusa do banco vira conflito com o disponível', async () => {
    repository.record.mockRejectedValue(new InsufficientStock('3.000'));
    await expect(
      service.consumption('org-id', 'unit-id', 'user-id', {
        catalogItemId: 'item-id',
        quantity: 10,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  /* ---------------------------------------------------------------- */
  /* Transferência                                                     */
  /* ---------------------------------------------------------------- */

  it('recusa transferir para a mesma unidade', async () => {
    await expect(
      service.transfer('org-id', 'user-id', {
        catalogItemId: 'item-id',
        fromBusinessUnitId: 'unit-id',
        toBusinessUnitId: 'unit-id',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('valida as duas unidades antes de transferir', async () => {
    repository.transfer.mockResolvedValue({ transferId: 't', out: {}, in: {} });
    await service.transfer('org-id', 'user-id', {
      catalogItemId: 'item-id',
      fromBusinessUnitId: 'unit-a',
      toBusinessUnitId: 'unit-b',
      quantity: 5,
    });
    expect(repository.findBusinessUnit).toHaveBeenCalledTimes(2);
  });

  /* ---------------------------------------------------------------- */
  /* Mínimo                                                            */
  /* ---------------------------------------------------------------- */

  it('mínimo não é movimento — vai por outro caminho', async () => {
    repository.setMinimum.mockResolvedValue({});
    await service.setMinimum('org-id', 'unit-id', 'user-id', {
      catalogItemId: 'item-id',
      minimumStock: 12,
    });
    expect(repository.record).not.toHaveBeenCalled();
    const [input] = repository.setMinimum.mock.calls[0] as [
      { minimumStock: string },
    ];
    expect(input.minimumStock).toBe('12.000');
  });

  /* ---------------------------------------------------------------- */
  /* Consultas                                                         */
  /* ---------------------------------------------------------------- */

  it('recusa período invertido no histórico', async () => {
    await expect(
      service.movements('org-id', {
        from: new Date('2026-08-31'),
        to: new Date('2026-08-01'),
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('transferência conta um movimento por par, não dois', async () => {
    repository.stockCounts.mockResolvedValue([
      { tracked: 5n, low: 1n, out: 1n },
    ]);
    repository.movementTotals.mockResolvedValue([
      { type: 'TRANSFER_IN', _sum: { quantity: '10' }, _count: { _all: 3 } },
      { type: 'TRANSFER_OUT', _sum: { quantity: '10' }, _count: { _all: 3 } },
    ]);

    const summary = await service.summary('org-id', {});
    expect(summary.movements.transfers.count).toBe(3);
    expect(summary.trackedItems).toBe(5);
    expect(summary.lowStockItems).toBe(1);
  });
});
