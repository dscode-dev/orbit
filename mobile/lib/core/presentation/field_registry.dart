/// Como o domínio de campo aparece na tela.
///
/// Um lugar só para rótulo, e **nenhuma regra**. A diferença importa: este
/// arquivo traduz `MobileFieldAction.start` para "Iniciar"; ele não decide se
/// a ação existe. Quem decide é o backend, em `allowedActions` e
/// `primaryAction`, e o app consome a lista pronta.
///
/// A tentação recorrente é escrever aqui algo como
/// `if (status == aberta) podeIniciar` — e é exatamente isso que cria a
/// segunda máquina de estados, a que diverge da do servidor na primeira regra
/// nova. Este arquivo não sabe o que é status.
library;

import '../contracts/mobile_field_contracts.dart';
import '../contracts/mobile_signature_contracts.dart';

/// Rótulo e descrição de um conceito — só apresentação.
class FieldLabel {
  const FieldLabel(this.label, {this.description});

  final String label;
  final String? description;
}

/// O que cada tipo de trabalho é, na linguagem de quem executa.
const workItemKindLabels = <MobileWorkItemKind, FieldLabel>{
  MobileWorkItemKind.serviceOperation: FieldLabel('Atendimento'),
  MobileWorkItemKind.pmoc: FieldLabel('Manutenção preventiva'),
  MobileWorkItemKind.rvt: FieldLabel('Visita técnica'),
};

/// Situação do prazo — decidida pelo servidor, no fuso da unidade.
///
/// O app **não** compara datas para chegar a isto. Duas pessoas em fusos
/// diferentes veriam "atrasado" em momentos diferentes se comparassem no
/// aparelho.
const dueStateLabels = <MobileDueState, FieldLabel>{
  MobileDueState.inProgress: FieldLabel('Em andamento'),
  MobileDueState.overdue: FieldLabel('Atrasado'),
  MobileDueState.dueToday: FieldLabel('Hoje'),
  MobileDueState.upcoming: FieldLabel('Programado'),
  MobileDueState.unscheduled: FieldLabel('Sem data'),
};

/// As ações que o servidor pode publicar.
///
/// Cada rótulo diz o que acontece ao tocar — nem mais, nem menos. "Registrar
/// evidência" não promete enviar; "Concluir" não promete gerar documento.
const fieldActionLabels = <MobileFieldAction, FieldLabel>{
  MobileFieldAction.view: FieldLabel('Abrir'),
  MobileFieldAction.openRoute: FieldLabel(
    'Traçar rota',
    description: 'Abre o mapa no endereço do atendimento.',
  ),
  MobileFieldAction.callContact: FieldLabel('Ligar'),
  MobileFieldAction.whatsappContact: FieldLabel('WhatsApp'),
  MobileFieldAction.start: FieldLabel('Iniciar'),
  MobileFieldAction.resume: FieldLabel('Retomar'),
  MobileFieldAction.complete: FieldLabel('Concluir'),
  MobileFieldAction.addEvidence: FieldLabel('Registrar evidência'),
  MobileFieldAction.viewDocument: FieldLabel('Ver documento'),
  MobileFieldAction.downloadDocument: FieldLabel('Baixar documento'),
  MobileFieldAction.executePmoc: FieldLabel('Executar PMOC'),
  MobileFieldAction.executeRvt: FieldLabel('Executar visita'),
  MobileFieldAction.scanEquipment: FieldLabel('Ler etiqueta'),
};

/// Papéis profissionais — os termos oficiais do produto.
///
/// "auxiliares técnico" é o termo do domínio, em minúsculas e sem concordância
/// de número no adjetivo. Não é erro de digitação e não deve ser "corrigido":
/// é como a operação nomeia a função.
const professionalRoleLabels = <MobileProfessionalRole, FieldLabel>{
  MobileProfessionalRole.fieldTechnician: FieldLabel('Técnico em Campo'),
  MobileProfessionalRole.technicalResponsible: FieldLabel(
    'Responsável Técnico',
  ),
};

/// O plural usado ao listar quem acompanha a execução.
const auxiliaryTechniciansLabel = 'auxiliares técnico';

