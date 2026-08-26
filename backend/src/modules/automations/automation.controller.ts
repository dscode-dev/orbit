/**
 * API do Automation Engine.
 *
 * ## Automação executa em nome da organização
 *
 * Quem cria uma regra passa a criar lembretes e notificações sem estar
 * presente. Por isso `automations.manage` não decorre de acesso a operações
 * nem à agenda: são permissões diferentes, e a segunda não implica a primeira.
 *
 * ## Ligar e desligar tem rota própria
 *
 * Não é campo de `PATCH`. Desligar uma automação é a ação de emergência do
 * domínio — quando uma regra está criando o que não devia, a pessoa precisa de
 * um botão, não de um formulário de edição.
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
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import { ParseUUIDv7Pipe } from '../../pipes';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import {
  Capabilities,
  RequiresActivePlan,
} from '../subscription-plans/plan-access';
import {
  AutomationExecutionQueryDto,
  AutomationRuleQueryDto,
  CreateAutomationRuleDto,
  ToggleAutomationRuleDto,
  UpdateAutomationRuleDto,
} from './automation.dto';
import { AutomationMapper } from './automation.mapper';
import { AutomationService, type AutomationActor } from './automation.service';

@ApiTags('Automations')
@Controller('automations')
@RequiresActivePlan()
export class AutomationController {
  constructor(
    private readonly automations: AutomationService,
    private readonly mapper: AutomationMapper,
  ) {}

  /**
   * O catálogo: gatilhos, ações, operadores e unidades de atraso.
   *
   * Publicado para que a interface monte o formulário a partir do servidor.
   * Uma lista escrita no cliente ofereceria automações que o motor não sabe
   * disparar.
   */
  @Get('catalog')
  @Capabilities('automations.read')
  @Permissions('automations.read')
  catalog() {
    return this.automations.catalog();
  }

  @Get()
  @Capabilities('automations.read')
  @Permissions('automations.read')
  async list(
    @Req() request: IdentityRequest,
    @Query() query: AutomationRuleQueryDto,
  ) {
    const result = await this.automations.list(this.org(request), query);
    return {
      data: result.data.map((rule) => this.mapper.rule(rule)),
      meta: result.meta,
    };
  }

  /** Histórico de execuções — a prova do que a automação fez. */
  @Get('executions')
  @Capabilities('automations.read')
  @Permissions('automations.read')
  async executions(
    @Req() request: IdentityRequest,
    @Query() query: AutomationExecutionQueryDto,
  ) {
    const result = await this.automations.executions(this.org(request), query);
    return {
      data: result.data.map((execution) => this.mapper.execution(execution)),
      meta: result.meta,
    };
  }

  @Get(':id')
  @Capabilities('automations.read')
  @Permissions('automations.read')
  async detail(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.mapper.rule(await this.automations.get(id, this.org(request)));
  }

  @Post()
  @Capabilities('automations.manage')
  @Permissions('automations.manage')
  async create(
    @Req() request: IdentityRequest,
    @Body() input: CreateAutomationRuleDto,
  ) {
    return this.mapper.rule(
      await this.automations.create(
        this.org(request),
        this.actorScope(request),
        input,
      ),
    );
  }

  /** Sem `trigger`: trocá-lo transformaria a regra em outra regra. */
  @Patch(':id')
  @Capabilities('automations.manage')
  @Permissions('automations.manage')
  async update(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateAutomationRuleDto,
  ) {
    return this.mapper.rule(
      await this.automations.update(
        id,
        this.org(request),
        this.actorScope(request),
        input,
      ),
    );
  }

  @Post(':id/toggle')
  @Capabilities('automations.manage')
  @Permissions('automations.manage')
  async toggle(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: ToggleAutomationRuleDto,
  ) {
    return this.mapper.rule(
      await this.automations.toggle(
        id,
        this.org(request),
        this.actorScope(request),
        input.enabled,
      ),
    );
  }

  /** A cópia nasce desligada: duplicar é para ajustar antes de valer. */
  @Post(':id/duplicate')
  @Capabilities('automations.manage')
  @Permissions('automations.manage')
  async duplicate(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.mapper.rule(
      await this.automations.duplicate(
        id,
        this.org(request),
        this.actorScope(request),
      ),
    );
  }

  /** Recusado enquanto houver ação agendada — ver o serviço. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Capabilities('automations.manage')
  @Permissions('automations.manage')
  async remove(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ): Promise<void> {
    await this.automations.remove(id, this.org(request), this.actor(request));
  }

  private org(request: IdentityRequest): string {
    const id = request.identity?.organizationId;
    if (!id) throw new ForbiddenException('Organization context is required');
    return id;
  }

  private actor(request: IdentityRequest): string {
    const id = request.identity?.id;
    if (!id) throw new ForbiddenException('User context is required');
    return id;
  }

  private actorScope(request: IdentityRequest): AutomationActor {
    return {
      id: this.actor(request),
      businessUnitIds: request.identity?.businessUnitIds ?? [],
    };
  }
}
