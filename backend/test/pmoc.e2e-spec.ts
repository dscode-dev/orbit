/**
 * E2E do domínio PMOC.
 *
 * ```
 * plano ──▶ cobertura ──▶ ativação ──▶ ciclo ──▶ Operation + evidência
 *                            │           │
 *                         Agenda      periodicidade de calendário
 * ```
 *
 * O que só aqui se prova:
 *
 * - a periodicidade em meses respeita o calendário, porque quem soma é o banco;
 * - `UP_TO_DATE`, `DUE_SOON` e `OVERDUE` saem do **relógio do servidor**;
 * - a mesma cobertura não entra duas vezes, nem por corrida;
 * - a ordem de serviço de um ciclo nasce uma vez só;
 * - `reports.management.read` não contorna `pmoc.read`;
 * - relatório gerencial antigo não muda quando o domínio passa a existir.
 *
 * O worker roda desligado e o teste chama `tick()` quando quer.
 */
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApiVersioning } from './../src/configure-api';
import type { PrismaClient } from '@prisma/client';
import { adminPrisma, disconnectAdminPrisma } from './support/admin-prisma';
import { BackgroundJobWorker } from './../src/modules/jobs/background-job.worker';

const digits = (length: number): string =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');

function cnpj(): string {
  const base = digits(8) + '0001';
  const check = (numbers: string): number => {
    const weights =
      numbers.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = numbers
      .split('')
      .reduce(
        (total, digit, index) => total + Number(digit) * (weights[index] ?? 0),
        0,
      );
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = check(base);
  return `${base}${first}${check(`${base}${first}`)}`;
}

interface Envelope<T> {
  data: T;
}

interface Page<T> {
  data: T[];
  meta: { total: number };
}

interface Plan {
  id: string;
  code: string;
  name: string;
  status: string;
  validity: { startsOn: string; endsOn: string | null };
  frequency: { amount: number; unit: string; label: string };
  compliance: {
    status: string;
    daysUntilDue: number | null;
    overdue: boolean;
    dueSoonDays: number;
    lastExecutedAt: string | null;
    nextDueOn: string | null;
    evaluatedAt: string;
  };
  businessUnit: { id: string; name: string };
  customer: { id: string; name: string };
  technician: { id: string; displayName: string } | null;
  coveredEquipment: number;
  coverages?: {
    id: string;
    startsOn: string;
    asset: { id: string; name: string };
  }[];
  currentExecution?: {
    id: string;
    dueOn: string;
    status: string;
    operation: { id: string; code: string } | null;
    artifactExecution: { id: string } | null;
    schedulingEventId: string | null;
  } | null;
  recentExecutions?: { id: string; dueOn: string; status: string }[];
  allowedTransitions?: string[];
}

const PASSWORD = 'Orbit#Pmoc@2026';

/** `YYYY-MM-DD` de hoje mais N dias — o teste fala em dias, como o domínio. */
function inDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('PMOC (e2e)', () => {
  let app: INestApplication<App>;
  /** Administrativo: monta cenário. A aplicação sob teste roda restrita. */
  let prisma: PrismaClient;
  let worker: BackgroundJobWorker;
  let http: () => request.Agent;

  let token: string;
  let neighbourToken: string;
  let restrictedToken: string;
  let organizationId: string;
  let unitA: string;
  let unitB: string;
  let customerId: string;
  let assetA: string;
  let assetB: string;

  const auth = (req: request.Test, tok = token) =>
    req.set('Authorization', `Bearer ${tok}`);

  async function login(email: string): Promise<string> {
    const response = await http()
      .post('/api/v1/identity/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (response.body as Envelope<{ accessToken: string }>).data
      .accessToken;
  }

  async function register(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `pmoc.${label}.${suffix}@orbit.local`;
    const registration = await http()
      .post('/api/v1/identity/register')
      .send({
        email,
        firstName: 'Pmoc',
        lastName: 'E2E',
        password: PASSWORD,
        organizationName: `Pmoc ${label} ${suffix}`,
        legalName: `Pmoc ${label} ${suffix} LTDA`,
        documentType: 'CNPJ',
        documentNumber: cnpj(),
        city: 'Recife',
        street: 'Rua da Aurora',
        stateCode: 'PE',
      })
      .expect(201);
    return {
      email,
      token: (registration.body as Envelope<{ accessToken: string }>).data
        .accessToken,
    };
  }

  async function drain(rounds = 8): Promise<void> {
    for (let round = 0; round < rounds; round += 1) await worker.tick();
  }

  async function createAsset(unit: string, name: string, tok = token) {
    const response = await auth(http().post('/api/v1/assets'), tok)
      .send({
        businessUnitId: unit,
        customerId,
        category: 'EQUIPMENT',
        name,
        /** O contrato exige tipo e identificador juntos — ou nenhum dos dois. */
        identifierType: 'SERIAL_NUMBER',
        identifier: `AC-${digits(8)}`,
      })
      .expect(201);
    return (response.body as Envelope<{ id: string }>).data.id;
  }

  async function createPlan(
    body: Record<string, unknown> = {},
    tok = token,
    expected = 201,
  ): Promise<Plan> {
    const response = await auth(http().post('/api/v1/pmoc/plans'), tok)
      .send({
        businessUnitId: unitA,
        customerId,
        code: `PMOC-${digits(6)}`,
        name: 'Climatização — administrativo',
        startsOn: inDays(0),
        frequencyAmount: 6,
        frequencyUnit: 'MONTHS',
        ...body,
      })
      .expect(expected);
    return (response.body as Envelope<Plan>).data;
  }

  async function detail(id: string, tok = token): Promise<Plan> {
    const response = await auth(
      http().get(`/api/v1/pmoc/plans/${id}`),
      tok,
    ).expect(200);
    return (response.body as Envelope<Plan>).data;
  }

  /* ---------------------------------------------------------------- */

  beforeAll(async () => {
    process.env.STORAGE_PROVIDER = 'LOCAL';
    process.env.STORAGE_LOCAL_DIR = await mkdtemp(
      join(tmpdir(), 'orbit-e2e-pmoc-'),
    );
    process.env.JOBS_WORKER_ENABLED = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApiVersioning(app);
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    http = () => request(app.getHttpServer());
    prisma = adminPrisma();
    worker = app.get(BackgroundJobWorker);

    const principal = await register('principal');
    token = principal.token;
    neighbourToken = (await register('vizinha')).token;

    const organization = await auth(
      http().get('/api/v1/organizations/current'),
    ).expect(200);
    const current = (
      organization.body as Envelope<{
        id: string;
        businessUnits: { id: string }[];
      }>
    ).data;
    organizationId = current.id;
    unitA = current.businessUnits[0]!.id;

    const me = await prisma.user.findFirstOrThrow({
      where: { email: principal.email },
      select: { id: true },
    });
    const membership = await prisma.businessUnitMembership.findFirstOrThrow({
      where: { userId: me.id },
      select: { roleId: true },
    });
    const branch = await prisma.businessUnit.create({
      data: {
        organizationId,
        slug: `filial-${digits(6)}`,
        type: 'BRANCH',
        legalName: `Filial ${digits(4)} LTDA`,
        tradeName: 'Filial Norte',
        documentType: 'CNPJ',
        documentNumber: cnpj(),
        city: 'Recife',
        street: 'Rua do Sol',
        stateCode: 'PE',
      },
      select: { id: true },
    });
    await prisma.businessUnitMembership.create({
      data: {
        organizationId,
        businessUnitId: branch.id,
        userId: me.id,
        roleId: membership.roleId,
      },
    });
    unitB = branch.id;
    token = await login(principal.email);

    const customer = await auth(http().post('/api/v1/customers'))
      .send({
        legalName: `Cliente ${digits(4)} LTDA`,
        type: 'COMPANY',
        documentType: 'CNPJ',
        documentNumber: cnpj(),
      })
      .expect(201);
    customerId = (customer.body as Envelope<{ id: string }>).data.id;

    /** Um calendário: é onde o compromisso do plano vai parar. */
    await auth(http().post('/api/v1/scheduling/calendars'))
      .send({
        key: `manutencao-${digits(5)}`,
        name: 'Manutenção',
        timezone: 'America/Recife',
        isDefault: true,
      })
      .expect(201);

    assetA = await createAsset(unitA, 'Split 12.000 BTU — recepção');
    assetB = await createAsset(unitB, 'Split 18.000 BTU — filial');

    /**
     * Papel com equipamentos, mas **sem** PMOC — é o cenário do enunciado:
     * quem cadastra ar-condicionado não passa a ver contratos de manutenção.
     */
    const restricted = await register('restrita');
    const restrictedUser = await prisma.user.findFirstOrThrow({
      where: { email: restricted.email },
      select: { id: true },
    });
    const restrictedMembership =
      await prisma.organizationMembership.findFirstOrThrow({
        where: { userId: restrictedUser.id },
        select: { organizationId: true },
      });
    const limited = await prisma.role.create({
      data: {
        organizationId: restrictedMembership.organizationId,
        key: `SEM_PMOC_${digits(4)}`,
        name: 'Sem PMOC',
        permissions: [
          'assets.read',
          'assets.manage',
          'operations.read',
          'artifact_executions.read',
          'reports.management.read',
          'reports.management.manage',
          'organization.read',
        ],
      },
      select: { id: true },
    });
    await prisma.organizationMembership.updateMany({
      where: { userId: restrictedUser.id },
      data: { roleId: limited.id },
    });
    await prisma.businessUnitMembership.updateMany({
      where: { userId: restrictedUser.id },
      data: { roleId: limited.id },
    });
    restrictedToken = await login(restricted.email);
  }, 240000);

  afterAll(async () => {
    await app?.close();
    await disconnectAdminPrisma();
  });

  /* ================================================================ */
  /* 1 · 2 · 3 · 4 — ciclo de vida do plano                            */
  /* ================================================================ */

  it('1 · cria o plano como rascunho, sem vencimento', async () => {
    const plan = await createPlan({ name: 'PMOC administrativo' });

    expect(plan.status).toBe('DRAFT');
    expect(plan.frequency.label).toBe('a cada 6 meses');
    expect(plan.compliance.status).toBe('NOT_APPLICABLE');
    expect(plan.compliance.nextDueOn).toBeNull();
    expect(plan.compliance.dueSoonDays).toBe(15);
    expect(plan.coveredEquipment).toBe(0);
  }, 60000);

  it('2 · ativar define o primeiro vencimento e abre o ciclo', async () => {
    const created = await createPlan({ startsOn: inDays(-2) });

    const response = await auth(
      http().post(`/api/v1/pmoc/plans/${created.id}/activate`),
    ).expect(201);
    const plan = (response.body as Envelope<Plan>).data;

    expect(plan.status).toBe('ACTIVE');
    /** O primeiro vencimento é o início da vigência, não "hoje + período". */
    expect(plan.compliance.nextDueOn).toBe(inDays(-2));
    expect(plan.compliance.status).toBe('OVERDUE');
    expect(plan.compliance.daysUntilDue).toBe(-2);

    const full = await detail(created.id);
    expect(full.currentExecution?.dueOn).toBe(inDays(-2));
    expect(full.currentExecution?.status).toBe('PENDING');
    /** O compromisso entrou na Agenda existente. */
    expect(full.currentExecution?.schedulingEventId).toBeTruthy();

    const event = await prisma.schedulingEvent.findFirstOrThrow({
      where: { id: full.currentExecution!.schedulingEventId! },
      select: {
        sourceModule: true,
        sourceEntityId: true,
        type: true,
        startsAt: true,
        timezone: true,
      },
    });
    expect(event.sourceModule).toBe('pmoc');
    expect(event.sourceEntityId).toBe(created.id);
    expect(event.type).toBe('MAINTENANCE');
    expect(event.timezone).toBe('America/Recife');

    /** `nextDueOn` é DATE; Agenda deve publicar o mesmo dia civil. */
    const agendaResponse = await auth(
      http().get(
        `/api/v1/scheduling/agenda?view=DAY&date=${plan.compliance.nextDueOn}&businessUnitId=${unitA}`,
      ),
    ).expect(200);
    const agenda = (
      agendaResponse.body as Envelope<{
        range: { timezone: string };
        days: Array<{ date: string; events: Array<{ eventId: string }> }>;
      }>
    ).data;
    expect(agenda.range.timezone).toBe('America/Recife');
    expect(
      agenda.days
        .find((day) => day.date === plan.compliance.nextDueOn)
        ?.events.some(
          (item) => item.eventId === full.currentExecution!.schedulingEventId,
        ),
    ).toBe(true);
  }, 90000);

  it('3 · suspender para a avaliação; cancelar é terminal', async () => {
    const plan = await createPlan();
    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/activate`)).expect(
      201,
    );

    const suspended = await auth(
      http().post(`/api/v1/pmoc/plans/${plan.id}/suspend`),
    ).expect(201);
    const afterSuspend = (suspended.body as Envelope<Plan>).data;
    expect(afterSuspend.status).toBe('SUSPENDED');
    /** Suspenso não está em dia nem atrasado: está fora de avaliação. */
    expect(afterSuspend.compliance.status).toBe('NOT_APPLICABLE');

    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/cancel`)).expect(201);
    /** Cancelado não volta. */
    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/activate`)).expect(
      409,
    );
  }, 90000);

  it('4 · vigência invertida é recusada', async () => {
    await auth(http().post('/api/v1/pmoc/plans'))
      .send({
        businessUnitId: unitA,
        customerId,
        code: `PMOC-${digits(6)}`,
        name: 'Vigência impossível',
        startsOn: inDays(30),
        endsOn: inDays(10),
        frequencyAmount: 6,
        frequencyUnit: 'MONTHS',
      })
      .expect(400);

    /** Periodicidade precisa ser positiva — o DTO e o banco concordam. */
    await auth(http().post('/api/v1/pmoc/plans'))
      .send({
        businessUnitId: unitA,
        customerId,
        code: `PMOC-${digits(6)}`,
        name: 'Periodicidade zero',
        startsOn: inDays(0),
        frequencyAmount: 0,
        frequencyUnit: 'MONTHS',
      })
      .expect(400);
  });

  /* ================================================================ */
  /* 5 · 6 · 7 — cobertura de equipamentos                             */
  /* ================================================================ */

  it('5 · 6 · 7 · cobertura: aceita o próprio, recusa o de fora e o repetido', async () => {
    const plan = await createPlan();

    const added = await auth(
      http().post(`/api/v1/pmoc/plans/${plan.id}/equipment`),
    )
      .send({ assetId: assetA })
      .expect(201);
    expect(
      (added.body as Envelope<{ asset: { id: string } }>).data.asset.id,
    ).toBe(assetA);

    /** Duplicidade é recusada pelo índice único, não por checagem prévia. */
    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/equipment`))
      .send({ assetId: assetA })
      .expect(409);

    /** Equipamento de outra unidade: a equipe do plano não o atende. */
    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/equipment`))
      .send({ assetId: assetB })
      .expect(400);

    /** Equipamento de outra organização é indistinguível de inexistente. */
    const neighbourOrg = await auth(
      http().get('/api/v1/organizations/current'),
      neighbourToken,
    ).expect(200);
    const neighbourUnit = (
      neighbourOrg.body as Envelope<{ businessUnits: { id: string }[] }>
    ).data.businessUnits[0]!.id;
    const neighbourCustomer = await auth(
      http().post('/api/v1/customers'),
      neighbourToken,
    )
      .send({
        legalName: `Cliente ${digits(4)} LTDA`,
        type: 'COMPANY',
        documentType: 'CNPJ',
        documentNumber: cnpj(),
      })
      .expect(201);
    const foreignAsset = await auth(
      http().post('/api/v1/assets'),
      neighbourToken,
    )
      .send({
        businessUnitId: neighbourUnit,
        customerId: (neighbourCustomer.body as Envelope<{ id: string }>).data
          .id,
        category: 'EQUIPMENT',
        name: 'Split da vizinha',
        identifierType: 'SERIAL_NUMBER',
        identifier: `AC-${digits(8)}`,
      })
      .expect(201);

    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/equipment`))
      .send({
        assetId: (foreignAsset.body as Envelope<{ id: string }>).data.id,
      })
      .expect(404);

    const full = await detail(plan.id);
    expect(full.coveredEquipment).toBe(1);
    expect(full.coverages).toHaveLength(1);
  }, 120000);

  /* ================================================================ */
  /* 8 · 9 — periodicidade de calendário e próxima execução            */
  /* ================================================================ */

  it('8 · 9 · seis meses é calendário, e a próxima execução sai do banco', async () => {
    const plan = await createPlan({
      startsOn: inDays(0),
      frequencyAmount: 6,
      frequencyUnit: 'MONTHS',
    });
    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/activate`)).expect(
      201,
    );

    const active = await detail(plan.id);
    const executionId = active.currentExecution!.id;

    /** Executada hoje: a próxima é hoje + 6 meses **de calendário**. */
    const completed = await auth(
      http().post(
        `/api/v1/pmoc/plans/${plan.id}/executions/${executionId}/complete`,
      ),
    )
      .send({ notes: 'Limpeza e troca de filtros' })
      .expect(201);
    const after = (completed.body as Envelope<Plan>).data;

    const calendar = await prisma.$queryRaw<{ expected: string }[]>`
      SELECT (current_date + interval '6 months')::date::text AS expected
    `;
    const expected = calendar[0]!.expected;
    expect(after.compliance.nextDueOn).toBe(expected);
    expect(after.compliance.lastExecutedAt).not.toBeNull();
    expect(after.compliance.status).toBe('UP_TO_DATE');

    /** Seis meses de calendário não são 180 dias. */
    const naive = new Date();
    naive.setUTCDate(naive.getUTCDate() + 180);
    expect(after.compliance.nextDueOn).not.toBe(
      naive.toISOString().slice(0, 10),
    );

    /** O ciclo seguinte nasceu junto, com o vencimento novo. */
    const refreshed = await detail(plan.id);
    expect(refreshed.currentExecution?.dueOn).toBe(expected);
    expect(refreshed.recentExecutions?.[0]?.status).toBeDefined();
    expect(
      refreshed.recentExecutions?.some(
        (execution) => execution.status === 'COMPLETED',
      ),
    ).toBe(true);
  }, 120000);

  /* ================================================================ */
  /* 10 · 11 · 12 · 13 — os três estados de conformidade               */
  /* ================================================================ */

  it('10 · 11 · 12 · 13 · em dia, próximo e vencido, pelo relógio do servidor', async () => {
    const upToDate = await createPlan({
      startsOn: inDays(90),
      frequencyAmount: 1,
      frequencyUnit: 'YEARS',
    });
    const dueSoon = await createPlan({
      startsOn: inDays(5),
      frequencyAmount: 3,
      frequencyUnit: 'MONTHS',
    });
    const overdue = await createPlan({
      startsOn: inDays(-10),
      frequencyAmount: 3,
      frequencyUnit: 'MONTHS',
    });

    for (const plan of [upToDate, dueSoon, overdue]) {
      await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/activate`)).expect(
        201,
      );
    }

    expect((await detail(upToDate.id)).compliance.status).toBe('UP_TO_DATE');
    expect((await detail(dueSoon.id)).compliance.status).toBe('DUE_SOON');

    const late = await detail(overdue.id);
    expect(late.compliance.status).toBe('OVERDUE');
    expect(late.compliance.overdue).toBe(true);
    expect(late.compliance.daysUntilDue).toBe(-10);

    /** O instante da avaliação é do servidor, e vem declarado. */
    expect(new Date(late.compliance.evaluatedAt).getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );

    /** O filtro de conformidade é o mesmo do detalhe — resolvido no banco. */
    const filtered = await auth(
      http().get('/api/v1/pmoc/plans?compliance=OVERDUE&limit=100'),
    ).expect(200);
    const ids = (filtered.body as Envelope<Page<Plan>>).data.data.map(
      (plan) => plan.id,
    );
    expect(ids).toContain(overdue.id);
    expect(ids).not.toContain(upToDate.id);

    /** E as próximas manutenções saem em ordem de vencimento. */
    const upcoming = await auth(
      http().get('/api/v1/pmoc/upcoming?days=30'),
    ).expect(200);
    const rows = (
      upcoming.body as Envelope<{ planId: string; dueOn: string }[]>
    ).data;
    expect(rows.map((row) => row.planId)).toContain(dueSoon.id);
    expect(rows.map((row) => row.planId)).not.toContain(upToDate.id);
  }, 180000);

  /* ================================================================ */
  /* 14 — unidades isoladas                                            */
  /* ================================================================ */

  it('14 · o filtro por unidade separa os planos das filiais', async () => {
    const northern = await createPlan({
      businessUnitId: unitB,
      name: 'PMOC da filial',
    });

    const filtered = await auth(
      http().get(`/api/v1/pmoc/plans?businessUnitId=${unitB}&limit=100`),
    ).expect(200);
    const page = (filtered.body as Envelope<Page<Plan>>).data;

    expect(page.data.map((plan) => plan.id)).toContain(northern.id);
    for (const plan of page.data) {
      expect(plan.businessUnit.id).toBe(unitB);
    }
  }, 60000);

  /* ================================================================ */
  /* 15 · 16 — ordem de serviço, uma vez só                            */
  /* ================================================================ */

  it('15 · 16 · a ordem de serviço do ciclo nasce uma vez, mesmo em corrida', async () => {
    const plan = await createPlan({ startsOn: inDays(0) });
    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/equipment`))
      .send({ assetId: assetA })
      .expect(201);
    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/activate`)).expect(
      201,
    );

    const active = await detail(plan.id);
    const executionId = active.currentExecution!.id;
    const path = `/api/v1/pmoc/plans/${plan.id}/executions/${executionId}/operation`;

    const [first, second] = await Promise.all([
      auth(http().post(path)).send({}),
      auth(http().post(path)).send({}),
    ]);

    const firstId = (first.body as Envelope<{ operationId: string }>).data
      .operationId;
    const secondId = (second.body as Envelope<{ operationId: string }>).data
      .operationId;
    expect(firstId).toBe(secondId);

    /** Uma ordem no banco, e ela aponta para o equipamento coberto. */
    const operations = await prisma.operation.count({
      where: { organizationId, id: firstId },
    });
    expect(operations).toBe(1);

    const operation = await prisma.operation.findFirstOrThrow({
      where: { id: firstId },
      select: { code: true, assetId: true, customerId: true, kind: true },
    });
    expect(operation.assetId).toBe(assetA);
    expect(operation.customerId).toBe(customerId);
    expect(operation.kind).toBe('MAINTENANCE');
    expect(operation.code).toContain(plan.code);

    /** Terceira chamada: continua a mesma. */
    const third = await auth(http().post(path)).send({}).expect(201);
    expect(
      (third.body as Envelope<{ operationId: string; created: boolean }>).data,
    ).toMatchObject({ operationId: firstId, created: false });

    const withOperation = await detail(plan.id);
    expect(withOperation.currentExecution?.operation?.id).toBe(firstId);
  }, 180000);

  /* ================================================================ */
  /* 17 — evidência documental real                                    */
  /* ================================================================ */

  it('17 · a evidência precisa ser uma execução de artefato de PMOC', async () => {
    const plan = await createPlan({ startsOn: inDays(0) });
    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/activate`)).expect(
      201,
    );
    const active = await detail(plan.id);
    const executionId = active.currentExecution!.id;

    /** Um template de PMOC e uma execução real dele. */
    const template = await auth(http().post('/api/v1/artifact-templates'))
      .send({
        key: `PMOC_${digits(6)}`,
        name: 'PMOC de teste',
        artifactType: 'PMOC',
        sections: [
          {
            id: 'identificacao',
            title: 'Identificação',
            order: 1,
            type: 'FORM',
            fields: [
              {
                id: 'local',
                label: 'Local',
                type: 'TEXT',
                order: 1,
                required: false,
              },
            ],
          },
        ],
      })
      .expect(201);
    const templateId = (template.body as Envelope<{ id: string }>).data.id;

    /** Ativar é o que torna o template utilizável — não existe "publish". */
    await auth(http().post(`/api/v1/artifact-templates/${templateId}/activate`))
      .send({})
      .expect(201);

    const artifactExecution = await auth(
      http().post('/api/v1/artifact-executions'),
    )
      .send({
        templateId,
        businessUnitId: unitA,
        customerId,
        code: `PMOC-EX-${digits(6)}`,
        title: 'PMOC — visita semestral',
      })
      .expect(201);
    const artifactExecutionId = (
      artifactExecution.body as Envelope<{ id: string }>
    ).data.id;

    const linked = await auth(
      http().post(
        `/api/v1/pmoc/plans/${plan.id}/executions/${executionId}/evidence`,
      ),
    )
      .send({ artifactExecutionId })
      .expect(201);
    expect(
      (linked.body as Envelope<Plan>).data.currentExecution?.artifactExecution
        ?.id,
    ).toBe(artifactExecutionId);

    /** Um artefato que não é PMOC não serve de evidência de PMOC. */
    const otherTemplate = await auth(http().post('/api/v1/artifact-templates'))
      .send({
        key: `CHECK_${digits(6)}`,
        name: 'Checklist de instalação',
        artifactType: 'CHECKLIST',
        sections: [
          {
            id: 'itens',
            title: 'Itens',
            order: 1,
            type: 'CHECKLIST',
            fields: [
              {
                id: 'ok',
                label: 'Tudo certo',
                type: 'BOOLEAN',
                order: 1,
                required: false,
              },
            ],
          },
        ],
      })
      .expect(201);
    const otherTemplateId = (otherTemplate.body as Envelope<{ id: string }>)
      .data.id;
    await auth(
      http().post(`/api/v1/artifact-templates/${otherTemplateId}/activate`),
    )
      .send({})
      .expect(201);
    const otherExecution = await auth(
      http().post('/api/v1/artifact-executions'),
    )
      .send({
        templateId: otherTemplateId,
        businessUnitId: unitA,
        customerId,
        code: `CHK-EX-${digits(6)}`,
        title: 'Instalação',
      })
      .expect(201);

    const otherPlan = await createPlan({ startsOn: inDays(0) });
    await auth(
      http().post(`/api/v1/pmoc/plans/${otherPlan.id}/activate`),
    ).expect(201);
    const otherActive = await detail(otherPlan.id);

    await auth(
      http().post(
        `/api/v1/pmoc/plans/${otherPlan.id}/executions/${otherActive.currentExecution!.id}/evidence`,
      ),
    )
      .send({
        artifactExecutionId: (otherExecution.body as Envelope<{ id: string }>)
          .data.id,
      })
      .expect(400);
  }, 240000);

  /* ================================================================ */
  /* 18 · 19 — eventos e automação                                     */
  /* ================================================================ */

  it('18 · 19 · os fatos do PMOC viram eventos de domínio, uma vez cada', async () => {
    const catalog = await auth(
      http().get('/api/v1/automations/catalog'),
    ).expect(200);
    const triggers = (
      catalog.body as Envelope<{ triggers: { type: string }[] }>
    ).data.triggers.map((trigger) => trigger.type);

    expect(triggers).toEqual(
      expect.arrayContaining([
        'pmoc.plan.activated',
        'pmoc.due_soon',
        'pmoc.overdue',
        'pmoc.execution.completed',
      ]),
    );

    /** Uma regra real: PMOC vencido notifica quem cuidou do plano. */
    const rule = await auth(http().post('/api/v1/automations'))
      .send({
        name: 'Avisar PMOC vencido',
        trigger: 'pmoc.overdue',
        actions: [
          {
            type: 'SEND_NOTIFICATION',
            config: {
              title: `PMOC vencido ${digits(4)}`,
              body: 'A manutenção passou do prazo.',
              target: 'ACTOR',
            },
          },
        ],
      })
      .expect(201);
    const ruleId = (rule.body as Envelope<{ id: string }>).data.id;

    /** Um plano que já nasce vencido: o aviso é agendado para agora. */
    const plan = await createPlan({ startsOn: inDays(-3) });
    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/activate`)).expect(
      201,
    );

    const activated = await prisma.domainEvent.count({
      where: { organizationId, type: 'pmoc.plan.activated', entityId: plan.id },
    });
    expect(activated).toBe(1);

    /**
     * A fila é FIFO por `available_at`, e os planos dos testes anteriores já
     * deixaram avisos nela. Esvaziar até chegar no deste plano é o que um
     * worker de verdade faz sozinho; aqui o teste controla o relógio.
     */
    await drain(60);

    const overdueEvents = await prisma.domainEvent.count({
      where: { organizationId, type: 'pmoc.overdue', entityId: plan.id },
    });
    expect(overdueEvents).toBe(1);

    /** Rodar de novo não emite o mesmo aviso outra vez. */
    await prisma.backgroundJob.updateMany({
      where: {
        organizationId,
        queue: 'pmoc.due-check',
        status: { in: ['SUCCEEDED', 'PENDING'] },
      },
      data: {
        status: 'PENDING',
        lockedAt: null,
        lockedBy: null,
        availableAt: new Date(Date.now() - 1000),
      },
    });
    await drain(60);

    expect(
      await prisma.domainEvent.count({
        where: { organizationId, type: 'pmoc.overdue', entityId: plan.id },
      }),
    ).toBe(1);

    /** A automação reagiu ao evento e a ação foi executada. */
    const executions = await auth(
      http().get(`/api/v1/automations/executions?ruleId=${ruleId}&limit=50`),
    ).expect(200);
    const rows = (
      executions.body as Envelope<Page<{ status: string; actionType: string }>>
    ).data.data;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.actionType).toBe('SEND_NOTIFICATION');

    await auth(http().post(`/api/v1/automations/${ruleId}/toggle`))
      .send({ enabled: false })
      .expect(201);
  }, 240000);

  it('19 · concluir a manutenção emite o fato e rola o vencimento', async () => {
    const plan = await createPlan({
      startsOn: inDays(0),
      frequencyAmount: 3,
      frequencyUnit: 'MONTHS',
    });
    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/activate`)).expect(
      201,
    );
    const active = await detail(plan.id);

    await auth(
      http().post(
        `/api/v1/pmoc/plans/${plan.id}/executions/${active.currentExecution!.id}/complete`,
      ),
    )
      .send({})
      .expect(201);

    const events = await prisma.domainEvent.findMany({
      where: {
        organizationId,
        type: 'pmoc.execution.completed',
        entityId: plan.id,
      },
      select: { payload: true },
    });
    expect(events).toHaveLength(1);
    const payload = events[0]!.payload as Record<string, unknown>;
    expect(payload.code).toBe(plan.code);
    expect(typeof payload.nextDueOn).toBe('string');
  }, 120000);

  /* ================================================================ */
  /* 20 · 21 — Analytics e Management Reports com fonte real           */
  /* ================================================================ */

  it('20 · o painel de conformidade conta planos, ciclos e equipamentos', async () => {
    const response = await auth(http().get('/api/v1/pmoc/compliance')).expect(
      200,
    );
    const summary = (
      response.body as Envelope<{
        plans: { total: number; active: number };
        compliance: {
          upToDate: number;
          dueSoon: number;
          overdue: number;
          upToDateRate: string | null;
        };
        equipment: { covered: number };
        executions: { completedInPeriod: number; pending: number };
      }>
    ).data;

    expect(summary.plans.total).toBeGreaterThan(0);
    expect(summary.plans.active).toBeGreaterThan(0);
    expect(summary.compliance.overdue).toBeGreaterThanOrEqual(1);
    expect(summary.equipment.covered).toBeGreaterThanOrEqual(1);
    expect(summary.executions.pending).toBeGreaterThanOrEqual(1);

    /** A taxa é explícita, não um score opaco. */
    if (summary.compliance.upToDateRate !== null) {
      const rate = Number(summary.compliance.upToDateRate);
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(100);
    }
  }, 60000);

  it('21 · o relatório gerencial de PMOC usa o domínio, sem a antiga lacuna', async () => {
    const requested = await auth(http().post('/api/v1/management-reports'))
      .send({
        type: 'PMOC_COMPLIANCE',
        dateFrom: inDays(-60),
        dateTo: inDays(1),
      })
      .expect(202);
    const reportId = (requested.body as Envelope<{ id: string }>).data.id;

    await drain(10);

    const report = await auth(
      http().get(`/api/v1/management-reports/${reportId}`),
    ).expect(200);
    const snapshot = (
      report.body as Envelope<{
        status: string;
        snapshot: {
          sections: {
            id: string;
            metrics: { id: string; value: string }[];
            unavailableReason?: string;
          }[];
          sources: { source: string; included: boolean }[];
        };
      }>
    ).data;

    expect(snapshot.status).toBe('READY');

    const ids = snapshot.snapshot.sections.map((section) => section.id);
    expect(ids).toContain('pmoc.plans');
    expect(ids).toContain('pmoc.cycles');

    /** A lacuna "não existe PMOC vencido" **sumiu**: agora existe fonte. */
    const overdueSection = snapshot.snapshot.sections.find(
      (section) => section.id === 'pmoc.overdue',
    );
    expect(overdueSection).toBeUndefined();

    const metrics = snapshot.snapshot.sections.flatMap(
      (section) => section.metrics,
    );
    const overdueMetric = metrics.find(
      (metric) => metric.id === 'pmoc.overdue',
    );
    expect(Number(overdueMetric?.value)).toBeGreaterThanOrEqual(1);

    expect(
      snapshot.snapshot.sources.some(
        (source) => source.source.includes('pmoc_plans') && source.included,
      ),
    ).toBe(true);
  }, 240000);

  /* ================================================================ */
  /* 22 · 23 · 24 — segurança                                          */
  /* ================================================================ */

  it('22 · 23 · quem tem equipamentos mas não tem PMOC recebe 403', async () => {
    /** Equipamentos: pode. */
    await auth(http().get('/api/v1/assets?limit=1'), restrictedToken).expect(
      200,
    );

    /** PMOC: não. */
    await auth(http().get('/api/v1/pmoc/plans'), restrictedToken).expect(403);
    await auth(http().get('/api/v1/pmoc/compliance'), restrictedToken).expect(
      403,
    );
    await auth(http().post('/api/v1/pmoc/plans'), restrictedToken)
      .send({
        businessUnitId: unitA,
        customerId,
        code: `PMOC-${digits(6)}`,
        name: 'Não autorizada',
        startsOn: inDays(0),
        frequencyAmount: 6,
        frequencyUnit: 'MONTHS',
      })
      .expect(403);

    /**
     * E o relatório gerencial **não** é o contorno: ele passou a exigir
     * `pmoc.read` junto com a capability de relatórios.
     */
    await auth(http().post('/api/v1/management-reports'), restrictedToken)
      .send({
        type: 'PMOC_COMPLIANCE',
        dateFrom: inDays(-30),
        dateTo: inDays(0),
      })
      .expect(403);

    /** Sem sessão, 401. */
    await http().get('/api/v1/pmoc/plans').expect(401);
  }, 90000);

  it('24 · plano de outra organização não é visível', async () => {
    const mine = await createPlan();

    await auth(
      http().get(`/api/v1/pmoc/plans/${mine.id}`),
      neighbourToken,
    ).expect(404);

    const neighbourList = await auth(
      http().get('/api/v1/pmoc/plans?limit=100'),
      neighbourToken,
    ).expect(200);
    expect(
      (neighbourList.body as Envelope<Page<Plan>>).data.data.map(
        (plan) => plan.id,
      ),
    ).not.toContain(mine.id);
  }, 60000);

  it('24 · as políticas de RLS existem nas três tabelas do domínio', async () => {
    const policies = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_policies
       WHERE tablename IN ('pmoc_plans', 'pmoc_equipment_coverages', 'pmoc_executions')
    `;
    expect(policies.map((policy) => policy.tablename).sort()).toEqual([
      'pmoc_equipment_coverages',
      'pmoc_executions',
      'pmoc_plans',
    ]);

    const forced = await prisma.$queryRaw<{ relforcerowsecurity: boolean }[]>`
      SELECT relforcerowsecurity FROM pg_class
       WHERE relname IN ('pmoc_plans', 'pmoc_equipment_coverages', 'pmoc_executions')
    `;
    for (const table of forced) {
      expect(table.relforcerowsecurity).toBe(true);
    }
  });

  /* ================================================================ */
  /* 25 — snapshots antigos não mudam                                  */
  /* ================================================================ */

  it('25 · relatório gerencial antigo permanece como foi gerado', async () => {
    const requested = await auth(http().post('/api/v1/management-reports'))
      .send({
        type: 'PMOC_COMPLIANCE',
        dateFrom: inDays(-45),
        dateTo: inDays(2),
      })
      .expect(202);
    const reportId = (requested.body as Envelope<{ id: string }>).data.id;
    await drain(10);

    const before = await auth(
      http().get(`/api/v1/management-reports/${reportId}`),
    ).expect(200);
    const snapshot = JSON.stringify(
      (before.body as Envelope<{ snapshot: unknown }>).data.snapshot,
    );
    const hash = (before.body as Envelope<{ sourceHash: string }>).data
      .sourceHash;

    /** O mundo anda: um plano novo, vencido, depois do relatório. */
    const late = await createPlan({ startsOn: inDays(-40) });
    await auth(http().post(`/api/v1/pmoc/plans/${late.id}/activate`)).expect(
      201,
    );

    const after = await auth(
      http().get(`/api/v1/management-reports/${reportId}`),
    ).expect(200);

    expect(
      JSON.stringify(
        (after.body as Envelope<{ snapshot: unknown }>).data.snapshot,
      ),
    ).toBe(snapshot);
    expect(
      (after.body as Envelope<{ sourceHash: string }>).data.sourceHash,
    ).toBe(hash);
  }, 240000);

  /**
   * Stress por último: cada ativação agenda jobs reais. Executá-lo antes dos
   * testes de worker mudava deliberadamente a fila que eles precisavam drenar
   * e transformava repetição em dependência entre casos.
   */
  it('ativa concorrentemente sem duplicar ciclo, agenda ou due jobs', async () => {
    const plan = await createPlan({ startsOn: inDays(1) });
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        auth(http().post(`/api/v1/pmoc/plans/${plan.id}/activate`)),
      ),
    );
    expect(
      responses.filter((response) => response.status === 201).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      responses.every((response) => [201, 409].includes(response.status)),
    ).toBe(true);

    expect(
      await prisma.pmocExecution.count({ where: { planId: plan.id } }),
    ).toBe(1);
    expect(
      await prisma.schedulingEvent.count({
        where: { sourceModule: 'pmoc', sourceEntityId: plan.id },
      }),
    ).toBe(1);
    expect(
      await prisma.backgroundJob.count({
        where: {
          queue: 'pmoc.due-check',
          jobKey: { startsWith: `pmoc:${plan.id}:` },
        },
      }),
    ).toBe(2);

    const current = await prisma.pmocExecution.findFirstOrThrow({
      where: { planId: plan.id, status: 'PENDING' },
      select: { id: true },
    });
    const completions = await Promise.all(
      Array.from({ length: 3 }, () =>
        auth(
          http().post(
            `/api/v1/pmoc/plans/${plan.id}/executions/${current.id}/complete`,
          ),
        ).send({}),
      ),
    );
    expect(
      completions.filter((response) => response.status === 201),
    ).toHaveLength(1);
    expect(
      completions.every((response) => [201, 409].includes(response.status)),
    ).toBe(true);
    expect(
      await prisma.pmocExecution.count({ where: { planId: plan.id } }),
    ).toBe(2);
  }, 120000);

  it('faz rollback de ACTIVE quando a criação do ciclo falha e aceita retry', async () => {
    const plan = await createPlan({ startsOn: inDays(1) });
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_pmoc_cycle_fault() RETURNS trigger AS $$
      BEGIN
        IF NEW.plan_id = '${plan.id}'::uuid THEN
          RAISE EXCEPTION 'injected PMOC cycle failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER test_pmoc_cycle_fault_trigger
      BEFORE INSERT ON pmoc_executions
      FOR EACH ROW EXECUTE FUNCTION test_pmoc_cycle_fault()
    `);
    try {
      await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/activate`)).expect(
        500,
      );
      const rolledBack = await prisma.pmocPlan.findUniqueOrThrow({
        where: { id: plan.id },
        select: { status: true, nextDueOn: true },
      });
      expect(rolledBack.status).toBe('DRAFT');
      expect(rolledBack.nextDueOn).toBeNull();
      expect(
        await prisma.pmocExecution.count({ where: { planId: plan.id } }),
      ).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS test_pmoc_cycle_fault_trigger ON pmoc_executions',
      );
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS test_pmoc_cycle_fault()',
      );
    }

    await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/activate`)).expect(
      201,
    );
    expect(
      await prisma.pmocExecution.count({ where: { planId: plan.id } }),
    ).toBe(1);
  }, 120000);

  it('conclui vinte ciclos completos sem not-found espúrio', async () => {
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const correlation = `pmoc-repeat-${iteration}`;
      const plan = await createPlan({
        startsOn: inDays(0),
        frequencyAmount: 6,
        frequencyUnit: 'MONTHS',
      });
      await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/equipment`))
        .set('x-request-id', `${correlation}-coverage`)
        .send({ assetId: assetA })
        .expect(201);
      await auth(http().post(`/api/v1/pmoc/plans/${plan.id}/activate`))
        .set('x-request-id', `${correlation}-activate`)
        .expect(201);

      const active = await detail(plan.id);
      const executionId = active.currentExecution!.id;
      const operation = await auth(
        http().post(
          `/api/v1/pmoc/plans/${plan.id}/executions/${executionId}/operation`,
        ),
      )
        .set('x-request-id', `${correlation}-operation`)
        .send({})
        .expect(201);
      const operationId = (operation.body as Envelope<{ operationId: string }>)
        .data.operationId;

      const completed = await auth(
        http().post(
          `/api/v1/pmoc/plans/${plan.id}/executions/${executionId}/complete`,
        ),
      )
        .set('x-request-id', `${correlation}-complete`)
        .send({ notes: `Repetição ${iteration}` })
        .expect(201);
      const result = (completed.body as Envelope<Plan>).data;
      expect(result.id).toBe(plan.id);
      expect(result.compliance.lastExecutedAt).not.toBeNull();
      expect(
        result.recentExecutions?.some(
          (execution) =>
            execution.id === executionId && execution.status === 'COMPLETED',
        ),
      ).toBe(true);
      expect(operationId).toEqual(expect.any(String));
    }
  }, 600_000);
});
