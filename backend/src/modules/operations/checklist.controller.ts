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
  ChecklistExecutionQueryDto,
  ChecklistTemplateQueryDto,
  CreateChecklistTemplateDto,
  SaveChecklistAnswersDto,
  StartChecklistExecutionDto,
  UpdateChecklistTemplateDto,
} from './checklist.dto';
import { ChecklistService } from './checklist.service';

@ApiTags('Checklists')
@Controller()
@RequiresActivePlan()
export class ChecklistController {
  constructor(private readonly checklists: ChecklistService) {}

  @Get('checklist-templates')
  @Capabilities('checklists.read')
  @Permissions('checklists.read')
  templates(
    @Req() req: IdentityRequest,
    @Query() query: ChecklistTemplateQueryDto,
  ) {
    return this.checklists.listTemplates(this.org(req), query);
  }

  @Get('checklist-templates/:id')
  @Capabilities('checklists.read')
  @Permissions('checklists.read')
  template(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
  ) {
    return this.checklists.getTemplate(id, this.org(req));
  }

  @Post('checklist-templates')
  @Capabilities('checklists.manage')
  @Permissions('checklists.create')
  createTemplate(
    @Req() req: IdentityRequest,
    @Body() body: CreateChecklistTemplateDto,
  ) {
    return this.checklists.createTemplate(this.org(req), body);
  }

  @Patch('checklist-templates/:id')
  @Capabilities('checklists.manage')
  @Permissions('checklists.update')
  updateTemplate(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
    @Body() body: UpdateChecklistTemplateDto,
  ) {
    return this.checklists.updateTemplate(id, this.org(req), body);
  }

  @Delete('checklist-templates/:id')
  @Capabilities('checklists.manage')
  @Permissions('checklists.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTemplate(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
  ) {
    return this.checklists.removeTemplate(id, this.org(req));
  }

  @Get('checklist-executions')
  @Capabilities('checklists.read')
  @Permissions('checklists.read')
  executions(
    @Req() req: IdentityRequest,
    @Query() query: ChecklistExecutionQueryDto,
  ) {
    return this.checklists.listExecutions(this.org(req), query);
  }

  @Get('checklist-executions/:id')
  @Capabilities('checklists.read')
  @Permissions('checklists.read')
  execution(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
  ) {
    return this.checklists.getExecution(id, this.org(req));
  }

  @Post('operations/:operationId/checklists')
  @Capabilities('checklists.execute')
  @Permissions('checklists.execute')
  start(
    @Param('operationId', ParseUUIDv7Pipe) operationId: string,
    @Req() req: IdentityRequest,
    @Body() body: StartChecklistExecutionDto,
  ) {
    return this.checklists.start(
      operationId,
      this.org(req),
      req.identity!.id,
      body,
    );
  }

  @Patch('checklist-executions/:id/answers')
  @Capabilities('checklists.execute')
  @Permissions('checklists.execute')
  save(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
    @Body() body: SaveChecklistAnswersDto,
  ) {
    return this.checklists.save(id, this.org(req), req.identity!.id, body);
  }

  @Post('checklist-executions/:id/complete')
  @Capabilities('checklists.execute')
  @Permissions('checklists.execute')
  complete(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
  ) {
    return this.checklists.complete(id, this.org(req), req.identity!.id);
  }

  @Post('checklist-executions/:id/cancel')
  @Capabilities('checklists.execute')
  @Permissions('checklists.execute')
  cancel(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() req: IdentityRequest,
  ) {
    return this.checklists.cancel(id, this.org(req), req.identity!.id);
  }

  private org(req: IdentityRequest) {
    if (!req.identity?.organizationId)
      throw new ForbiddenException('Organization context is required');
    return req.identity.organizationId;
  }
}
