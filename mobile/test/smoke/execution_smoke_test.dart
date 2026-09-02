/// Ciclo de execução contra o backend real.
///
/// Prova o que só o servidor pode provar: que abrir a preparação não muda
/// nada, que os comandos semânticos funcionam, que a versão antiga é recusada
/// com 409, e que repetir a mesma intenção não produz um segundo efeito.
///
/// O cenário é montado **pelas APIs do produto** — nenhuma escrita direta no
/// banco. Sem API no ar, cada teste é pulado com motivo.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:orbit_operator/core/config/environment.dart';
import 'package:orbit_operator/core/contracts/field_operation_contracts.dart';
import 'package:orbit_operator/core/contracts/mobile_field_contracts.dart';
import 'package:orbit_operator/core/errors/orbit_exception.dart';
import 'package:orbit_operator/core/network/orbit_api_client.dart';
import 'package:orbit_operator/core/observability/orbit_logger.dart';
import 'package:orbit_operator/core/storage/token_storage.dart';
import 'package:orbit_operator/features/field/application/execution_controller.dart';
import 'package:orbit_operator/features/field/data/field_operation_repository.dart';

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

FieldOperationCommandContract _command(String version, {String? commandId}) {
  final id = commandId ?? newCommandId();
  return FieldOperationCommandContract(
    commandId: id,
    idempotencyKey: id,
    expectedVersion: version,
    occurredAt: DateTime.now().toUtc(),
  );
}

void main() {
  late bool available;
  late OrbitApiClient client;
  late _MemoryTokenStorage storage;
  late FieldOperationRepository repository;

  setUpAll(() async {
    available = await _apiIsUp();
    if (!available) return;
    storage = _MemoryTokenStorage();
    client = OrbitApiClient.create(
      environment: OrbitEnvironment(
        apiBaseUrl: _baseUrl,
        flavor: OrbitFlavor.development,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 20),
      ),
      storage: storage,
      logger: const OrbitLogger(isProduction: false),
    );
    repository = FieldOperationRepository(client: client);

    final data = await client.post<Map<String, dynamic>>(
      '/identity/login',
      body: {'email': _email, 'password': _password},
      isPublic: true,
    );
    await storage.write(TokenPair.fromJson(data));
  });

  bool skip() {
    if (available) return false;
    markTestSkipped('API indisponível em $_baseUrl');
    return true;
  }

  /// Um atendimento da fila que aceite execução.
  Future<String?> anOperation() async {
    final page = MobileWorkQueuePageContract.fromJson(
      await client.get<Map<String, dynamic>>(
        '/mobile/field/work-queue',
        query: {'view': 'ALL', 'kind': 'SERVICE_OPERATION', 'limit': 50},
      ),
    );
    final item = page.data.firstOrNull;
    return item?.navigationContext.sourceId;
  }

  test('abrir a preparação não altera o atendimento', () async {
    if (skip()) return;
    final operationId = await anOperation();
    if (operationId == null) {
      markTestSkipped('sem atendimento de campo neste tenant');
      return;
    }

    final before = await repository.preparation(operationId);

    /// Ler duas vezes: se a leitura mexesse no domínio, a versão mudaria.
    final after = await repository.preparation(operationId);

    expect(after.version, before.version);
    expect(after.operation.status, before.operation.status);
    expect(after.operation.startedAt, before.operation.startedAt);
  });

  test('a preparação publica versão, ações e elegibilidade', () async {
    if (skip()) return;
    final operationId = await anOperation();
    if (operationId == null) {
      markTestSkipped('sem atendimento de campo neste tenant');
      return;
    }

    final preparation = await repository.preparation(operationId);

    /// A versão é o token de concorrência — sem ela nenhum comando sai.
    expect(preparation.version, isNotEmpty);
    expect(preparation.operation.id, operationId);

    /// Elegibilidade e bloqueios são decisão do servidor.
    expect(preparation.blockers, isA<List<String>>());
  });

  test('versão desatualizada é recusada com conflito', () async {
    if (skip()) return;
    final operationId = await anOperation();
    if (operationId == null) {
      markTestSkipped('sem atendimento de campo neste tenant');
      return;
    }

    final preparation = await repository.preparation(operationId);
    final action = preparation.primaryAction;
    if (action != FieldOperationAllowedAction.start &&
        action != FieldOperationAllowedAction.resume &&
        action != FieldOperationAllowedAction.complete) {
      markTestSkipped('atendimento sem comando de estado disponível');
      return;
    }

    /// Uma versão que certamente não é a atual.
    const stale = '1999-01-01T00:00:00.000Z';
    try {
      if (action == FieldOperationAllowedAction.complete) {
        await repository.complete(operationId, _command(stale));
      } else {
        await repository.start(operationId, _command(stale));
      }
      fail('esperava conflito de versão');
    } on OrbitException catch (error) {
      /// O servidor recusa em vez de sobrescrever o que outro mudou.
      expect(error.isConflict, isTrue, reason: error.toString());
    }
  });

  test('repetir a mesma intenção não produz um segundo efeito', () async {
    if (skip()) return;
    final operationId = await anOperation();
    if (operationId == null) {
      markTestSkipped('sem atendimento de campo neste tenant');
      return;
    }

    var preparation = await repository.preparation(operationId);
    if (!preparation.allowedActions.contains(
      FieldOperationAllowedAction.addNote,
    )) {
      markTestSkipped('atendimento não aceita observação agora');
      return;
    }

    Future<int> noteCount() async {
      final page = await repository.timeline(operationId, limit: 50);
      return page.data.where((entry) => entry.type.contains('NOTE')).length;
    }

    final before = await noteCount();

    /// A mesma intenção, enviada duas vezes — como um toque duplo ou um
    /// reenvio depois de timeout.
    ///
    /// O envelope é **idêntico** nas duas: o backend associa o payload à
    /// chave e recusa se só a chave coincidir. É a mesma intenção, tomada no
    /// mesmo momento, sobre o mesmo estado.
    final envelope = _command(preparation.version);
    const note = 'Observação idempotente do smoke';

    await repository.addNote(operationId, envelope, note: note);
    await repository.addNote(operationId, envelope, note: note);

    /// Um único efeito.
    expect(await noteCount(), before + 1);
  });
}
