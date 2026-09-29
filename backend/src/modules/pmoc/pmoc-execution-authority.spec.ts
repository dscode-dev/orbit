/**
 * Quem pode concluir a manutenção de um equipamento.
 *
 * ## A regra
 *
 * O técnico escalado para aquela execução, ou o dono da organização — que atende
 * quando o escalado faltou.
 *
 * ## Por que ela não é `pmoc.manage`
 *
 * Essa permissão diz que a pessoa **administra** o módulo: cria plano, cobre
 * equipamento, encerra contrato. Executar a manutenção de um aparelho é outra
 * coisa. Sem a distinção, qualquer pessoa com acesso ao módulo assinava a
 * manutenção de uma máquina que nunca viu — e o documento sai com o nome dela,
 * como prova de conformidade perante a Lei 13.589/2018.
 *
 * ## O que este teste garante além da recusa
 *
 * Que a restrição viaja **dentro** do claim, junto do status. Conferir antes e
 * gravar depois deixaria a janela em que a atribuição muda entre a leitura e a
 * escrita — e o que se está gravando é quem assina um documento legal.
 *
 * E que cada recusa diz qual recusa é: "não está em andamento" para quem não é o
 * técnico mandaria a pessoa procurar o estado errado.
 */
import { PmocService, type PmocActor } from './pmoc.service';
import {
  ConflictException,
  EntityNotFoundException,
  ForbiddenException,
} from '../../exceptions';

const TECNICO = 'user-tecnico';
const OUTRO = 'user-outro';
const DONO = 'user-dono';

const ator = (actorId: string, isOrganizationOwner = false): PmocActor => ({
  organizationId: 'org-1',
  actorId,
  permissions: ['pmoc.manage', 'operations.manage'],
  businessUnitIds: ['bu-1'],
  isOrganizationOwner,
});

function servico(resposta: unknown) {
  const repository = {
    completeEquipmentExecution: jest.fn().mockResolvedValue(resposta),
  };
  const mapper = { equipmentExecution: jest.fn((row: unknown) => row) };
  const service = new PmocService(
    repository as never,
    mapper as never,
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );
  return { service, repository };
}

const sucesso = {
  refused: null,
  allResolved: false,
  nextDueOn: null,
  execution: { id: 'exec-1' },
};

const concluir = (service: PmocService, quem: PmocActor) =>
  service.completeEquipmentExecution('plan-1', 'cycle-1', 'exec-1', quem, {});

describe('autoridade para concluir a execução de um equipamento', () => {
  it('restringe ao próprio ator quando não é o dono', async () => {
    const { service, repository } = servico(sucesso);

    await concluir(service, ator(TECNICO));

    /* A restrição vai para o repositório, que a coloca no `where` do claim. */
    expect(repository.completeEquipmentExecution).toHaveBeenCalledWith(
      expect.objectContaining({ restrictToTechnicianId: TECNICO }),
    );
  });

  it('o dono conclui sem restrição de atribuição', async () => {
    const { service, repository } = servico(sucesso);

    await concluir(service, ator(DONO, true));

    /* `null` é a ausência de restrição — é assim que o dono atende a execução de
       um técnico que faltou, sem precisar de reatribuição. */
    expect(repository.completeEquipmentExecution).toHaveBeenCalledWith(
      expect.objectContaining({ restrictToTechnicianId: null }),
    );
  });

  it('recusa quem não é o técnico escalado, dizendo que é isso', async () => {
    const { service } = servico({ refused: 'NOT_ASSIGNED' });

    await expect(concluir(service, ator(OUTRO))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    /* A mensagem nomeia a regra: quem lê descobre o que fazer — pedir a
       atribuição — em vez de procurar um estado que está correto. */
    await expect(concluir(service, ator(OUTRO))).rejects.toThrow(
      /técnico escalado/i,
    );
  });

  it('execução já concluída continua sendo conflito, não permissão', async () => {
    const { service } = servico({ refused: 'NOT_IN_PROGRESS' });

    /* Dois motivos distintos, dois erros distintos: juntá-los faria o técnico
       certo receber "você não tem permissão" ao clicar duas vezes. */
    await expect(concluir(service, ator(TECNICO))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('execução inexistente é não encontrada', async () => {
    const { service } = servico({ refused: 'NOT_FOUND' });

    await expect(concluir(service, ator(TECNICO))).rejects.toBeInstanceOf(
      EntityNotFoundException,
    );
  });

  it('não grava manutenção no futuro', async () => {
    const { service, repository } = servico(sucesso);
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await expect(
      service.completeEquipmentExecution(
        'plan-1',
        'cycle-1',
        'exec-1',
        ator(TECNICO),
        { performedAt: amanha },
      ),
    ).rejects.toThrow(/future/i);
    expect(repository.completeEquipmentExecution).not.toHaveBeenCalled();
  });
});
