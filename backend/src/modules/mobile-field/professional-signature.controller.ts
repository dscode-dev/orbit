/**
 * A assinatura profissional, pela Web.
 *
 * ## Por que existe um segundo controller
 *
 * O aggregate, as regras e o serviço são os mesmos da PR-27: `UserSignature`,
 * versionada, com upload conferido byte a byte. O que faltava era **porta**.
 * As rotas existentes moram sob `mobile/field`, e o BFF da Web encaminha por
 * prefixo de controller — pedir ao navegador que chame `mobile/field/me/...`
 * exigiria abrir a superfície inteira do aplicativo de campo para a Web, o que
 * é muito mais do que se quer, e diria a coisa errada sobre a quem a rota
 * pertence.
 *
 * O controller mora ao lado do serviço que ele delega, e não no módulo de
 * identidade: o caminho da URL diz a quem a rota pertence do ponto de vista de
 * quem a usa; a fiação diz de quem é o código. Misturar os dois criaria uma
 * dependência entre módulos para não ganhar nada.
 *
 * Aqui não há regra nova. Nem uma. A assinatura continua exigindo perfil
 * profissional ativo, continua criando versão em vez de sobrescrever, e a
 * recusa continua vindo do mesmo lugar.
 *
 * ## Isto não é assinatura qualificada
 *
 * O que se cadastra é a **representação gráfica** da assinatura da pessoa.
 * Nada aqui é ICP-Brasil, certificado digital ou assinatura qualificada, e
 * nenhum texto do produto deve sugerir que seja.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPublicErrors } from '../../common/public-errors';
import { ForbiddenException } from '../../exceptions';
import type { IdentityRequest } from '../identity/infrastructure/jwt-authentication.guard';
import type { MobileFieldActor } from './mobile-field.service';
import {
  MobileSignatureUploadDto,
  MobileSignatureUploadReservationDto,
} from './mobile-signature.dto';
import { MobileSignatureService } from './mobile-signature.service';

@ApiTags('Identity Profile')
@ApiPublicErrors()
@Controller('identity/me/signature')
export class ProfessionalSignatureController {
  constructor(private readonly signatures: MobileSignatureService) {}

  @Get()
  @ApiOperation({ summary: 'Situação da própria assinatura profissional' })
  status(@Req() request: IdentityRequest) {
    return this.signatures.status(this.actor(request));
  }

  @Post('uploads')
  @ApiOperation({ summary: 'Reserva o envio de uma nova assinatura' })
  reserve(
    @Req() request: IdentityRequest,
    @Body() input: MobileSignatureUploadReservationDto,
  ) {
    return this.signatures.reserveUpload(this.actor(request), input);
  }

  @Post()
  @ApiOperation({ summary: 'Ativa uma nova versão da assinatura' })
  activate(
    @Req() request: IdentityRequest,
    @Body() input: MobileSignatureUploadDto,
  ) {
    return this.signatures.upload(this.actor(request), input);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoga a assinatura ativa' })
  revoke(@Req() request: IdentityRequest) {
    return this.signatures.revoke(this.actor(request));
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
