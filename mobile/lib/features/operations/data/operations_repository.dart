/// Repositório de operações.
///
/// Endpoints reais consumidos:
/// `GET /operations`, `GET /operations/:id`, `GET /operations/:id/timeline`,
/// `GET /operations/:id/history`, `PATCH /operations/:id/status`,
/// `GET /checklist-executions?operationId=`.
///
/// Leitura com cache: listas e detalhes já consultados ficam guardados para o
/// app abrir com conteúdo sem rede. Escritas nunca usam cache.
library;

import '../../../core/contracts/operation_contracts.dart';
import '../../../core/errors/orbit_exception.dart';
import '../../../core/network/orbit_api_client.dart';
import '../../../core/storage/read_cache.dart';

/// Resultado de leitura, com a procedência do dado.
///
/// A interface precisa saber se está mostrando algo vindo da rede ou do cache
/// para poder avisar que o conteúdo pode estar desatualizado.
class CachedResult<T> {
  const CachedResult({required this.value, required this.cachedAt});

  final T value;

  /// `null` quando veio da rede agora.
  final DateTime? cachedAt;

  bool get isFromCache => cachedAt != null;
}

class OperationsRepository {
  const OperationsRepository({
    required OrbitApiClient client,
    required ReadCache cache,
  }) : _client = client,
       _cache = cache;

  final OrbitApiClient _client;
  final ReadCache _cache;

  /// Lista paginada.
  ///
  /// Em falha de rede, devolve a última página equivalente já consultada. Erros
  /// de autorização não caem para o cache — o usuário precisa vê-los.
  Future<CachedResult<Paginated<Operation>>> list(OperationQuery query) async {
    try {
      final data = await _client.get<Map<String, dynamic>>(
        '/operations',
        query: query.toQueryParameters(),
      );
      await _cache.write(query.cacheKey, data);
      return CachedResult(
        value: Paginated.fromJson(data, Operation.fromJson),
        cachedAt: null,
      );
    } on OrbitException catch (error) {
      if (!error.isOffline && !error.isServer) rethrow;
      final cached = await _cache.read(query.cacheKey);
      if (cached == null) rethrow;
      return CachedResult(
        value: Paginated.fromJson(cached.value, Operation.fromJson),
        cachedAt: cached.cachedAt,
      );
    }
  }

  Future<CachedResult<Operation>> detail(String id) async {
    final key = 'operation.$id';
    try {
      final data = await _client.get<Map<String, dynamic>>('/operations/$id');
      await _cache.write(key, data);
      return CachedResult(value: Operation.fromJson(data), cachedAt: null);
    } on OrbitException catch (error) {
      if (!error.isOffline && !error.isServer) rethrow;
      final cached = await _cache.read(key);
      if (cached == null) rethrow;
      return CachedResult(
        value: Operation.fromJson(cached.value),
        cachedAt: cached.cachedAt,
      );
    }
  }

  Future<OperationTimeline> timeline(String id) async {
    final data = await _client.get<Map<String, dynamic>>(
      '/operations/$id/timeline',
    );
    return OperationTimeline.fromJson(data);
  }

  Future<List<OperationHistoryEntry>> history(String id) async {
    final data = await _client.get<List<dynamic>>('/operations/$id/history');
    return data
        .whereType<Map<String, dynamic>>()
        .map(OperationHistoryEntry.fromJson)
        .toList(growable: false);
  }

  Future<Paginated<OperationChecklistSummary>> checklists(
    String operationId,
  ) async {
    final data = await _client.get<Map<String, dynamic>>(
      '/checklist-executions',
      query: {'operationId': operationId, 'page': 1, 'limit': 50},
    );
    return Paginated.fromJson(data, OperationChecklistSummary.fromJson);
  }

  /// Muda o status.
  ///
  /// A máquina de estados é do backend (`OperationService.transitions`): o app
  /// envia a intenção e apresenta a recusa quando ela vem.
  Future<Operation> changeStatus({
    required String id,
    required String status,
    String? reason,
  }) async {
    final data = await _client.patch<Map<String, dynamic>>(
      '/operations/$id/status',
      body: {
        'status': status,
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
    await _cache.write('operation.$id', data);
    return Operation.fromJson(data);
  }
}
