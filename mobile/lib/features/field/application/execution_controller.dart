/// Estado da execução de um atendimento.
///
/// ## O que este arquivo não faz
///
/// Não decide se pode iniciar, se pode concluir, nem se o checklist está
/// completo o bastante. Nada disso é calculado aqui — `allowedActions` chega
/// pronto e é a única fonte do que a tela oferece.
///
/// ## Concorrência e repetição
///
/// Dois problemas diferentes, duas defesas diferentes:
///
/// - **Sobrescrever o que outro mudou** → `expectedVersion`. Todo comando
///   carrega a versão que o usuário viu ao decidir; se o servidor mudou desde
///   então, ele recusa com 409 e a tela relê em vez de insistir.
/// - **Fazer duas vezes o que se pediu uma** → `commandId`. Uma intenção do
///   usuário tem uma chave, e reenviá-la é inofensivo: o servidor devolve
///   `idempotentReplay: true` em vez de um segundo efeito.
library;

import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/contracts/field_operation_contracts.dart';
import '../../../core/errors/orbit_exception.dart';
import '../data/field_operation_repository.dart';

final fieldOperationRepositoryProvider = Provider<FieldOperationRepository>(
  (ref) => FieldOperationRepository(client: ref.watch(apiClientProvider)),
);

/// Em que ponto a tela está.
///
/// Um estado nomeado em vez de meia dúzia de booleanos: `carregando &&
/// !erro && pendente` é o tipo de combinação que passa a existir sem ninguém
/// decidir que deveria.
enum ExecutionPhase { loading, ready, mutationPending, conflict, error }

class ExecutionState {
  const ExecutionState({
    required this.phase,
    this.preparation,
    this.error,
    this.pendingAction,
    this.lastReplay = false,
  });

  final ExecutionPhase phase;
  final FieldOperationExecutionPreparationContract? preparation;
  final Object? error;

  /// Qual comando está em voo — para desabilitar exatamente o botão certo.
  final FieldOperationAllowedAction? pendingAction;

  /// O último comando foi reexecução da mesma intenção, segundo o servidor.
  final bool lastReplay;

  bool get isBusy => phase == ExecutionPhase.mutationPending;

  /// O que o servidor permite agora. Sem preparação carregada, nada.
  List<FieldOperationAllowedAction> get allowedActions =>
      preparation?.allowedActions ?? const [];

  bool allows(FieldOperationAllowedAction action) =>
      allowedActions.contains(action);

  ExecutionState copyWith({
    ExecutionPhase? phase,
    FieldOperationExecutionPreparationContract? preparation,
    Object? error,
    FieldOperationAllowedAction? pendingAction,
    bool? lastReplay,
    bool clearError = false,
    bool clearPending = false,
  }) => ExecutionState(
    phase: phase ?? this.phase,
    preparation: preparation ?? this.preparation,
    error: clearError ? null : (error ?? this.error),
    pendingAction: clearPending ? null : (pendingAction ?? this.pendingAction),
    lastReplay: lastReplay ?? this.lastReplay,
  );
}

