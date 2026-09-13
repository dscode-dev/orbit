import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IHashProvider } from '../../../contracts';
import { HASH_PROVIDER } from '../../../providers';
import {
  ConflictException,
  EntityNotFoundException,
  ValidationException,
} from '../../../exceptions';
import { identityTokenLink } from '../../identity/domain/identity-links';
import {
  IDENTITY_TOKEN_DELIVERY,
  IdentityTokenPurpose,
  type IIdentityTokenDelivery,
} from '../../identity/domain/identity.types';
import { IdentityRepository } from '../../identity/infrastructure/identity.repository';
import { IdentityTokenService } from '../../identity/application/token.service';
import {
  AllocationResource,
  EntitlementService,
} from '../../subscription-plans/entitlements';
import { OrganizationRepository } from '../organization.repository';
import { TeamRepository } from './team.repository';
import { generateTemporaryPassword } from './temporary-password';

/** Quanto tempo o link de definição de senha vale. */
const VALIDADE_DO_LINK_MS = 24 * 60 * 60_000;

export interface TeamActor {
  organizationId: string;
  userId: string;
}

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private readonly team: TeamRepository,
    private readonly organizations: OrganizationRepository,
    private readonly identity: IdentityRepository,
    private readonly tokens: IdentityTokenService,
    private readonly entitlements: EntitlementService,
    @Inject(HASH_PROVIDER) private readonly hashes: IHashProvider,
    @Inject(IDENTITY_TOKEN_DELIVERY)
    private readonly delivery: IIdentityTokenDelivery,
  ) {}

  /**
   * Cadastra alguém da equipe e devolve a senha temporária **uma vez**.
   *
   * ## Por que cadastro direto, e não convite
   *
   * O convite pressupõe que a pessoa tem e-mail, lê e-mail, e consegue concluir
   * um cadastro sozinha. Boa parte de uma equipe de campo não atende às três, e
   * o resultado prático era o owner não conseguir colocar o próprio técnico no
   * sistema. O convite continua existindo para quem tem e-mail; isto é o outro
   * caminho, não o substituto.
   *
   * ## A senha não fica guardada
   *
   * Ela é gerada, transformada em hash e devolvida na resposta. Não há coluna
   * com ela, e não há segunda chance de lê-la: perdida a resposta, o caminho é
   * gerar um link novo de definição de senha.
   */
  async createMember(
    actor: TeamActor,
    input: {
      email: string;
      firstName: string;
      lastName: string;
      roleId: string;
      businessUnitId?: string;
    },
  ) {
    const organizacao = await this.organizations.findCurrent(
      actor.organizationId,
    );
    if (!organizacao) throw new EntityNotFoundException('Organization');

    const papel = await this.requireAssignableRole(
      actor.organizationId,
      input.roleId,
    );
    const businessUnitId = this.requireBusinessUnit(
      input.businessUnitId,
      organizacao.businessUnits,
    );

    const senha = generateTemporaryPassword();
    const resultado = await this.team.createMember(
      {
        organizationId: actor.organizationId,
        businessUnitId,
        roleId: papel.id,
        email: input.email.trim(),
        normalizedEmail: input.email.trim().toLowerCase(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        passwordHash: await this.hashes.hash(senha),
      },
      (transaction) =>
        this.entitlements.enforceAllocationIn(
          transaction,
          actor.organizationId,
          AllocationResource.PLATFORM_USERS,
        ),
    );

    if ('conflict' in resultado) {
      /**
       * Mensagem única para e-mail já usado **em qualquer organização**.
       *
       * Dizer "já existe nesta organização" versus "existe em outra" contaria a
       * quem cadastra onde aquela pessoa já trabalha.
       */
      throw new ConflictException('This e-mail already has an Orbit account');
    }

    const membro = await this.team.findMember(
      actor.organizationId,
      resultado.userId,
    );
    if (!membro) throw new EntityNotFoundException('Member', resultado.userId);

    return { member: membro, temporaryPassword: senha };
  }

  /**
   * Um link de definição de senha para um membro, visível ao owner.
   *
   * ## Por que devolver o link aqui, e nunca no fluxo público
   *
   * `POST /identity/password/forgot` é anônimo: qualquer um pode chamá-lo com
   * qualquer e-mail, e devolver o link ali seria entregar contas a quem digitar
   * o endereço certo. Aqui quem pede já é quem administra aquela pessoa — pode
   * trocar o papel dela, desligá-la, ver o que ela faz — e passar o link por
   * WhatsApp não lhe dá poder que ele já não tenha.
   *
   * O e-mail também é disparado quando há SMTP: os dois caminhos levam ao mesmo
   * endereço, e o owner usa o que funcionar para aquela pessoa.
   */
  async issuePasswordLink(actor: TeamActor, userId: string) {
    const membro = await this.team.findMember(actor.organizationId, userId);
    if (!membro) throw new EntityNotFoundException('Member', userId);

    const organizacao = await this.organizations.findCurrent(
      actor.organizationId,
    );
    /**
     * O dono não recebe link por aqui.
     *
     * Quem administrasse a organização poderia gerar um link para a conta do
     * dono e assumir o lugar dele. O dono redefine a própria senha pelo fluxo
     * público, que exige acesso ao e-mail dele.
     */
    if (organizacao?.ownerUserId === userId) {
      throw new ValidationException(
        'The organization owner must use the public password recovery flow',
      );
    }

    const token = this.tokens.generateOpaqueToken();
    const expiresAt = new Date(Date.now() + VALIDADE_DO_LINK_MS);
    await this.identity.createPasswordReset(
      userId,
      this.tokens.hashOpaqueToken(token),
      expiresAt,
    );

    /**
     * O e-mail sai também, e a falha dele não derruba a resposta.
     *
     * O link é o entregável desta rota — o owner o repassa por onde conseguir.
     * Tentar o e-mail é conveniência para quem tem caixa postal; se o SMTP não
     * estiver configurado, o owner ainda tem o link na mão, e `emailSent` diz a
     * ele que precisa usá-lo.
     */
    let emailSent = false;
    try {
      await this.delivery.deliver(
        IdentityTokenPurpose.PASSWORD_RESET,
        membro.user.email,
        token,
      );
      emailSent = true;
    } catch {
      this.logger.warn('Team password link e-mail delivery failed');
    }

    return {
      link: identityTokenLink(IdentityTokenPurpose.PASSWORD_RESET, token),
      expiresAt,
      emailSent,
      member: membro,
    };
  }

  async removeMember(actor: TeamActor, userId: string) {
    const organizacao = await this.organizations.findCurrent(
      actor.organizationId,
    );
    if (organizacao?.ownerUserId === userId) {
      throw new ValidationException(
        'The organization owner cannot be removed from the team',
      );
    }
    if (actor.userId === userId) {
      throw new ValidationException('You cannot remove your own access');
    }
    const membro = await this.team.findMember(actor.organizationId, userId);
    if (!membro) throw new EntityNotFoundException('Member', userId);

    await this.team.removeMember(actor.organizationId, userId);
  }

  /**
   * O papel precisa existir nesta organização e não conceder tudo.
   *
   * ## A recusa é pela permissão, não pelo nome
   *
   * O que não pode ser concedido aqui é o curinga `*`: quem o recebe passa a
   * poder remover quem o cadastrou, e trocar o comando da conta é decisão de
   * outra ordem — não um campo de formulário.
   *
   * Recusar apenas o papel **chamado** `OWNER` deixaria a porta aberta: a
   * organização pode criar papéis próprios em `POST /organizations/current/roles`,
   * e um deles com `['*']` teria passado por ter outro nome. Checar a permissão
   * fecha o caso que a regra existe para impedir.
   *
   * Papéis sob medida sem curinga continuam atribuíveis — é para isso que o
   * endpoint de papéis existe, e a tela de equipe não tem por que recusá-los.
   * Um papel de outra organização é recusado como inexistente: a FK não conhece
   * inquilino, e `findRole` filtra por ele.
   */
  private async requireAssignableRole(organizationId: string, roleId: string) {
    const papel = await this.organizations.findRole(roleId, organizationId);
    if (!papel) throw new ValidationException('Invalid role');
    if (papel.permissions.includes('*')) {
      throw new ValidationException(
        'A role granting every permission cannot be assigned from the team screen',
      );
    }
    return papel;
  }

  private requireBusinessUnit(
    informada: string | undefined,
    unidades: readonly { id: string; isPrimary?: boolean }[],
  ): string {
    if (!informada) {
      const principal =
        unidades.find((unidade) => unidade.isPrimary) ?? unidades[0];
      if (!principal) {
        throw new ValidationException(
          'The organization has no business unit to assign',
        );
      }
      return principal.id;
    }
    const pertence = unidades.some((unidade) => unidade.id === informada);
    if (!pertence) throw new ValidationException('Invalid business unit');
    return informada;
  }
}
