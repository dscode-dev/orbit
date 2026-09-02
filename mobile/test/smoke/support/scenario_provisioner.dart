/// Cenários operacionais isolados para os smokes.
///
/// ## Por que isto existe
///
/// Antes, cada suíte procurava "algum atendimento em determinado estado" num
/// tenant compartilhado. Isso funciona até a primeira suíte mudar o estado de
/// que outra dependia — e foi o que aconteceu: uma rodada concluiu
/// atendimentos, e `COMPLETED` é **terminal**. Três suítes pararam de rodar.
///
/// A regra que substitui aquilo:
///
/// > Nenhuma suíte reaproveita registro operacional mutável de outra.
///
/// Cada suíte pede o cenário de que precisa, e recebe recursos criados agora,
/// só para ela.
///
/// ## Pelo produto, não por SQL
///
/// Tudo é criado pelas APIs e comandos reais: criar atendimento, designar o
/// técnico, iniciar, concluir. Nada de escrita direta no banco, nada de
/// estado que o domínio não produziria sozinho — um cenário montado por fora
/// testaria uma realidade que não existe.
library;

import 'dart:convert';

import 'package:orbit_operator/core/config/environment.dart';
import 'package:orbit_operator/core/network/orbit_api_client.dart';
import 'package:orbit_operator/core/observability/orbit_logger.dart';
import 'package:orbit_operator/core/storage/token_storage.dart';
import 'package:orbit_operator/features/field/application/execution_controller.dart'
    show newCommandId;

import 'smoke_environment.dart';

class _MemoryTokenStorage implements TokenStorage {
  TokenPair? _pair;
  @override
  Future<void> clear() async => _pair = null;
  @override
  Future<TokenPair?> read() async => _pair;
  @override
  Future<void> write(TokenPair pair) async => _pair = pair;
}

/// Em que ponto do ciclo o atendimento deve estar.
///
/// `completed` é **terminal**: um cenário concluído nunca é devolvido a uma
/// suíte que precisa de atendimento em andamento.
enum ScenarioState { open, inProgress, completed }

/// Os recursos que um cenário criou.
final class OperationScenario {
  const OperationScenario({
    required this.scenarioId,
    required this.suite,
    required this.state,
    required this.organizationId,
    required this.businessUnitId,
    required this.userId,
    required this.operationId,
    required this.workItemId,
    required this.code,
    required this.version,
  });

  /// Identidade única desta provisão. Aparece no código e no título do
  /// atendimento, para que o dado seja reconhecível como teste.
  final String scenarioId;
  final String suite;
  final ScenarioState state;

  final String organizationId;
  final String businessUnitId;
  final String userId;
  final String operationId;

  /// O id canônico do item de campo, como o MB-01 o compõe.
  final String workItemId;
  final String code;

  /// A versão publicada pelo servidor ao final da provisão. Nunca um instante
  /// do aparelho: quem define versão é o backend.
  final String? version;

  /// Resumo para o relatório do smoke — sem PII e sem segredo.
  String describe() =>
      'cenário $scenarioId · suíte $suite · estado ${state.name} · '
      'atendimento $code';
}

/// Falha no meio da provisão, com o que já foi criado.
///
/// Um cenário parcial não é devolvido: reaproveitá-lo faria o teste medir um
/// estado que ninguém pediu.
class ScenarioProvisioningFailure implements Exception {
  const ScenarioProvisioningFailure({
    required this.scenarioId,
    required this.step,
    required this.created,
    required this.cause,
  });

  final String scenarioId;
  final String step;
  final List<String> created;
  final Object cause;

  @override
  String toString() =>
      'Provisão $scenarioId falhou em "$step". '
      'Recursos já criados: ${created.isEmpty ? 'nenhum' : created.join(', ')}. '
      'Causa: $cause';
}

/// Cria cenários pelas APIs do produto.
class ScenarioProvisioner {
  ScenarioProvisioner._({
    required this.client,
    required this.organizationId,
    required this.businessUnitId,
    required this.userId,
  });

  final OrbitApiClient client;
  final String organizationId;
  final String businessUnitId;
  final String userId;

  /// Quantos recursos esta execução criou — para o relatório de crescimento.
  int createdOperations = 0;

  /// Autentica e lê o contexto da sessão.
  ///
  /// O guard roda **antes** de qualquer escrita.
  static Future<ScenarioProvisioner> connect() async {
    assertProvisioningAllowed();

    final storage = _MemoryTokenStorage();
    final client = OrbitApiClient.create(
      environment: OrbitEnvironment(
        apiBaseUrl: smokeApiUrl,
        flavor: OrbitFlavor.development,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 30),
      ),
      storage: storage,
      logger: const OrbitLogger(isProduction: false),
    );

    final login = await client.post<Map<String, dynamic>>(
      '/identity/login',
      body: {'email': smokeEmail, 'password': smokePassword},
      isPublic: true,
    );
    final tokens = TokenPair.fromJson(login);
    await storage.write(tokens);