/// Códigos de erro do backend em linguagem de produto.
///
/// A mensagem do servidor é preferida quando existe — ela conhece o caso
/// concreto. Este mapa é a rede de segurança para códigos que chegam sem
/// mensagem útil.
const errorCodeLabels = <String, String>{
  'UNAUTHORIZED': 'Sua sessão expirou. Entre novamente.',
  'FORBIDDEN': 'Você não possui permissão para realizar esta ação.',
  'NOT_FOUND': 'Este registro não está disponível.',
  'CONFLICT': 'Os dados foram alterados. Atualize e tente novamente.',
  'TOO_MANY_REQUESTS': 'Muitas tentativas. Aguarde um instante.',
  'INTERNAL_SERVER_ERROR': 'O servidor não conseguiu responder agora.',
  'NETWORK': 'Sem conexão. Verifique a internet e tente de novo.',
};

/// Traduz sem inventar.
///
/// Código desconhecido devolve `null` para que quem chama decida — mostrar a
/// mensagem do servidor, ou um texto genérico. Devolver o próprio código
/// empurraria para o usuário a tarefa de decifrar o sistema.
String? errorCodeLabel(String? code) =>
    code == null ? null : errorCodeLabels[code];

String workItemKindLabel(MobileWorkItemKind kind) =>
    workItemKindLabels[kind]?.label ?? '—';

String dueStateLabel(MobileDueState state) =>
    dueStateLabels[state]?.label ?? '—';

/// O rótulo de uma ação publicada pelo servidor.
///
/// `null` quando esta versão do app não conhece a ação. Um botão sem nome
/// claro é pior que a ausência dele: convida ao toque sem dizer o que faz.
FieldLabel? fieldActionLabel(MobileFieldAction action) =>
    fieldActionLabels[action];

String professionalRoleLabel(MobileProfessionalRole role) =>
    professionalRoleLabels[role]?.label ?? '—';

/* ------------------------------------------------------------------ */
/* Papel de quem lê a tela                                             */
/* ------------------------------------------------------------------ */

/// Como o usuário participa deste item de trabalho.
///
/// Derivado dos campos que o servidor publica — responsável e auxiliares — e
/// **não** de permissão. Estar escalado diz o que a pessoa faz ali; o que ela
/// pode fazer continua vindo de `allowedActions`.
enum FieldAssignment { responsible, auxiliary, none }

const assignmentLabels = <FieldAssignment, String>{
  FieldAssignment.responsible: 'Técnico em Campo',
  FieldAssignment.auxiliary: 'Auxiliar',
  FieldAssignment.none: '',
};

String assignmentLabel(FieldAssignment assignment) =>
    assignmentLabels[assignment] ?? '';

/* ------------------------------------------------------------------ */
/* Ícones e destino das ações                                          */
/* ------------------------------------------------------------------ */

/// Para onde cada ação leva.
///
/// `internalRoute` é a rota do app; `external` marca as que saem para outro
/// aplicativo (telefone, mensagens, mapas). `deferred` são as que pertencem a
/// PRs seguintes — publicadas pelo backend, ainda sem fluxo aqui.
enum FieldActionDestination { detail, external, deferred }

const fieldActionDestinations = <MobileFieldAction, FieldActionDestination>{
  MobileFieldAction.view: FieldActionDestination.detail,
  MobileFieldAction.openRoute: FieldActionDestination.external,
  MobileFieldAction.callContact: FieldActionDestination.external,
  MobileFieldAction.whatsappContact: FieldActionDestination.external,

  /// Execução de campo é da FL-03; até lá, abre o contexto do item.
  MobileFieldAction.start: FieldActionDestination.deferred,
  MobileFieldAction.resume: FieldActionDestination.deferred,
  MobileFieldAction.complete: FieldActionDestination.deferred,
  MobileFieldAction.addEvidence: FieldActionDestination.deferred,
  MobileFieldAction.viewDocument: FieldActionDestination.deferred,
  MobileFieldAction.downloadDocument: FieldActionDestination.deferred,
  MobileFieldAction.executePmoc: FieldActionDestination.deferred,
  MobileFieldAction.executeRvt: FieldActionDestination.deferred,
  MobileFieldAction.scanEquipment: FieldActionDestination.deferred,
};

FieldActionDestination fieldActionDestination(MobileFieldAction action) =>
    fieldActionDestinations[action] ?? FieldActionDestination.detail;

/// Situação operacional do item, em linguagem de produto.
///
/// O backend publica o status da fonte (atendimento, ciclo, ocorrência) como
/// texto livre. Código sem tradução devolve `null`, e a tela mostra o selo de
/// prazo — que sempre existe — em vez de um código cru.
const operationalStatusLabels = <String, String>{
  'DRAFT': 'Rascunho',
  'SCHEDULED': 'Programado',
  'PENDING': 'Pendente',
  'IN_PROGRESS': 'Em andamento',
  'ON_HOLD': 'Em espera',
  'COMPLETED': 'Concluído',
  'CANCELLED': 'Cancelado',
  'OPEN': 'Aberto',
};

