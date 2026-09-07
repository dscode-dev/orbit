/**
 * As recusas da assinatura, com código público separado da mensagem interna.
 *
 * A mensagem daqui vai para o log e pode nomear estado e plano. A que chega ao
 * cliente vem do catálogo da PR-35, escolhida pelo código.
 */
import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../../../exceptions';

export class SubscriptionNotFoundException extends BaseException {
  constructor(organizationId: string) {
    super(
      {
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: `No current subscription for organization ${organizationId}`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class SubscriptionNotActiveException extends BaseException {
  constructor(status: string) {
    super(
      {
        code: 'SUBSCRIPTION_NOT_ACTIVE',
        message: `Subscription does not grant product access: ${status}`,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class SubscriptionInvalidTransitionException extends BaseException {
  constructor(from: string, to: string) {
    super(
      {
        code: 'SUBSCRIPTION_INVALID_TRANSITION',
        message: `Subscription transition not allowed: ${from} -> ${to}`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class PlanChangeNotAllowedException extends BaseException {
  constructor(reason: string) {
    super(
      {
        code: 'PLAN_CHANGE_NOT_ALLOWED',
        message: `Plan change refused: ${reason}`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * A recusa de avaliação — sempre igual, qualquer que seja o motivo.
 *
 * O motivo real fica no log. Publicar "este CNPJ já usou" transformaria o
 * endpoint num verificador de quem é cliente do Orbit, e um atacante com uma
 * lista de CNPJs faria a consulta que a Receita não faz.
 */
export class TrialNotEligibleException extends BaseException {
  constructor(readonly internalReason: string) {
    super(
      {
        code: 'TRIAL_NOT_ELIGIBLE',
        message: `Trial refused: ${internalReason}`,
      },
      HttpStatus.CONFLICT,
    );
  }
}