    final claims = _claims(tokens.accessToken);
    final organizationId = claims['organizationId'] as String?;
    final businessUnitId =
        (claims['businessUnitId'] as String?) ??
        ((claims['businessUnitIds'] as List<dynamic>?)?.firstOrNull as String?);
    final userId = claims['sub'] as String?;

    if (organizationId == null || businessUnitId == null || userId == null) {
      throw StateError(
        'A sessão não publicou organização, unidade e usuário — sem eles não '
        'há como provisionar no escopo certo.',
      );
    }

    return ScenarioProvisioner._(
      client: client,
      organizationId: organizationId,
      businessUnitId: businessUnitId,
      userId: userId,
    );
  }

  /// Um atendimento novo, designado a este profissional, no estado pedido.
  ///
  /// Sempre um recurso novo: reaproveitar seria voltar ao problema que este
  /// arquivo existe para resolver.
  Future<OperationScenario> operation({
    required String suite,
    ScenarioState state = ScenarioState.inProgress,
    bool assignToActor = true,
  }) async {
    assertProvisioningAllowed();

    final scenarioId = newCommandId();
    final created = <String>[];
    var step = 'criar atendimento';

    /// O sufixo vem da **cauda aleatória** do UUIDv7, não do prefixo: os
    /// primeiros dígitos são o carimbo de tempo, e dois cenários criados no
    /// mesmo instante colidiriam no código do atendimento — que é único.
    final short = scenarioId.split('-').last;

    try {
      /// O código carrega a marca do smoke: o dado nasce reconhecível como
      /// teste, sem depender de alguém lembrar de anotá-lo depois.
      final code = 'SMOKE-$suite-$short';
      final operation = await client.post<Map<String, dynamic>>(
        '/operations',
        body: {
          'businessUnitId': businessUnitId,
          'code': code,
          'kind': 'MAINTENANCE',
          'title': '[SMOKE-$suite] Cenário automatizado $short',
          'description':
              'Criado pelo harness de smoke do aplicativo. Cenário '
              '$scenarioId.',
        },
      );
      final operationId = operation['id']! as String;
      created.add('operação $operationId');
      createdOperations += 1;

      /// Sem designação, o atendimento existe e é visível para a
      /// administração, mas está **fora do escopo de campo** deste ator — o
      /// cenário exato para provar que o servidor revalida designação no
      /// replay.
      if (assignToActor) {
        step = 'designar o técnico responsável';
        await client.patch<Map<String, dynamic>>(
          '/operations/$operationId/responsible-field-technician',
          body: {'userId': userId},
        );
      }

      /// A partir daqui, só comandos semânticos — os mesmos que o aplicativo
      /// usa. Nada de `PATCH status`.
      if (state != ScenarioState.open) {
        step = 'iniciar o atendimento';
        await _command(operationId, 'start');
      }
      if (state == ScenarioState.completed) {
        step = 'concluir o atendimento';
        await _command(operationId, 'complete');
      }

      /// A preparação de execução só existe para quem está designado; sem
      /// designação o cenário não tem versão, e não precisa ter.
      String? version;
      if (assignToActor) {
        step = 'ler o estado final';
        final preparation = await client.get<Map<String, dynamic>>(
          '/mobile/field/operations/$operationId/execution-preparation',
        );
        version = preparation['version'] as String?;
      }

      return OperationScenario(
        scenarioId: scenarioId,
        suite: suite,
        state: state,
        organizationId: organizationId,
        businessUnitId: businessUnitId,
        userId: userId,
        operationId: operationId,
        workItemId: 'SERVICE_OPERATION:$operationId',
        code: code,
        version: version,
      );
    } on Object catch (error) {
      throw ScenarioProvisioningFailure(
        scenarioId: scenarioId,
        step: step,
        created: created,
        cause: error,
      );
    }
  }

  /// Envia um comando de execução com envelope completo.
  ///
  /// A versão vem da preparação lida agora — nunca de um relógio local.
  Future<void> _command(String operationId, String command) async {
    final preparation = await client.get<Map<String, dynamic>>(
      '/mobile/field/operations/$operationId/execution-preparation',
    );
    final commandId = newCommandId();
    await client.post<Map<String, dynamic>>(
      '/mobile/field/operations/$operationId/commands/$command',
      body: {
        'commandId': commandId,
        'idempotencyKey': commandId,
        'expectedVersion': preparation['version'],
        'occurredAt': DateTime.now().toUtc().toIso8601String(),
      },
    );
  }

  static Map<String, dynamic> _claims(String token) {
    final parts = token.split('.');
    if (parts.length < 2) return const {};
    var payload = parts[1];
    payload += '=' * ((4 - payload.length % 4) % 4);
    return jsonDecode(utf8.decode(base64Url.decode(payload)))
        as Map<String, dynamic>;
  }
}
