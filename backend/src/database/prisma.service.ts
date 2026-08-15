/**
 * O cliente Prisma da aplicação — e o papel com que ele conecta.
 *
 * ## Dois papéis, um banco
 *
 * `DATABASE_URL` é a credencial **administrativa**: dona do schema, usada por
 * `prisma migrate` e pelos scripts de provisionamento. `APP_DATABASE_URL` é a
 * credencial de **runtime**, sem `SUPERUSER` e sem `BYPASSRLS`.
 *
 * Enquanto a aplicação conectava com a administrativa, as 68 tabelas com
 * `FORCE ROW LEVEL SECURITY` eram decorativas: nenhuma política era avaliada,
 * e o isolamento real era só o da camada de aplicação. A separação existe para
 * que a RLS seja a segunda camada que ela sempre pretendeu ser.
 *
 * ## O aviso na inicialização
 *
 * O processo pergunta ao Postgres, na subida, se o papel com que acabou de
 * conectar contorna políticas — e diz em voz alta quando contorna. Não é
 * verificação decorativa: `rolbypassrls` pode ser concedido depois, fora do
 * deploy, e sem esta pergunta ninguém perceberia. `DATABASE_ENFORCE_RESTRICTED_ROLE`
 * transforma o aviso em recusa de subir, e é assim que o `docker-compose`
 * roda.
 */
import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { EnvironmentProvider } from '../providers';

interface RolePrivileges {
  role: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly environment: EnvironmentProvider) {
    const number = (key: string, fallback: number): number => {
      const parsed = Number(environment.getOptional(key));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    super({
      adapter: new PrismaPg({
        connectionString:
          environment.getOptional('APP_DATABASE_URL')?.trim() ||
          environment.get('DATABASE_URL'),
        /**
         * O padrão do `pg` é 10 conexões — e 10 é pouco quando HTTP e worker
         * dividem o mesmo processo. Uma transação interativa **segura** a
         * conexão do começo ao fim; com o pool no limite, quem chega espera, e
         * o relógio do tempo limite da transação já está correndo.
         */
        max: number('DATABASE_POOL_MAX', 20),
      }),
      /**
       * Janela da transação interativa.
       *
       * O padrão do Prisma é 5 s, contados do `BEGIN`. Isso pressupõe um laço
       * de eventos livre — e o Orbit renderiza PDF em processo, o que o prende
       * por vezes. Uma transação curta e correta expirava por causa de trabalho
       * alheio, e o erro aparecia como falha genérica em outra rota.
       *
       * Aumentar a janela **não** é desculpa para transação longa: as regras de
       * escopo continuam as mesmas, e o `docs/rls-and-worker-context.md`
       * descreve o que pode e o que não pode acontecer dentro de uma.
       */
      transactionOptions: {
        timeout: number('DATABASE_TRANSACTION_TIMEOUT_MS', 20_000),
        maxWait: number('DATABASE_TRANSACTION_MAX_WAIT_MS', 10_000),
      },
    });
  }

  /**
   * Confere o papel de runtime assim que há conexão.
   *
   * Roda no `onModuleInit` do Nest — antes de qualquer requisição ser atendida,
   * e cedo o bastante para que a recusa aconteça na subida, não no primeiro
   * vazamento.
   */
  async onModuleInit(): Promise<void> {
    const [privileges] = await this.$queryRaw<RolePrivileges[]>`
      SELECT current_user::text AS role, rolsuper, rolbypassrls
        FROM pg_roles
       WHERE rolname = current_user
    `;

    if (!privileges) return;

    const bypasses = privileges.rolsuper || privileges.rolbypassrls;
    const detail = JSON.stringify({
      stage: 'database-role',
      role: privileges.role,
      rolsuper: privileges.rolsuper,
      rolbypassrls: privileges.rolbypassrls,
      rlsEnforced: !bypasses,
    });

    if (!bypasses) {
      this.logger.log(detail);
      return;
    }

    const enforce =
      this.environment
        .getOptional('DATABASE_ENFORCE_RESTRICTED_ROLE')
        ?.trim() === 'true';

    const message = `A aplicação conectou com um papel que contorna RLS (${privileges.role}). Nenhuma política é avaliada. ${detail}`;

    if (enforce) throw new Error(message);
    this.logger.warn(message);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
