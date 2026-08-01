/// Inteligência da operação.
///
/// Endpoint real: `GET /ai-executions?operationId=`. É o único caminho que o
/// backend oferece para análises de IA ligadas a uma operação — `AiExecution`
/// tem `operationId` e o DTO de consulta filtra por ele.
///
/// **Nada é gerado no aplicativo.** O que aparece é o que o agente produziu.
library;

import '../../../core/contracts/operation_contracts.dart';
import '../../../core/errors/orbit_exception.dart';
import '../../../core/network/orbit_api_client.dart';

class OperationIntelligenceRepository {
  const OperationIntelligenceRepository({required OrbitApiClient client})
    : _client = client;

  final OrbitApiClient _client;

  /// Execuções da operação, mais recentes primeiro.
  ///
  /// Sem a capability de IA no plano, o backend responde 403 e devolvemos uma
  /// página vazia: o painel some em vez de virar erro numa tela de execução.
  Future<Paginated<AiExecution>> forOperation(String operationId) async {
    try {
      final data = await _client.get<Map<String, dynamic>>(
        '/ai-executions',
        query: {'operationId': operationId, 'page': 1, 'limit': 10},
      );
      return Paginated.fromJson(data, AiExecution.fromJson);
    } on OrbitException catch (error) {
      if (error.isForbidden) return Paginated<AiExecution>.empty();
      rethrow;
    }
  }
}
