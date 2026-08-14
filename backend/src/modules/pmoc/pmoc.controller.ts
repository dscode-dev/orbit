/**
 * API do domínio PMOC — `/api/v1/pmoc`.
 *
 * ## Capabilities próprias
 *
 * `pmoc.read` / `pmoc.manage`. Acesso a equipamento **não** dá acesso a PMOC: o
 * plano diz o que a empresa se comprometeu a manter e para quem, e isso é
 * informação contratual — quem cadastra um ar-condicionado não passa a ver os
 * contratos de manutenção da carteira.
 *
 * ## E elas não substituem as dos outros domínios
 *
 * Gerar a ordem de serviço de um ciclo exige também `operations.create`;
 * vincular a evidência exige `artifact_executions.read`. Os guardas de rota
 * conferem o PMOC; o serviço confere o resto — um módulo que integra outros é
 * exatamente onde as autorizações se perdem, se cada uma não for conferida no
 * seu lugar.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import { ParseUUIDv7Pipe } from '../../pipes';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import {
  Capabilities,
  RequiresActivePlan,
} from '../subscription-plans/plan-access';
import {
  AddPmocCoverageDto,
  CompletePmocExecutionDto,
  CreatePmocOperationDto,
  CreatePmocPlanDto,
  LinkPmocEvidenceDto,
  PmocAnalyticsQueryDto,
  PmocPlanQueryDto,
  PmocUpcomingQueryDto,
  UpdatePmocPlanDto,
} from './pmoc.dto';
import { PmocService, type PmocActor } from './pmoc.service';

@ApiTags('PMOC')
@Controller('pmoc')
@RequiresActivePlan()
export class PmocController {
  constructor(private readonly pmoc: PmocService) {}

  /* ---------------------------------------------------------------- */
  /* Conformidade — antes de `:id`, senão a rota vira um identificador  */
  /* ---------------------------------------------------------------- */

  @Get('compliance')
  @Capabilities('pmoc.read')
  @Permissions('pmoc.read')
  @ApiOperation({ summary: 'Compliance counters, computed by the server' })
  compliance(
    @Req() request: IdentityRequest,
    @Query() query: PmocAnalyticsQueryDto,
  ) {
    return this.pmoc.compliance(this.actor(request), query);
  }

  @Get('upcoming')
  @Capabilities('pmoc.read')
  @Permissions('pmoc.read')
  @ApiOperation({ summary: 'Maintenances due within a window' })
  upcoming(
    @Req() request: IdentityRequest,
    @Query() query: PmocUpcomingQueryDto,
  ) {
    return this.pmoc.upcoming(this.actor(request), query);
  }

  /* ---------------------------------------------------------------- */
  /* Planos                                                            */
  /* ---------------------------------------------------------------- */

  @Get('plans')
  @Capabilities('pmoc.read')
  @Permissions('pmoc.read')
  @ApiOperation({ summary: 'PMOC plans, ordered by next due date' })
  list(@Req() request: IdentityRequest, @Query() query: PmocPlanQueryDto) {
    return this.pmoc.list(this.actor(request), query);
  }

  @Post('plans')
  @Capabilities('pmoc.manage')
  @Permissions('pmoc.manage')
  @ApiOperation({ summary: 'Create a plan; it starts as DRAFT' })
  create(@Req() request: IdentityRequest, @Body() input: CreatePmocPlanDto) {
    return this.pmoc.create(this.actor(request), input);
  }

  @Get('plans/:id')
  @Capabilities('pmoc.read')
  @Permissions('pmoc.read')
  @ApiOperation({ summary: 'Plan with coverage, compliance and cycles' })
  detail(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.pmoc.get(id, this.actor(request));
  }

  @Patch('plans/:id')
  @Capabilities('pmoc.manage')
  @Permissions('pmoc.manage')
  @ApiOperation({
    summary: 'Edit a plan; unit, customer and code never change',
  })
  update(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdatePmocPlanDto,
  ) {
    return this.pmoc.update(id, this.actor(request), input);
  }

  /* ---------------------------------------------------------------- */
  /* Transições                                                        */
  /* ---------------------------------------------------------------- */

  /**
   * Cada transição tem rota própria.
   *
   * Um `PATCH /plans/:id { status }` genérico permitiria escrever `EXPIRED` à
   * mão — e vencimento não é decisão de ninguém, é constatação do calendário.
   */
  @Post('plans/:id/activate')
  @Capabilities('pmoc.manage')
  @Permissions('pmoc.manage')
  @ApiOperation({
    summary: 'Activate: sets the first due date and schedules it',
  })
  activate(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.pmoc.activate(id, this.actor(request));
  }

  @Post('plans/:id/suspend')
  @Capabilities('pmoc.manage')
  @Permissions('pmoc.manage')
  @ApiOperation({ summary: 'Suspend: stops compliance evaluation' })
  suspend(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.pmoc.suspend(id, this.actor(request));
  }

  @Post('plans/:id/cancel')
  @Capabilities('pmoc.manage')
  @Permissions('pmoc.manage')
  @ApiOperation({
    summary: 'Cancel: terminal; executed cycles remain on record',
  })
  cancel(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.pmoc.cancel(id, this.actor(request));
  }

  /* ---------------------------------------------------------------- */
  /* Cobertura                                                         */
  /* ---------------------------------------------------------------- */

  @Get('plans/:id/equipment')
  @Capabilities('pmoc.read')
  @Permissions('pmoc.read')
  @ApiOperation({ summary: 'Equipment covered by the plan' })
  coverages(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.pmoc.coverages(id, this.actor(request));
  }

  @Post('plans/:id/equipment')
  @Capabilities('pmoc.manage')
  @Permissions('pmoc.manage')
  @ApiOperation({ summary: 'Cover an equipment; duplicates are refused' })
  addCoverage(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: AddPmocCoverageDto,
  ) {
    return this.pmoc.addCoverage(id, this.actor(request), input);
  }

  @Delete('plans/:id/equipment/:coverageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Capabilities('pmoc.manage')
  @Permissions('pmoc.manage')
  @ApiOperation({ summary: 'Remove coverage; history of cycles remains' })
  async removeCoverage(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('coverageId', ParseUUIDv7Pipe) coverageId: string,
    @Req() request: IdentityRequest,
  ): Promise<void> {
    await this.pmoc.removeCoverage(id, coverageId, this.actor(request));
  }

  /* ---------------------------------------------------------------- */
  /* Ciclos                                                            */
  /* ---------------------------------------------------------------- */

  @Get('plans/:id/executions')
  @Capabilities('pmoc.read')
  @Permissions('pmoc.read')
  @ApiOperation({ summary: 'Cycle history, newest first' })
  executions(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.pmoc.executions(id, this.actor(request));
  }

  @Post('plans/:id/executions/:executionId/complete')
  @Capabilities('pmoc.manage')
  @Permissions('pmoc.manage')
  @ApiOperation({
    summary: 'Complete a cycle; the periodicity rolls from the performed date',
  })
  complete(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('executionId', ParseUUIDv7Pipe) executionId: string,
    @Req() request: IdentityRequest,
    @Body() input: CompletePmocExecutionDto,
  ) {
    return this.pmoc.completeExecution(
      id,
      executionId,
      this.actor(request),
      input,
    );
  }

  /** Exige também `operations.create` — conferido no serviço. */
  @Post('plans/:id/executions/:executionId/operation')
  @Capabilities('pmoc.manage', 'operations.manage')
  @Permissions('pmoc.manage')
  @ApiOperation({ summary: 'Generate the work order for a cycle; idempotent' })
  createOperation(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('executionId', ParseUUIDv7Pipe) executionId: string,
    @Req() request: IdentityRequest,
    @Body() input: CreatePmocOperationDto,
  ) {
    return this.pmoc.createOperation(
      id,
      executionId,
      this.actor(request),
      input,
    );
  }

  /** Exige também `artifact_executions.read` — conferido no serviço. */
  @Post('plans/:id/executions/:executionId/evidence')
  @Capabilities('pmoc.manage', 'artifact_executions.read')
  @Permissions('pmoc.manage')
  @ApiOperation({ summary: 'Link a real PMOC artifact execution as evidence' })
  linkEvidence(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('executionId', ParseUUIDv7Pipe) executionId: string,
    @Req() request: IdentityRequest,
    @Body() input: LinkPmocEvidenceDto,
  ) {
    return this.pmoc.linkEvidence(id, executionId, this.actor(request), input);
  }

  private actor(request: IdentityRequest): PmocActor {
    const organizationId = request.identity?.organizationId;
    const actorId = request.identity?.id;
    if (!organizationId || !actorId) {
      throw new ForbiddenException('Organization context is required');
    }
    return {
      organizationId,
      actorId,
      permissions: request.identity?.permissions ?? [],
      businessUnitIds: request.identity?.businessUnitIds ?? [],
    };
  }
}
