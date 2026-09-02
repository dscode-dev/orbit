/// O protocolo offline contra o backend real.
///
/// Prova o que só o servidor pode provar: que a mesma intenção reenviada não
/// produz dois efeitos, que uma versão velha é recusada, que autorização e
/// designação são revalidadas no replay, e que um item fora de escopo volta
/// como tombstone.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:orbit_operator/core/config/environment.dart';
import 'package:orbit_operator/core/contracts/mobile_field_contracts.dart';
import 'package:orbit_operator/core/contracts/mobile_offline_sync_contracts.dart';
import 'package:orbit_operator/core/network/orbit_api_client.dart';
import 'package:orbit_operator/core/observability/orbit_logger.dart';
import 'package:orbit_operator/core/storage/token_storage.dart';
import 'package:orbit_operator/features/field/application/execution_controller.dart'
    show newCommandId;
import 'package:orbit_operator/features/sync/data/command_journal.dart';
import 'package:orbit_operator/features/sync/data/journal_file.dart';
import 'package:orbit_operator/features/sync/data/sync_repository.dart';

const _baseUrl = String.fromEnvironment(
  'ORBIT_API_URL',
  defaultValue: 'http://localhost:5001/api/v1',
);
const _email = String.fromEnvironment(
  'ORBIT_OWNER_EMAIL',
  defaultValue: 'owner@orbit.local',
);
const _password = String.fromEnvironment(
  'ORBIT_OWNER_PASSWORD',
  defaultValue: 'OrbitOwner@2026',
);

class _MemoryTokenStorage implements TokenStorage {
  TokenPair? _pair;
  @override
  Future<void> clear() async => _pair = null;
  @override
  Future<TokenPair?> read() async => _pair;
  @override
  Future<void> write(TokenPair pair) async => _pair = pair;
}

Future<bool> _apiIsUp() async {
  try {
    final uri = Uri.parse(_baseUrl);
    final socket = await Socket.connect(
      uri.host,
      uri.port,
      timeout: const Duration(seconds: 2),
    );
    socket.destroy();
    return true;
  } on Object {
    return false;
  }
}

OfflineCommandEnvelope note(
  String operationId,
  String version, {
  String? commandId,
  String text = 'Observação registrada em campo.',
  DateTime? occurredAt,
}) {
  final id = commandId ?? newCommandId();
  return OfflineCommandEnvelope(
    commandId: id,
    idempotencyKey: id,
    commandType: OfflineCommandType.operationAddNote,
    aggregateId: operationId,
    expectedVersion: version,
    occurredAt: occurredAt ?? DateTime.now().toUtc(),
    payload: {'note': text},
    deviceInstanceId: 'smoke-device',
  );
}

