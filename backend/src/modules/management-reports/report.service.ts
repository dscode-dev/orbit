/**
 * Regras do Management Reports Engine.
 *
 * ## Autorização composta, e ela fecha
 *
 * `reports.management.read` abre o motor; **não abre os domínios**. Um
 * relatório financeiro exige `financial.read` — do plano e do papel — antes de
 * qualquer composição, e a mesma checagem se repete na leitura do snapshot: um
 * relatório gerado ontem por quem tinha acesso não vira porta para quem não
 * tem hoje.
 *
 * Sem isso, este motor seria a maneira mais fácil de ler o caixa da empresa:
 * um endpoint que agrega tudo é um endpoint que contorna todas as
 * autorizações, se não repetir cada uma delas.
 *
 * ## O período é do servidor
 *
 * Fuso resolvido da unidade, janela máxima conferida, início antes do fim.
 * Nada disso chega do cliente — e o fuso, em especial, nunca vem do navegador:
 * dois relatórios do mesmo mês precisam cobrir o mesmo intervalo.
 *
 * ## Um relatório histórico não se recalcula
 *
 * Ler um relatório devolve o snapshot gravado. Não há caminho que recomponha
 * na leitura — se houvesse, "o relatório de março" mudaria em maio.
 */
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  EntityNotFoundException,
  ForbiddenException,
  ValidationException,
} from '../../exceptions';
import { generateUuidV7 } from '../../utils';
import { BackgroundJobQueue } from '../jobs/background-job.queue';
import { JOB_QUEUES } from '../jobs/background-job.types';
import { StorageFileMapper } from '../storage/file-object.mapper';
import { FileObjectService } from '../storage/file-object.service';
import { SubscriptionPlanService } from '../subscription-plans/subscription-plan.service';
import {
  REPORT_FORMATS,
  REPORT_SCHEMA_VERSION,
  REPORT_TYPES,
  findReportType,
  type ReportTypeDefinition,
} from './report.catalog';
import type { GenerateReportDto, ReportQueryDto } from './report.dto';
import { ReportMapper } from './report.mapper';
import type { ReportCatalogReadModel } from './report.read-models';
import { ReportRepository } from './report.repository';

