/**
 * Cliente Prisma **administrativo**, para preparar cenário nos E2E.
 *
 * ## Por que ele existe a partir da PR-26.6
 *
 * A aplicação passou a conectar com um papel sem `SUPERUSER` e sem
 * `BYPASSRLS`. Isso é o ponto da PR — mas montar cenário é outra coisa: criar
 * uma filial, plantar um job com escopo errado de propósito, ou inspecionar o
 * que a organização vizinha enxerga são atos **administrativos**, feitos de
 * fora do sistema, e não deveriam depender de existir um usuário com o papel
 * certo em cada suíte.
 *
 * Então a divisão é: o cenário se monta com `adminPrisma()`, e **o que está
 * sendo testado — a aplicação — roda restrito**. Um teste que usasse o cliente
 * administrativo para exercitar o produto provaria só que o superusuário
 * funciona, que é exatamente a ilusão que a revisão PR-26.5 encontrou.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

let client: PrismaClient | null = null;

/** Singleton: uma conexão administrativa por processo de teste basta. */
export function adminPrisma(): PrismaClient {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required to run the E2E suite');
    client = new PrismaClient({ adapter: new PrismaPg(url) });
  }
  return client;
}

export async function disconnectAdminPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
