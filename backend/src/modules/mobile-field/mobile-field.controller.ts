import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ForbiddenException } from '../../exceptions';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import { RequiresActivePlan } from '../subscription-plans/plan-access';
import {
  MobileDocumentsQueryDto,
  MobileWorkQueueQueryDto,
} from './mobile-field.dto';
import {
  MobileFieldService,
  type MobileFieldActor,
} from './mobile-field.service';

@ApiTags('Mobile Field')
@Controller('mobile/field')
@RequiresActivePlan()
export class MobileFieldController {
  constructor(private readonly service: MobileFieldService) {}

  /**
   * A tela inicial, numa chamada.
   *
   * Existe para eliminar a cascata: montar "documentos recentes" no aplicativo
   * custava uma requisição por atendimento da fila. Aqui é agregação de
   * leituras que já existiam — nenhuma regra nova.
   */
  @Get('home')
  @ApiOperation({ summary: 'Tela inicial do técnico, consolidada' })
  home(@Req() request: IdentityRequest) {
    return this.service.home(this.actor(request));
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard operacional consolidado do técnico' })
  dashboard(@Req() request: IdentityRequest) {
    return this.service.dashboard(this.actor(request));
  }

  @Get('work-queue')
  @ApiOperation({ summary: 'Fila de trabalho canônica e paginada' })
  workQueue(
    @Req() request: IdentityRequest,
    @Query() query: MobileWorkQueueQueryDto,
  ) {
    return this.service.workQueue(this.actor(request), query);
  }

  @Get('documents')
  @ApiOperation({ summary: 'Documentos de campo emitidos, paginados' })
  documents(
    @Req() request: IdentityRequest,
    @Query() query: MobileDocumentsQueryDto,
  ) {
    return this.service.documents(this.actor(request), query);
  }

  @Get('work-items/:id')
  @ApiOperation({ summary: 'Contexto consolidado de um item de campo' })
  fieldContext(@Req() request: IdentityRequest, @Param('id') id: string) {
    return this.service.fieldContext(this.actor(request), id);
  }

  private actor(request: IdentityRequest): MobileFieldActor {
    const identity = request.identity;
    if (!identity?.organizationId)
      throw new ForbiddenException('Contexto de organização obrigatório');
    return {
      id: identity.id,
      organizationId: identity.organizationId,
      businessUnitIds: identity.businessUnitIds,
      permissions: identity.permissions,
    };
  }
}
