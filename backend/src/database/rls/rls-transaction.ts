/**
 * A transação que carrega o contexto do inquilino.
 *
 * Toda leitura e toda escrita do Orbit passam por aqui: abre-se a transação,
 * declara-se quem está falando, e só então o trabalho acontece. As políticas de
 * RLS leem exatamente esses ajustes.
 *
 * ## Uma ida ao banco, independentemente da quantidade de campos
 *
 * A primeira versão declarava cada campo em um
 * `SELECT set_config(...)` separado. Funcionava — e custava sete idas ao
 * banco **em toda transação da aplicação**, antes da primeira consulta útil.
 *
 * Isso deixou de ser detalhe de desempenho na PR-26.6.1: o tempo limite de uma
 * transação interativa do Prisma corre desde o `BEGIN`, e sete idas somadas ao
 * trabalho real deixavam a janela apertada quando o processo estava ocupado —
 * uma renderização de PDF em andamento, por exemplo, prende o laço de eventos e
 * o relógio da transação continua correndo. Transação expirada aparece como
 * erro genérico bem longe daqui.
 *
 * `set_config` devolve valor, então todos cabem numa projeção só. Mesma
 * semântica, mesma localidade (`is_local = true`), uma ida.
 */
import { Injectable } from '@nestjs/common';
import type { ITransactionManager } from '../../contracts';
import { PrismaService } from '../prisma.service';
import type { PrismaTransactionClient } from '../prisma.types';
import { RlsContextProvider } from './rls-context.provider';

/** A ordem importa: casa com os parâmetros posicionais de `APPLY_CONTEXT`. */
const CONTEXT_KEYS = [
  'app.actor_type',
  'app.user_id',
  'app.portal_identity_id',
  'app.organization_id',
  'app.customer_id',
  'app.business_unit_id',
  'app.business_unit_ids',
  'app.roles',
  'app.permissions',
  'app.is_platform_admin',
] as const;

const APPLY_CONTEXT = `SELECT ${CONTEXT_KEYS.map(
  (key, index) => `set_config('${key}', $${index + 1}, true)`,
).join(', ')}`;

@Injectable()
export class RlsTransaction implements ITransactionManager<PrismaTransactionClient> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextProvider: RlsContextProvider,
  ) {}

  run<T>(
    work: (transaction: PrismaTransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (transaction) => {
      await this.applyContext(transaction);
      return work(transaction);
    });
  }

  private async applyContext(
    transaction: PrismaTransactionClient,
  ): Promise<void> {
    const context = this.contextProvider.get();
    await transaction.$queryRawUnsafe(
      APPLY_CONTEXT,
      context.actorType,
      context.userId,
      context.portalIdentityId,
      context.organizationId,
      context.customerId,
      context.businessUnitId,
      context.businessUnitIds,
      context.roles,
      context.permissions,
      context.isPlatformAdmin,
    );
  }
}

export class RlsPrismaExtension {
  constructor(private readonly transaction: RlsTransaction) {}

  execute<T>(
    work: (transaction: PrismaTransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.transaction.run(work);
  }
}