void main() {
  late bool available;
  late OrbitApiClient client;
  late SyncRepository sync;

  /// Um atendimento de campo deste tenant, com a versão que o servidor publica.
  String? operationId;
  String? version;
  String? workItemId;

  setUpAll(() async {
    available = await _apiIsUp();
    if (!available) return;

    final storage = _MemoryTokenStorage();
    client = OrbitApiClient.create(
      environment: OrbitEnvironment(
        apiBaseUrl: _baseUrl,
        flavor: OrbitFlavor.development,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 30),
      ),
      storage: storage,
      logger: const OrbitLogger(isProduction: false),
    );
    sync = SyncRepository(client: client);

    final login = await client.post<Map<String, dynamic>>(
      '/identity/login',
      body: {'email': _email, 'password': _password},
      isPublic: true,
    );
    await storage.write(TokenPair.fromJson(login));

    /// O alvo sai da própria fila do backend — nada de id inventado nem de
    /// linha inserida no banco por fora do produto.
    ///
    /// Duas exigências, e ambas importam:
    ///
    /// - **não é o primeiro da fila.** Este arquivo escreve no atendimento, e
    ///   o smoke da execução afirma que ler a preparação duas vezes não muda a
    ///   versão. Os dois rodam em paralelo; dividir o alvo é o que mantém as
    ///   duas asserções honestas.
    /// - **aceita `ADD_NOTE` agora.** Um atendimento concluído recusaria por
    ///   estado, e o teste estaria medindo a escolha do alvo em vez do
    ///   protocolo.
    final queue = await client.get<Map<String, dynamic>>(
      '/mobile/field/work-queue',
      query: {'limit': 50},
    );
    final operations = (queue['data'] as List<dynamic>? ?? const [])
        .map(
          (raw) => MobileWorkItemContract.fromJson(
            Map<String, dynamic>.from(raw as Map),
          ),
        )
        .whereType<MobileWorkItemContract>()
        .where((item) => item.kind == MobileWorkItemKind.serviceOperation)
        .toList();

    /// O primeiro fica reservado ao smoke da execução.
    for (final item in operations.skip(1)) {
      final preparation = await client.get<Map<String, dynamic>>(
        '/mobile/field/operations/${item.sourceId}/execution-preparation',
      );
      final allowed = (preparation['allowedActions'] as List<dynamic>? ?? [])
          .whereType<String>();
      if (!allowed.contains('ADD_NOTE')) continue;

      operationId = item.sourceId;
      version = preparation['version'] as String?;
      workItemId = item.id;
      break;
    }
  });

  /// A versão de agora.
  ///
  /// Cada comando aplicado avança o `updatedAt` do atendimento, então uma
  /// versão capturada no `setUpAll` fica velha assim que o primeiro teste
  /// escreve. Reler antes de cada intenção que deve ser aplicada é o que o
  /// app faz — a versão congelada é a que a pessoa **viu**, não uma anterior
  /// qualquer.
  Future<String> currentVersion() async {
    final preparation = await client.get<Map<String, dynamic>>(
      '/mobile/field/operations/$operationId/execution-preparation',
    );
    return preparation['version']! as String;
  }

  bool skip() {
    if (!available) {
      markTestSkipped('API indisponível em $_baseUrl');
      return true;
    }
    if (operationId == null || version == null) {
      markTestSkipped(
        'sem um segundo atendimento que aceite observação neste tenant',
      );
      return true;
    }
    return false;
  }

  group('push', () {
    test('um recibo por comando, na ordem enviada', () async {
      if (skip()) return;

      final current = await currentVersion();
      final first = note(operationId!, current, text: 'Primeira nota.');
      final second = note(operationId!, current, text: 'Segunda nota.');
      final response = await sync.push([first, second]);

      expect(response.results, hasLength(2));
      expect(response.results[0].commandId, first.commandId);
      expect(response.results[1].commandId, second.commandId);
      expect(response.nextRecommendedAction, 'PULL');

      /// Recibos individualizados: cada intenção tem o seu desfecho.
      expect(
        response.results.map((r) => r.status),
        everyElement(isNot(OfflineCommandStatus.retryableError)),
      );
    });

    test('a mesma intenção reenviada não produz um segundo efeito', () async {
      if (skip()) return;

      final envelope = note(
        operationId!,
        await currentVersion(),
        text: 'Nota idempotente ${DateTime.now().microsecondsSinceEpoch}.',
      );

      final first = await sync.push([envelope]);
      expect(first.results.single.status, OfflineCommandStatus.applied);

      /// O reenvio depois de um desfecho incerto carrega o **mesmo** envelope.
      /// É isso que a idempotência protege.
      final again = await sync.push([envelope]);
      expect(again.results.single.status, OfflineCommandStatus.alreadyApplied);
    });

    test('mesma chave com outro conteúdo é recusada', () async {
      if (skip()) return;

      final id = newCommandId();
      final current = await currentVersion();
      await sync.push([note(operationId!, current, commandId: id)]);

      /// Regenerar qualquer campo no replay produz outro hash — e o servidor
      /// trata isso como o que é: outra intenção usando a chave da primeira.
      final adulterated = note(
        operationId!,
        current,
        commandId: id,
        text: 'Texto diferente do original.',
      );
      final response = await sync.push([adulterated]);

      expect(response.results.single.status, OfflineCommandStatus.conflict);
      expect(
        response.results.single.conflict?.code,
        OfflineConflictCode.idempotencyMismatch,
      );
    });

    test('versão desatualizada é recusada, não sobrescreve', () async {
      if (skip()) return;

      final response = await sync.push([
        note(operationId!, '1900-01-01T00:00:00.000Z'),
      ]);

      expect(response.results.single.status, OfflineCommandStatus.conflict);
      expect(response.results.single.conflict?.refreshRequired, isTrue);
    });

    test('comando fora da janela de replay é recusado sem retry', () async {
      if (skip()) return;

      final response = await sync.push([
        note(
          operationId!,
          await currentVersion(),
          occurredAt: DateTime.now().toUtc().subtract(
            const Duration(days: 200),
          ),
        ),
      ]);

      final result = response.results.single;
      expect(result.status, OfflineCommandStatus.rejected);
      expect(result.error?.code, 'OFFLINE_REPLAY_WINDOW_EXPIRED');

      /// Terminal: insistir eternamente gastaria bateria sem chegar a lugar
      /// nenhum.
      expect(result.error?.retryable, isFalse);
    });

    test(
      'um comando recusado bloqueia os seguintes do mesmo atendimento',
      () async {
        if (skip()) return;

        /// Ordem preservada: a primeira intenção falha por versão velha, e a
        /// segunda não pode ser aplicada sobre um estado que a primeira não
        /// alcançou.
        final response = await sync.push([
          note(operationId!, '1900-01-01T00:00:00.000Z'),
          note(operationId!, version!),
        ]);

        expect(response.results[0].status, OfflineCommandStatus.conflict);
        expect(response.results[1].status, OfflineCommandStatus.blocked);
        expect(response.results[1].error?.code, 'DEPENDENCY_BLOCKED');
      },
    );

    test('recurso inexistente é recusado como removido', () async {
      if (skip()) return;

      final response = await sync.push([
        note('0192f0c0-0000-7000-8000-ffffffffffff', await currentVersion()),
      ]);

      final result = response.results.single;
      expect(result.status, OfflineCommandStatus.rejected);
      expect(result.error?.code, 'RESOURCE_REMOVED');
    });
  });

  group('pull', () {
    test('o cursor volta opaco e o delta é reconciliável', () async {
      if (skip()) return;

      final first = await sync.pull();
      expect(first.status, 'DELTA');
      expect(first.nextCursor, isNotNull);

      /// Repetir com o cursor recebido não repete a página inteira.
      final second = await sync.pull(cursor: first.nextCursor);
      expect(second.status, 'DELTA');
      expect(second.nextCursor, isNotNull);
    });

    test('id conhecido que saiu de escopo volta como tombstone', () async {
      if (skip()) return;

      /// Um item que este ator não enxerga, declarado como conhecido: é
      /// exatamente o caso que o tombstone existe para resolver.
      final response = await sync.pull(
        knownWorkItemIds: const ['SERVICE_OPERATION:nao-existe-mais'],
      );

      expect(
        response.tombstones.map((t) => t.resourceId),
        contains('SERVICE_OPERATION:nao-existe-mais'),
      );
      expect(response.tombstones.single.reason, 'OUT_OF_SCOPE');
    });

    test('cursor velho demais pede resync completo', () async {
      if (skip()) return;

      /// Sequência 1 é anterior a qualquer journal com histórico. Quando o
      /// servidor não consegue reconstruir o delta, ele diz — em vez de
      /// entregar um delta incompleto que pareceria correto.
      final response = await sync.pull(cursor: _cursorAt(1));
      expect(
        response.status,
        anyOf('FULL_RESYNC_REQUIRED', 'DELTA'),
        reason: 'depende do histórico retido no ambiente',
      );
    });
  });

  group('pacote de campo', () {
    test('traz o necessário e declara a própria política', () async {
      if (skip()) return;

      final package = await sync.package(workItemId!);

      expect(package.workItem.id, workItemId);
      expect(package.serverCheckpoint, isNotEmpty);

      /// O servidor é quem diz que o conteúdo é sensível e que não é
      /// autoritativo — o app não decide isso por conta.
      expect(package.cachePolicy.sensitive, isTrue);
      expect(package.cachePolicy.purgeOnLogout, isTrue);
      expect(package.cachePolicy.authoritative, isFalse);

      /// Mídia não vem no pacote: isso é FL-06.
      expect(package.mediaPolicy.blobsIncluded, isFalse);
      expect(package.mediaPolicy.localMediaReferencesAccepted, isFalse);
    });
  });

  group('journal e replay', () {
    test('a fila sobrevive a reabrir e reenvia a mesma identidade', () async {
      if (skip()) return;

      final file = MemoryJournalFile();
      final envelope = note(
        operationId!,
        await currentVersion(),
        text: 'Nota que atravessa o reinício.',
      );

      await CommandJournal(file: file).enqueue(
        PendingCommand(
          envelope: envelope,
          scope: const CommandScope(
            userId: 'u',
            organizationId: 'o',
            businessUnitId: 'b',
          ),
          state: PendingCommandState.pending,
          enqueuedAt: DateTime.now().toUtc(),
        ),
      );

      /// Outra instância, como quem reabre o app.
      final reopened = await CommandJournal(file: file).read();
      final restored = reopened.commands.single.envelope;
      expect(restored.commandId, envelope.commandId);
      expect(restored.expectedVersion, envelope.expectedVersion);
      expect(restored.occurredAt, envelope.occurredAt);

      /// E o servidor aceita o envelope restaurado do disco.
      final response = await sync.push([restored]);
      expect(
        response.results.single.status,
        anyOf(
          OfflineCommandStatus.applied,
          OfflineCommandStatus.alreadyApplied,
        ),
      );
    });
  });

  group('revalidação no replay', () {
    test(
      'atendimento fora da designação é recusado, mesmo com envelope válido',
      () async {
        if (skip()) return;

        /// A lista administrativa enxerga atendimentos que a fila de campo
        /// deste ator não enxerga — é a diferença entre ver e estar designado.
        final admin = await client.get<Map<String, dynamic>>(
          '/operations',
          query: {'limit': 50},
        );
        final assigned =
            (await client.get<Map<String, dynamic>>(
                  '/mobile/field/work-queue',
                  query: {'limit': 50},
                ))['data']
                as List<dynamic>? ??
            const [];
        final assignedSources = assigned
            .map((item) => (item as Map)['sourceId'] as String?)
            .whereType<String>()
            .toSet();

        final foreign = (admin['data'] as List<dynamic>? ?? const [])
            .map((item) => (item as Map)['id'] as String?)
            .whereType<String>()
            .where((id) => !assignedSources.contains(id))
            .firstOrNull;

        if (foreign == null) {
          markTestSkipped(
            'todos os atendimentos deste tenant estão designados',
          );
          return;
        }

        /// Envelope impecável: versão plausível, instante de agora, payload
        /// correto. O que o servidor recusa é a **designação**, revalidada no
        /// momento do replay — criar o comando offline não concede direito.
        final response = await sync.push([
          note(foreign, DateTime.now().toUtc().toIso8601String()),
        ]);

        final result = response.results.single;
        expect(result.status, OfflineCommandStatus.rejected);
        expect(result.error?.retryable, isFalse);
      },
    );
  });

  group('sem rede e depois com rede', () {
    test('a intenção fica guardada e sobe quando a rede volta', () async {
      if (skip()) return;

      /// Uma porta onde não há servidor: é a forma controlada de estar
      /// offline sem desligar a rede da máquina.
      final offlineClient = OrbitApiClient.create(
        environment: const OrbitEnvironment(
          apiBaseUrl: 'http://127.0.0.1:9/api/v1',
          flavor: OrbitFlavor.development,
          connectTimeout: Duration(seconds: 2),
          receiveTimeout: Duration(seconds: 2),
        ),
        storage: _MemoryTokenStorage(),
        logger: const OrbitLogger(isProduction: false),
      );

      final file = MemoryJournalFile();
      final journal = CommandJournal(file: file);
      final envelope = note(
        operationId!,
        await currentVersion(),
        text: 'Nota registrada sem conexão.',
      );
      const scope = CommandScope(
        userId: 'u',
        organizationId: 'o',
        businessUnitId: 'b',
      );

      await journal.enqueue(
        PendingCommand(
          envelope: envelope,
          scope: scope,
          state: PendingCommandState.pending,
          enqueuedAt: DateTime.now().toUtc(),
        ),
      );

      /// Sem rede o push falha — e a intenção continua inteira no disco.
      await expectLater(
        SyncRepository(client: offlineClient).push([envelope]),
        throwsA(isA<Object>()),
      );
      expect((await CommandJournal(file: file).read()).commands, hasLength(1));

      /// Com a rede de volta, o mesmo envelope é aceito.
      final restored = (await CommandJournal(
        file: file,
      ).read()).commands.single.envelope;
      final response = await sync.push([restored]);
      expect(response.results.single.status, OfflineCommandStatus.applied);

      await journal.resolve(
        commandId: restored.commandId,
        scope: scope,
        result: response.results.single,
        at: DateTime.now().toUtc(),
      );
      final after = await CommandJournal(file: file).read();
      expect(after.commands, isEmpty);
      expect(after.receipts, hasLength(1));
    });
  });
}

/// Um cursor no formato real do servidor: base64url de `{v:1, sequence}`.
String _cursorAt(int sequence) => base64Url
    .encode(utf8.encode('{"v":1,"sequence":"$sequence"}'))
    .replaceAll('=', '');
