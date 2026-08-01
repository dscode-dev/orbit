/// Repositório da Home.
///
/// Endpoints reais:
/// - `GET /analytics/dashboard` → Read Model com KPIs já calculados;
/// - `GET /operations` → contagens por status, lidas de `meta.total`;
/// - `GET /notifications` → alertas do usuário.
///
/// **Nenhuma métrica é calculada no app.** Onde aparece um número, ele veio do
/// backend: ou de um Read Model do Analytics, ou do `total` que o servidor
/// devolve ao contar a própria consulta.
library;

import '../../../core/contracts/agenda_contracts.dart';
import '../../../core/contracts/operation_contracts.dart';
import '../../../core/errors/orbit_exception.dart';
import '../../../core/network/orbit_api_client.dart';

/// Contagem de operações por status, obtida do servidor.
class StatusCount {
  const StatusCount({required this.status, required this.total});

  final String status;
  final int total;

  String get label => OperationStatus.label(status);
}

class HomeRepository {
  const HomeRepository({required OrbitApiClient client}) : _client = client;

  final OrbitApiClient _client;

  /// Resumo operacional do Analytics.
  ///
  /// `null` quando o plano não libera `analytics.read` — a Home segue
  /// funcionando com o restante.
  Future<OperationalSummary?> operationalSummary({
    String? businessUnitId,
  }) async {
    try {
      final data = await _client.get<Map<String, dynamic>>(
        '/analytics/dashboard',
        query: {if (businessUnitId != null) 'businessUnitId': businessUnitId},
      );
      return OperationalSummary.fromJson(data);
    } on OrbitException catch (error) {
      if (error.isForbidden) return null;
      rethrow;
    }
  }

  /// Total de operações em um status, contado pelo backend.
  ///
  /// Pede `limit: 1` porque só interessa `meta.total` — evita trafegar a
  /// página inteira para mostrar um número.
  Future<StatusCount> countByStatus({
    required String status,
    String? businessUnitId,
    String? assignedUserId,
  }) async {
    final data = await _client.get<Map<String, dynamic>>(
      '/operations',
      query: {
        'status': status,
        'page': 1,
        'limit': 1,
        if (businessUnitId != null) 'businessUnitId': businessUnitId,
        if (assignedUserId != null) 'assignedUserId': assignedUserId,
      },
    );
    final meta = data['meta'] as Map<String, dynamic>? ?? const {};
    return StatusCount(
      status: status,
      total: (meta['total'] as num?)?.toInt() ?? 0,
    );
  }

  /// Operações com prazo previsto já vencido, ainda não concluídas.
  ///
  /// O backend não tem filtro de "atrasada". O que ele tem é `scheduledTo`,
  /// que recorta pela janela de agendamento — combinado com um status em
  /// aberto, o próprio servidor conta o que venceu. A contagem continua sendo
  /// dele; o app só escolhe o recorte.
  Future<StatusCount> countOverdue({
    required String status,
    String? businessUnitId,
    String? assignedUserId,
  }) async {
    final data = await _client.get<Map<String, dynamic>>(
      '/operations',
      query: {
        'status': status,
        'scheduledTo': DateTime.now().toUtc().toIso8601String(),
        'page': 1,
        'limit': 1,
        if (businessUnitId != null) 'businessUnitId': businessUnitId,
        if (assignedUserId != null) 'assignedUserId': assignedUserId,
      },
    );
    final meta = data['meta'] as Map<String, dynamic>? ?? const {};
    return StatusCount(
      status: status,
      total: (meta['total'] as num?)?.toInt() ?? 0,
    );
  }

  /// Notificações não lidas do usuário.
  Future<List<OrbitNotification>> alerts() async {
    try {
      final data = await _client.get<Map<String, dynamic>>(
        '/notifications',
        query: {'unreadOnly': 'true', 'page': 1, 'limit': 10},
      );
      return (data['data'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(OrbitNotification.fromJson)
          .toList(growable: false);
    } on OrbitException catch (error) {
      if (error.isForbidden) return const [];
      rethrow;
    }
  }
}
