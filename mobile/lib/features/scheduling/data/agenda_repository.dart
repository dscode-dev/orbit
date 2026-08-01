/// Repositório da agenda.
///
/// Endpoint real: `GET /scheduling/agenda` (`AgendaQueryDto` exige `view` e
/// `date`). Exige a capability e a permissão `scheduling.read`.
library;

import '../../../core/contracts/agenda_contracts.dart';
import '../../../core/errors/orbit_exception.dart';
import '../../../core/network/orbit_api_client.dart';
import '../../../core/storage/read_cache.dart';
import '../../operations/data/operations_repository.dart' show CachedResult;

class AgendaRepository {
  const AgendaRepository({
    required OrbitApiClient client,
    required ReadCache cache,
  }) : _client = client,
       _cache = cache;

  final OrbitApiClient _client;
  final ReadCache _cache;

  /// Agenda de um dia ou semana.
  ///
  /// A data é normalizada para o início do dia — assim a chave de cache é
  /// estável e não gera uma entrada nova a cada consulta.
  Future<CachedResult<Agenda>> load({
    required String view,
    required DateTime date,
    String? businessUnitId,
  }) async {
    final day = DateTime.utc(date.year, date.month, date.day);
    final key = 'agenda.$view.${day.toIso8601String()}.${businessUnitId ?? 'all'}';

    try {
      final data = await _client.get<Map<String, dynamic>>(
        '/scheduling/agenda',
        query: {
          'view': view,
          'date': day.toIso8601String(),
          if (businessUnitId != null) 'businessUnitId': businessUnitId,
        },
      );
      await _cache.write(key, data);
      return CachedResult(value: Agenda.fromJson(data), cachedAt: null);
    } on OrbitException catch (error) {
      if (!error.isOffline && !error.isServer) rethrow;
      final cached = await _cache.read(key);
      if (cached == null) rethrow;
      return CachedResult(
        value: Agenda.fromJson(cached.value),
        cachedAt: cached.cachedAt,
      );
    }
  }
}
