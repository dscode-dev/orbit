import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ForbiddenException } from '../../exceptions';
import { ParseUUIDv7Pipe } from '../../pipes';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import { RequiresActivePlan } from '../subscription-plans/plan-access';
import {
  FieldOperationChecklistUpdateDto,
  FieldOperationCommandDto,
  FieldOperationMaterialDto,
  FieldOperationNoteDto,
  FieldOperationTimelineQueryDto,
} from './mobile-field-operation.dto';
import { MobileFieldOperationService } from './mobile-field-operation.service';
import type { MobileFieldActor } from './mobile-field.service';

@ApiTags('Mobile Field Operations')
@Controller('mobile/field/operations')
@RequiresActivePlan()
export class MobileFieldOperationController {
  constructor(private readonly service: MobileFieldOperationService) {}

  @Get(':operationId/execution-preparation')
  @ApiOperation({
    summary: 'Prepara uma Operation atribuída para execução em campo',
  })
  preparation(
    @Req() request: IdentityRequest,
    @Param('operationId', ParseUUIDv7Pipe) operationId: string,
  ) {
    return this.service.preparation(this.actor(request), operationId);
  }

  @Post(':operationId/commands/start')
  @ApiOperation({ summary: 'Inicia semanticamente o atendimento de campo' })
  start(
    @Req() request: IdentityRequest,
    @Param('operationId', ParseUUIDv7Pipe) operationId: string,
    @Body() input: FieldOperationCommandDto,
  ) {
    return this.service.start(this.actor(request), operationId, input);
  }

  @Post(':operationId/commands/complete')
  @ApiOperation({ summary: 'Conclui semanticamente o atendimento de campo' })
  complete(
    @Req() request: IdentityRequest,
    @Param('operationId', ParseUUIDv7Pipe) operationId: string,
    @Body() input: FieldOperationCommandDto,
  ) {
    return this.service.complete(this.actor(request), operationId, input);
  }

  @Post(':operationId/notes')
  @ApiOperation({ summary: 'Registra uma observação operacional' })
  note(
    @Req() request: IdentityRequest,
    @Param('operationId', ParseUUIDv7Pipe) operationId: string,
    @Body() input: FieldOperationNoteDto,
  ) {
    return this.service.addNote(this.actor(request), operationId, input);
  }

  @Put(':operationId/checklists/:checklistId')
  @ApiOperation({ summary: 'Atualiza um checklist com OCC' })
  checklist(
    @Req() request: IdentityRequest,
    @Param('operationId', ParseUUIDv7Pipe) operationId: string,
    @Param('checklistId', ParseUUIDv7Pipe) checklistId: string,
    @Body() input: FieldOperationChecklistUpdateDto,
  ) {
    return this.service.updateChecklist(
      this.actor(request),
      operationId,
      checklistId,
      input,
    );
  }

  @Post(':operationId/materials')
  @ApiOperation({ summary: 'Registra consumo idempotente de material' })
  material(
    @Req() request: IdentityRequest,
    @Param('operationId', ParseUUIDv7Pipe) operationId: string,
    @Body() input: FieldOperationMaterialDto,
  ) {
    return this.service.registerMaterial(
      this.actor(request),
      operationId,
      input,
    );
  }

  @Get(':operationId/timeline')
  @ApiOperation({ summary: 'Timeline pública e paginada do atendimento' })
  timeline(
    @Req() request: IdentityRequest,
    @Param('operationId', ParseUUIDv7Pipe) operationId: string,
    @Query() query: FieldOperationTimelineQueryDto,
  ) {
    return this.service.timeline(this.actor(request), operationId, query);
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