String? operationalStatusLabel(String? status) =>
    status == null ? null : operationalStatusLabels[status];

/* ------------------------------------------------------------------ */
/* Execução de campo (MB-02)                                           */
/* ------------------------------------------------------------------ */

/// Rótulo de cada comando de execução.
///
/// A descrição diz o que acontece ao tocar — nem mais, nem menos. "Concluir
/// atendimento" encerra o atendimento; **não** gera documento, não colhe
/// assinatura e não registra ciência do cliente. Essas são outras coisas, em
/// outras PRs, e prometê-las aqui seria mentir.
const executionActionLabels = <String, FieldLabel>{
  'START': FieldLabel(
    'Iniciar atendimento',
    description: 'Marca o começo do trabalho em campo.',
  ),
  'RESUME': FieldLabel('Retomar atendimento'),
  'COMPLETE': FieldLabel(
    'Concluir atendimento',
    description: 'Encerra o atendimento. O documento é emitido em separado.',
  ),
  'UPDATE_CHECKLIST': FieldLabel('Checklist'),
  'ADD_NOTE': FieldLabel('Registrar observação'),
  'REGISTER_MATERIAL': FieldLabel('Registrar material'),
};

FieldLabel? executionActionLabel(String code) => executionActionLabels[code];

/// Por que o atendimento ainda não pode começar.
///
/// Os códigos vêm de `executionEligibility.blockers`. O app traduz e **não**
/// recalcula: quem decide elegibilidade é o servidor, olhando escala,
/// permissão e estado.
const executionBlockerLabels = <String, String>{
  'OPERATION_NOT_ASSIGNED': 'Você não está escalado para este atendimento.',
  'OPERATION_ALREADY_COMPLETED': 'Este atendimento já foi concluído.',
  'OPERATION_CANCELLED': 'Este atendimento foi cancelado.',
  'PROFESSIONAL_PROFILE_INACTIVE': 'Seu perfil profissional não está ativo.',
  'PROFESSIONAL_ROLE_MISSING': 'Sua conta não tem o papel de Técnico em Campo.',
  'SIGNATURE_MISSING': 'Sua assinatura profissional ainda não foi registrada.',
  'BUSINESS_UNIT_SCOPE_MISSING': 'Este atendimento pertence a outra unidade.',
};

/// A frase de um impedimento. Código desconhecido cai num texto honesto em vez
/// de aparecer cru.
String executionBlockerLabel(String code) =>
    executionBlockerLabels[code] ?? 'Execução indisponível no momento.';

/* ------------------------------------------------------------------ */
/* Assinatura profissional e aceite (MB-03)                            */
/* ------------------------------------------------------------------ */

/// Situação da assinatura do profissional.
///
/// A assinatura pertence ao **usuário** — não ao atendimento, ao cliente nem
/// ao documento. Uma só fica ativa por vez, e quem escolhe qual é o servidor.
const signatureStatusLabels = <String, FieldLabel>{
  'available': FieldLabel(
    'Assinatura cadastrada',
    description: 'Será usada nos documentos que você assinar.',
  ),
  'missing': FieldLabel(
    'Assinatura não cadastrada',
    description: 'Cadastre para poder assinar documentos em campo.',
  ),
  'unavailable': FieldLabel(
    'Assinatura indisponível',
    description: 'Não foi possível consultar sua assinatura agora.',
  ),
};

/// Por que o arquivo de assinatura foi recusado antes de subir.
const signatureFileProblemLabels = <String, String>{
  'empty': 'O arquivo está vazio.',
  'tooLarge': 'A imagem passa de 2 MB. Escolha uma menor.',
  'unsupportedType':
      'Formato não aceito. Use PNG, JPEG ou WEBP — e confira se o arquivo '
      'é mesmo do formato que a extensão diz.',
};

/// O papel em que a assinatura é aplicada, quando o servidor o publica.
///
/// A mesma assinatura serve aos dois papéis: o contexto é do documento, não do
/// arquivo. Guardar uma imagem por papel duplicaria o mesmo traço.
String signedAsLabel(MobileProfessionalRole role) =>
    'Assinado como ${professionalRoleLabel(role)}';