/// Gera o identificador de uma intenção.
///
/// UUIDv7 como o backend exige (`IsUUIDv7`) — tempo nos 48 bits altos,
/// aleatoriedade no resto. Carimbo de tempo sozinho não serviria: dois toques
/// no mesmo milissegundo colidiriam, e é exatamente o caso que a chave existe
/// para separar.
String newCommandId([Random? random]) {
  final rng = random ?? Random.secure();
  final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
  final now = DateTime.now().millisecondsSinceEpoch;
  for (var i = 0; i < 6; i += 1) {
    bytes[i] = (now >> (8 * (5 - i))) & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  String hex(int start, int end) => bytes
      .sublist(start, end)
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();

  return '${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}';
}

class ExecutionController extends StateNotifier<ExecutionState> {
  ExecutionController({
    required FieldOperationRepository repository,
    required this.operationId,
  }) : _repository = repository,
       super(const ExecutionState(phase: ExecutionPhase.loading)) {
    load();
  }

  final FieldOperationRepository _repository;
  final String operationId;

  /// A intenção em curso, guardada **inteira**.
  ///
  /// Repetir depois de um timeout precisa reenviar o mesmo envelope — chave
  /// **e** versão. O backend compara o payload associado à chave e recusa com
  /// "Idempotency key reused with a different payload" se só a chave coincidir.
  /// Faz sentido: é a mesma intenção, tomada no mesmo momento, sobre o mesmo
  /// estado.
  ({
    FieldOperationAllowedAction action,
    FieldOperationCommandContract envelope,
  })?
  _intent;

  /// Relê o estado autoritativo. É o que fecha todo comando.
  Future<void> load() async {
    try {
      final preparation = await _repository.preparation(operationId);
      state = ExecutionState(
        phase: ExecutionPhase.ready,
        preparation: preparation,
        lastReplay: state.lastReplay,
      );
    } on Object catch (error) {
      state = state.copyWith(phase: ExecutionPhase.error, error: error);
    }
  }

  /// O envelope de um comando, com a versão que o usuário viu.
  ///
  /// Mesma intenção repetida reaproveita o envelope **inteiro**; intenção nova
  /// ganha outro.
  FieldOperationCommandContract _envelope(FieldOperationAllowedAction action) {
    final current = _intent;
    if (current != null && current.action == action) return current.envelope;

    final commandId = newCommandId();
    final envelope = FieldOperationCommandContract(
      commandId: commandId,
      idempotencyKey: commandId,
      expectedVersion: state.preparation?.version ?? '',
      occurredAt: DateTime.now().toUtc(),
    );
    _intent = (action: action, envelope: envelope);
    return envelope;
  }

  /// Executa um comando e relê o estado.
  ///
  /// Enquanto está em voo, `phase` é `mutationPending` e a tela desabilita a
  /// ação — é o que impede o toque duplo de virar dois comandos.
  Future<void> _run(
    FieldOperationAllowedAction action,
    Future<void> Function(FieldOperationCommandContract command) send,
  ) async {
    if (state.isBusy) return;
    if (!state.allows(action)) return;

    state = state.copyWith(
      phase: ExecutionPhase.mutationPending,
      pendingAction: action,
      clearError: true,
    );

    try {
      await send(_envelope(action));

      /// Intenção cumprida: a próxima ganha chave nova.
      _intent = null;
      await load();
      state = state.copyWith(clearPending: true);
    } on OrbitException catch (error) {
      /// 409 é estado mudado por baixo — reler é a saída, nunca repetir o
      /// comando sozinho.
      state = state.copyWith(
        phase: error.isConflict
            ? ExecutionPhase.conflict
            : ExecutionPhase.error,
        error: error,
        clearPending: true,
      );
    } on Object catch (error) {
      state = state.copyWith(
        phase: ExecutionPhase.error,
        error: error,
        clearPending: true,
      );
    }
  }

  Future<void> start() =>
      _run(FieldOperationAllowedAction.start, (command) async {
        final result = await _repository.start(operationId, command);
        state = state.copyWith(lastReplay: result.idempotentReplay);
      });

  Future<void> complete() =>
      _run(FieldOperationAllowedAction.complete, (command) async {
        final result = await _repository.complete(operationId, command);
        state = state.copyWith(lastReplay: result.idempotentReplay);
      });

  Future<void> addNote(String note) =>
      _run(FieldOperationAllowedAction.addNote, (command) async {
        await _repository.addNote(operationId, command, note: note);
      });

  /// Responde um item do checklist.
  ///
  /// O contrato substitui o mapa inteiro, então parte-se do que o servidor
  /// devolveu e altera-se **um** item. Montar o mapa do zero apagaria
  /// respostas que a tela não está mostrando.
  Future<void> answerChecklistItem({
    required String checklistId,
    required String itemId,
    required Object? answer,
  }) => _run(FieldOperationAllowedAction.updateChecklist, (command) async {
    final checklist = state.preparation?.checklist.firstWhere(
      (entry) => entry.id == checklistId,
    );
    if (checklist == null) return;

    await _repository.updateChecklist(
      operationId,
      checklistId,
      command,
      answers: {...checklist.answers, itemId: answer},
    );
  });

  /// Registra material e devolve o desfecho a quem chamou.
  ///
  /// O resultado sai explícito — resultado **ou** erro — porque a folha de
  /// material precisa mostrar a recusa do servidor no próprio formulário, sem
  /// espiar o estado interno do controlador.
  Future<({FieldOperationMaterialResultContract? result, Object? error})>
  registerMaterial({
    required String catalogItemId,
    required num quantity,
    String? reason,
  }) async {
    FieldOperationMaterialResultContract? result;
    await _run(FieldOperationAllowedAction.registerMaterial, (command) async {
      result = await _repository.registerMaterial(
        operationId,
        command,
        catalogItemId: catalogItemId,
        quantity: quantity,
        reason: reason,
      );
    });
    return (result: result, error: result == null ? state.error : null);
  }

  /// Depois de um conflito, o usuário pede para atualizar.
  Future<void> refreshAfterConflict() async {
    _intent = null;
    state = state.copyWith(phase: ExecutionPhase.loading, clearError: true);
    await load();
  }
}

final executionControllerProvider = StateNotifierProvider.autoDispose
    .family<ExecutionController, ExecutionState, String>(
      (ref, operationId) => ExecutionController(
        repository: ref.watch(fieldOperationRepositoryProvider),
        operationId: operationId,
      ),
    );

/// A linha do tempo do atendimento — fatos persistidos, na ordem publicada.
final executionTimelineProvider = FutureProvider.autoDispose
    .family<FieldOperationTimelinePageContract, String>(
      (ref, operationId) =>
          ref.watch(fieldOperationRepositoryProvider).timeline(operationId),
    );
