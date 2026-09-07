import {
  SubscriptionStatus,
  allowedTransitions,
  allowsPlanChange,
  allowsTransition,
  grantsProductAccess,
  isTerminal,
} from './subscription.types';

describe('ciclo de vida da assinatura', () => {
  describe('acesso ao produto', () => {
    it.each([
      [SubscriptionStatus.TRIALING, true],
      [SubscriptionStatus.ACTIVE, true],
      [SubscriptionStatus.PAST_DUE, true],
      [SubscriptionStatus.GRACE_PERIOD, true],
      [SubscriptionStatus.SUSPENDED, false],
      [SubscriptionStatus.CANCELED, false],
      [SubscriptionStatus.EXPIRED, false],
    ])('%s concede acesso: %s', (status, esperado) => {
      expect(grantsProductAccess(status)).toBe(esperado);
    });
  });

  describe('troca de plano', () => {
    it('só quem está em avaliação ou ativo troca de plano', () => {
      expect(allowsPlanChange(SubscriptionStatus.TRIALING)).toBe(true);
      expect(allowsPlanChange(SubscriptionStatus.ACTIVE)).toBe(true);
      for (const status of [
        SubscriptionStatus.PAST_DUE,
        SubscriptionStatus.GRACE_PERIOD,
        SubscriptionStatus.SUSPENDED,
        SubscriptionStatus.CANCELED,
        SubscriptionStatus.EXPIRED,
      ]) {
        expect(allowsPlanChange(status)).toBe(false);
      }
    });
  });

  describe('transições', () => {
    it('o fluxo de falha de pagamento é permitido ponta a ponta', () => {
      expect(
        allowsTransition(
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PAST_DUE,
        ),
      ).toBe(true);
      expect(
        allowsTransition(
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.GRACE_PERIOD,
        ),
      ).toBe(true);
      expect(
        allowsTransition(
          SubscriptionStatus.GRACE_PERIOD,
          SubscriptionStatus.SUSPENDED,
        ),
      ).toBe(true);
    });

    it('pagar restaura o acesso a partir de qualquer estado recuperável', () => {
      for (const status of [
        SubscriptionStatus.PAST_DUE,
        SubscriptionStatus.GRACE_PERIOD,
        SubscriptionStatus.SUSPENDED,
      ]) {
        expect(allowsTransition(status, SubscriptionStatus.ACTIVE)).toBe(true);
      }
    });

    it('estados terminais não têm saída', () => {
      expect(isTerminal(SubscriptionStatus.CANCELED)).toBe(true);
      expect(isTerminal(SubscriptionStatus.EXPIRED)).toBe(true);
      expect(allowedTransitions(SubscriptionStatus.CANCELED)).toEqual([]);
    });

    it('o que não está declarado é recusado', () => {
      expect(
        allowsTransition(SubscriptionStatus.EXPIRED, SubscriptionStatus.ACTIVE),
      ).toBe(false);
      expect(
        allowsTransition(
          SubscriptionStatus.SUSPENDED,
          SubscriptionStatus.TRIALING,
        ),
      ).toBe(false);
      // Estado desconhecido não abre porta nenhuma.
      expect(allowedTransitions('INVENTADO')).toEqual([]);
    });
  });
});
