import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../decorators';
import { ForbiddenException } from '../../exceptions';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import { RequiresActivePlan } from '../subscription-plans/plan-access';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { OrganizationService } from './organization.service';
import { OrganizationReadModelMapper } from './organization.mapper';

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly organizations: OrganizationService,
    private readonly readModels: OrganizationReadModelMapper,
  ) {}

  @Post()
  async create(
    @Req() request: IdentityRequest,
    @Body() input: CreateOrganizationDto,
  ) {
    return this.readModels.context(
      await this.organizations.create(request.identity!.id, input),
    );
  }

  @Get('current')
  @RequiresActivePlan()
  async getCurrent(@Req() request: IdentityRequest) {
    return this.readModels.context(
      await this.organizations.getCurrent(this.organizationId(request)),
    );
  }

  /**
   * Membros da organização.
   *
   * Existe porque atribuir e reatribuir trabalho exige conhecer as pessoas:
   * `POST /operations/:id/assignments` recebe um `userId` que, até aqui,
   * nenhuma rota publicava. É leitura pura, do mesmo escopo de
   * `GET /organizations/current`, e por isso segue a mesma autorização.
   */
  @Get('current/members')
  @RequiresActivePlan()
  async members(@Req() request: IdentityRequest) {
    const { members, unitMemberships, ownerUserId } =
      await this.organizations.listMembers(this.organizationId(request));
    return this.readModels.members(members, ownerUserId, unitMemberships);
  }

  /**
   * Papéis disponíveis para a organização.
   *
   * Publica o que cada papel **concede** (`permissions`), para que a interface
   * possa mostrar por que alguém pode ou não fazer algo. É leitura do mesmo
   * escopo de `GET /organizations/current`: nenhum papel é criado ou alterado
   * por aqui — o modelo tem `isSystem`, e edição de papel não existe em
   * contrato nenhum.
   */
  @Get('current/roles')
  @RequiresActivePlan()
  async roles(@Req() request: IdentityRequest) {
    return this.readModels.roles(
      await this.organizations.listRoles(this.organizationId(request)),
    );
  }

  @Patch('current')
  @RequiresActivePlan()
  @Permissions('organization.update')
  async updateCurrent(
    @Req() request: IdentityRequest,
    @Body() input: UpdateOrganizationDto,
  ) {
    return this.readModels.context(
      await this.organizations.update(this.organizationId(request), input),
    );
  }

  private organizationId(request: IdentityRequest): string {
    const organizationId = request.identity?.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    return organizationId;
  }
}