/// Aceite do cliente — **não** é assinatura profissional nem documento final.
///
/// O termo é "aceite" porque a assinatura gráfica é opcional por política:
/// chamar de "assinatura do cliente" prometeria algo que o contrato não exige.
const acknowledgementLabels = <String, FieldLabel>{
  'unavailable': FieldLabel(
    'Aceite indisponível',
    description: 'Este atendimento não aceita ciência do cliente agora.',
  ),
  'pending': FieldLabel(
    'Sem aceite registrado',
    description: 'O cliente ainda não deu ciência deste atendimento.',
  ),
  'accepted': FieldLabel('Ciência registrada'),
};

/// O impedimento de assinatura publicado na preparação de execução.
const signatureBlockedReasonLabels = <String, String>{
  'FIELD_TECHNICIAN_SIGNATURE_MISSING':
      'Sua assinatura profissional ainda não foi cadastrada.',
};

String? signatureBlockedReasonLabel(String? code) =>
    code == null ? null : signatureBlockedReasonLabels[code];

/// O que cada intenção pendente é, em português.
///
/// A tela de sincronização é lida por quem fez o trabalho, não por quem
/// escreveu o protocolo: `OPERATION_ADD_MATERIAL` não diz nada a essa pessoa.
const pendingCommandLabels = <String, String>{
  'OPERATION_START': 'Início do atendimento',
  'OPERATION_CHECKLIST_UPDATE': 'Checklist atualizado',
  'OPERATION_ADD_NOTE': 'Observação registrada',
  'OPERATION_ADD_MATERIAL': 'Material registrado',
  'OPERATION_COMPLETE': 'Conclusão do atendimento',
  'CUSTOMER_ACKNOWLEDGEMENT': 'Ciência do cliente',
};

String pendingCommandLabel(String commandType) =>
    pendingCommandLabels[commandType] ?? 'Ação registrada';

/// Por que o servidor recusou reconciliar.
///
/// Cada frase diz o que aconteceu **e** o que fazer. "VERSION_CONFLICT" não é
/// nenhuma das duas coisas.
const syncConflictLabels = <String, String>{
  'VERSION_CONFLICT':
      'O atendimento mudou enquanto você estava sem conexão. Atualize e '
      'registre de novo.',
  'STATE_CONFLICT':
      'O atendimento já não está na situação que esta ação exige.',
  'AUTHORIZATION_CHANGED':
      'Você não tem mais permissão para esta ação neste atendimento.',
  'ASSIGNMENT_CHANGED': 'Este atendimento não está mais atribuído a você.',
  'RESOURCE_REMOVED': 'Este atendimento não está mais disponível.',
  'CHECKLIST_CHANGED':
      'O checklist mudou depois que você respondeu. Confira antes de '
      'registrar de novo.',
  'MATERIAL_STOCK_CONFLICT': 'O estoque não comporta a quantidade registrada.',
  'ACKNOWLEDGEMENT_STALE':
      'O atendimento mudou depois do aceite. Colete a ciência novamente.',
  'IDEMPOTENCY_MISMATCH':
      'Não foi possível confirmar esta ação. Registre novamente.',
};

/// Recusas terminais que não são conflito.
const syncRejectionLabels = <String, String>{
  'OFFLINE_REPLAY_WINDOW_EXPIRED':
      'Esta ação ficou tempo demais sem sincronizar e não pode mais ser '
      'enviada.',
  'AUTHORIZATION_CHANGED':
      'Você não tem mais permissão para esta ação neste atendimento.',
  'RESOURCE_REMOVED': 'Este atendimento não está mais disponível.',
  'INVALID_COMMAND': 'O servidor não aceitou esta ação.',
  'DEPENDENCY_BLOCKED': 'Uma ação anterior deste atendimento não foi aplicada.',
};

/// A frase de um comando parado — conflito ou recusa, com fallback neutro.
///
/// Um código novo no servidor não pode virar tela em branco nem código cru: a
/// pessoa precisa saber que aquilo não foi, mesmo sem o motivo exato.
String syncBlockedLabel({String? conflictCode, String? errorCode}) =>
    syncConflictLabels[conflictCode] ??
    syncRejectionLabels[errorCode] ??
    'Não foi possível sincronizar esta ação.';

/// Estados da sincronização, para o indicador do shell.
const syncPhaseLabels = <String, String>{
  'idle': 'Tudo sincronizado',
  'syncing': 'Sincronizando…',
  'offline': 'Sem conexão',
  'error': 'Falha ao sincronizar',
};