/** Quem pediu, e o que ele pode. */
export interface ReportActor {
  organizationId: string;
  actorId: string;
  permissions: readonly string[];
  businessUnitIds: readonly string[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class ReportService {
  constructor(
    private readonly repository: ReportRepository,
    private readonly mapper: ReportMapper,
    private readonly jobs: BackgroundJobQueue,
    private readonly plans: SubscriptionPlanService,
    private readonly files: FileObjectService,
    private readonly fileMapper: StorageFileMapper,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Catálogo                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * O que existe, e o que **esta sessão** pode gerar.
   *
   * `allowed` é resolvido no servidor porque a autorização é do servidor: uma
   * interface que recalculasse "posso gerar o financeiro?" a partir de uma
   * lista local divergiria no primeiro papel novo — e ofereceria um botão que
   * volta 403.
   */
  async catalog(actor: ReportActor): Promise<ReportCatalogReadModel> {
    const capabilities = await this.capabilities(actor.organizationId);

    return {
      types: REPORT_TYPES.map((definition) => {
        const blocked = this.blockedReason(definition, actor, capabilities);
        return {
          type: definition.type,
          name: definition.name,
          description: definition.description,
          domains: definition.domains,
          parameters: definition.parameters,
          formats: definition.formats,
          maxRangeDays: definition.maxRangeDays,
          capabilities: definition.capabilities,
          permissions: definition.permissions,
          allowed: blocked === null,
          ...(blocked ? { blockedReason: blocked } : {}),
        };
      }),
      formats: REPORT_FORMATS,
      schemaVersion: REPORT_SCHEMA_VERSION,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Geração                                                           */
  /* ---------------------------------------------------------------- */

  async generate(actor: ReportActor, input: GenerateReportDto) {
    const definition = findReportType(input.type);
    if (!definition) {
      throw new ValidationException(`Unknown report type: ${input.type}`);
    }

    const capabilities = await this.capabilities(actor.organizationId);
    const blocked = this.blockedReason(definition, actor, capabilities);
    if (blocked) throw new ForbiddenException(blocked);

    const format = input.format ?? 'PDF';
    if (!definition.formats.includes(format)) {
      throw new ValidationException(
        `Report ${definition.type} does not support ${format}. Supported: ${definition.formats.join(', ')}`,
      );
    }

    this.assertParameters(input, definition);

    const period = this.period(input, definition);
    const unit = await this.resolveUnit(actor, input.businessUnitId);
    const timezone = unit
      ? unit.timezone
      : await this.repository.organizationTimezone(actor.organizationId);

    if (input.customerId) {
      const customer = await this.repository.findCustomer(
        input.customerId,
        actor.organizationId,
      );
      if (!customer) {
        throw new EntityNotFoundException('Customer', input.customerId);
      }
    }

    const parameters = this.parameters(input, definition, timezone);
    const correlationId = generateUuidV7();

    const { id, created } = await this.repository.createOrReuse({
      organizationId: actor.organizationId,
      businessUnitId: unit?.id ?? null,
      type: definition.type,
      format,
      parameters: parameters as Prisma.InputJsonValue,
      parametersHash: hashOf(parameters),
      timezone,
      periodFrom: period.from,
      periodTo: period.to,
      generatedById: actor.actorId,
      correlationId,
    });

    /**
     * Já havia uma geração idêntica em andamento.
     *
     * Devolvida como está, sem enfileirar de novo: o segundo clique não produz
     * um segundo PDF. Quem quiser um retrato novo espera este terminar e gera
     * outra vez — aí o recorte já não está "em andamento" e o índice parcial
     * deixa passar.
     */
    if (created) {
      await this.jobs.enqueue({
        queue: JOB_QUEUES.managementReport,
        jobKey: id,
        organizationId: actor.organizationId,
        businessUnitId: unit?.id ?? null,
        payload: {
          reportId: id,
          /** A autorização do momento do pedido acompanha o trabalho. */
          capabilities: [...capabilities],
          permissions: [...actor.permissions],
        },
        correlationId,
        actorUserId: actor.actorId,
      });

      await this.repository.audit(
        actor.organizationId,
        actor.actorId,
        'MANAGEMENT_REPORT_REQUESTED',
        id,
        {
          type: definition.type,
          parameters,
          correlationId,
        },
      );
    }

    return this.get(id, actor);
  }

  /* ---------------------------------------------------------------- */
  /* Leitura                                                           */
  /* ---------------------------------------------------------------- */

  list(actor: ReportActor, query: ReportQueryDto) {
    return this.repository.list(actor.organizationId, query);
  }

  /**
   * Detalhe, com o snapshot.
   *
   * A autorização do **tipo** é conferida de novo: quem perdeu o acesso ao
   * Financeiro para de ler o relatório financeiro que ele mesmo gerou. O
   * snapshot é dado do domínio, e continuar servindo-o seria manter uma porta
   * aberta depois de trocar a fechadura.
   */
  async get(id: string, actor: ReportActor) {
    const report = await this.repository.find(id, actor.organizationId);
    if (!report) throw new EntityNotFoundException('ManagementReport', id);

    await this.assertCanRead(report.type, actor);
    return this.mapper.details(report);
  }

  async status(id: string, actor: ReportActor) {
    const report = await this.repository.find(id, actor.organizationId);
    if (!report) throw new EntityNotFoundException('ManagementReport', id);
    await this.assertCanRead(report.type, actor);
    return this.mapper.status(report);
  }

  async snapshot(id: string, actor: ReportActor) {
    const report = await this.repository.find(id, actor.organizationId);
    if (!report) throw new EntityNotFoundException('ManagementReport', id);
    await this.assertCanRead(report.type, actor);

    const snapshot = this.mapper.snapshot(report.data);
    if (!snapshot) {
      throw new ValidationException(
        'This report has no snapshot yet. Check its status.',
      );
    }
    return snapshot;
  }

  /**
   * URL assinada e temporária — nunca um caminho de storage.
   *
   * A mesma infraestrutura do manifest: quem baixa recebe uma URL que expira,
   * e o acesso fica auditado.
   */
  async download(
    id: string,
    actor: ReportActor,
    operation: 'download' | 'preview',
  ) {
    const report = await this.repository.findWithFile(id, actor.organizationId);
    if (!report) throw new EntityNotFoundException('ManagementReport', id);

    await this.assertCanRead(report.type, actor);

    if (!report.file) {
      throw new EntityNotFoundException('Management report file', id);
    }

    const signed = await this.files.sign(
      {
        bucket: report.file.bucket,
        objectKey: report.file.objectKey,
        fileName: report.file.fileName,
        mimeType: report.file.mimeType,
      },
      operation,
    );

    await this.repository.audit(
      actor.organizationId,
      actor.actorId,
      'MANAGEMENT_REPORT_DOWNLOADED',
      report.id,
      { operation, type: report.type },
    );

    return this.fileMapper.signedUrl(signed);
  }

  /* ---------------------------------------------------------------- */
  /* Autorização                                                       */
  /* ---------------------------------------------------------------- */

  private async assertCanRead(type: string, actor: ReportActor): Promise<void> {
    const definition = findReportType(type);
    if (!definition) return;
    const capabilities = await this.capabilities(actor.organizationId);
    const blocked = this.blockedReason(definition, actor, capabilities);
    if (blocked) throw new ForbiddenException(blocked);
  }

  private async capabilities(organizationId: string): Promise<Set<string>> {
    const entitlements = await this.plans.getEntitlements(organizationId);
    return new Set(entitlements.capabilities);
  }

  /**
   * Por que este ator não pode — em texto, não em booleano.
   *
   * A interface precisa poder dizer "este relatório usa Financeiro, e seu
   * acesso não inclui Financeiro". Devolver apenas `false` obrigaria o cliente
   * a adivinhar o motivo, e a adivinhação viraria uma cópia da regra.
   */
  private blockedReason(
    definition: ReportTypeDefinition,
    actor: ReportActor,
    capabilities: ReadonlySet<string>,
  ): string | null {
    const hasWildcardCapability = capabilities.has('*');
    const missingCapability = definition.capabilities.find(
      (capability) => !hasWildcardCapability && !capabilities.has(capability),
    );
    if (missingCapability) {
      return `O plano da organização não inclui ${missingCapability}, exigida por este relatório.`;
    }

    const permissions = new Set(actor.permissions);
    if (permissions.has('*')) return null;

    const missingPermission = definition.permissions.find(
      (permission) => !permissions.has(permission),
    );
    if (missingPermission) {
      return `Seu acesso não inclui ${missingPermission}, exigida por este relatório.`;
    }

    return null;
  }

  /* ---------------------------------------------------------------- */
  /* Recorte                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Parâmetro que o tipo não aceita é **recusado**, não descartado.
   *
   * Descartar em silêncio produziria um relatório da organização inteira para
   * quem pediu o de um cliente — e o snapshot não teria como dizer que o
   * recorte pedido não aconteceu. O catálogo publica quais parâmetros cada
   * tipo aceita; a recusa aponta para ele.
   */
  private assertParameters(
    input: GenerateReportDto,
    definition: ReportTypeDefinition,
  ): void {
    const accepted = new Set<string>(definition.parameters);
    const sent: [string, unknown][] = [
      ['businessUnitId', input.businessUnitId],
      ['customerId', input.customerId],
      ['operationKind', input.operationKind],
      ['operationStatus', input.operationStatus],
    ];

    for (const [key, value] of sent) {
      if (value !== undefined && !accepted.has(key)) {
        throw new ValidationException(
          `Report ${definition.type} does not accept "${key}". Accepted: ${definition.parameters.join(', ') || '(none)'}`,
        );
      }
    }
  }

  /**
   * O período, conferido.
   *
   * A janela máxima é do catálogo e existe por desempenho: compor cinco anos
   * varre o histórico inteiro de vários domínios, e o resultado chega tarde
   * demais para servir a alguém. A recusa diz o limite — não trunca em
   * silêncio, que faria o relatório mentir sobre o período que cobre.
   */
  private period(
    input: GenerateReportDto,
    definition: ReportTypeDefinition,
  ): { from: Date; to: Date } {
    const from = input.dateFrom;
    const to = input.dateTo;

    if (from > to) {
      throw new ValidationException('The period starts after it ends');
    }

    const days = Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY);
    if (days > definition.maxRangeDays) {
      throw new ValidationException(
        `This report accepts at most ${definition.maxRangeDays} days per generation. Requested: ${days}.`,
      );
    }

    return { from, to };
  }

  /**
   * A unidade precisa ser da organização **e** da sessão.
   *
   * `businessUnitIds` do token é o recorte que o usuário atende. Aceitar uma
   * unidade fora dele deixaria alguém compor um relatório de uma filial que
   * ele não enxerga em nenhuma outra tela.
   */
  private async resolveUnit(actor: ReportActor, businessUnitId?: string) {
    if (!businessUnitId) return null;

    const unit = await this.repository.findBusinessUnit(
      businessUnitId,
      actor.organizationId,
    );
    if (!unit)
      throw new EntityNotFoundException('BusinessUnit', businessUnitId);

    if (
      actor.businessUnitIds.length > 0 &&
      !actor.businessUnitIds.includes(businessUnitId)
    ) {
      throw new ForbiddenException('This business unit is out of your scope');
    }

    return unit;
  }

  /**
   * Os parâmetros efetivos, normalizados.
   *
   * Só o que o tipo aceita entra — o que não é aceito já foi recusado em
   * `assertParameters`. É sobre este objeto que o hash de identidade da
   * solicitação é calculado.
   */
  private parameters(
    input: GenerateReportDto,
    definition: ReportTypeDefinition,
    timezone: string,
  ): Record<string, unknown> {
    const accepted = new Set<string>(definition.parameters);
    const parameters: Record<string, unknown> = {
      dateFrom: input.dateFrom.toISOString(),
      dateTo: input.dateTo.toISOString(),
      timezone,
      format: input.format ?? 'PDF',
    };

    if (accepted.has('businessUnitId') && input.businessUnitId) {
      parameters.businessUnitId = input.businessUnitId;
    }
    if (accepted.has('customerId') && input.customerId) {
      parameters.customerId = input.customerId;
    }
    if (accepted.has('operationKind') && input.operationKind) {
      parameters.operationKind = input.operationKind;
    }
    if (accepted.has('operationStatus') && input.operationStatus) {
      parameters.operationStatus = input.operationStatus;
    }

    return parameters;
  }
}

/** Identidade da solicitação: chaves ordenadas, SHA-256. */
function hashOf(parameters: Record<string, unknown>): string {
  const ordered = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${String(parameters[key])}`)
    .join('&');
  return createHash('sha256').update(ordered).digest('hex');
}
