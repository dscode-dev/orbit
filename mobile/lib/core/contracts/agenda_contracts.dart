/// Contratos de agenda e indicadores.
///
/// Espelham `scheduling.read-models.ts` (`AgendaReadModel`) e
/// `analytics.read-models.ts` (`AnalyticsDashboardReadModel`).
library;

/// Ocorrência da agenda (`SchedulingOccurrenceReadModel`).
class AgendaEvent {
  const AgendaEvent({
    required this.id,
    required this.title,
    required this.startsAt,
    required this.endsAt,
    required this.status,
    required this.priority,
    this.type,
  });

  factory AgendaEvent.fromJson(Map<String, dynamic> json) => AgendaEvent(
    id: json['occurrenceId'] as String? ?? json['eventId'] as String? ?? '',
    title: json['title'] as String? ?? '',
    startsAt: DateTime.tryParse(json['startsAt'] as String? ?? ''),
    endsAt: DateTime.tryParse(json['endsAt'] as String? ?? ''),
    status: json['status'] as String? ?? '',
    priority: json['priority'] as String? ?? 'NORMAL',
    type: json['type'] as String?,
  );

  final String id;
  final String title;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final String status;
  final String priority;
  final String? type;
}

/// `GET /scheduling/agenda`.
class Agenda {
  const Agenda({
    required this.view,
    required this.total,
    required this.hoursAllocated,
    required this.events,
  });

  factory Agenda.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'] as Map<String, dynamic>? ?? const {};
    final days = json['days'] as List<dynamic>? ?? const [];
    final events = days
        .whereType<Map<String, dynamic>>()
        .expand(
          (day) => (day['events'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(AgendaEvent.fromJson),
        )
        .toList()
      ..sort((a, b) {
        final left = a.startsAt;
        final right = b.startsAt;
        if (left == null || right == null) return 0;
        return left.compareTo(right);
      });

    return Agenda(
      view: json['view'] as String? ?? 'DAY',
      total: (summary['total'] as num?)?.toInt() ?? events.length,
      hoursAllocated: (summary['hoursAllocated'] as num?)?.toDouble() ?? 0,
      events: events,
    );
  }

  final String view;
  final int total;
  final double hoursAllocated;
  final List<AgendaEvent> events;
}

/// Indicador do Analytics (`AnalyticsKpi`).
///
/// `dataQuality` classifica a procedência: `OBSERVED`, `DERIVED`, `PROXY` ou
/// `MOCK`. O app preserva essa semântica — `PROXY` e `MOCK` recebem marca.
class AnalyticsMetric {
  const AnalyticsMetric({
    required this.id,
    required this.label,
    required this.value,
    required this.status,
    required this.dataQuality,
    this.unit,
    this.target,
    this.changePercent = 0,
    this.direction = 'STABLE',
    this.source = '',
  });

  factory AnalyticsMetric.fromJson(Map<String, dynamic> json) =>
      AnalyticsMetric(
        id: json['id'] as String? ?? '',
        label: json['label'] as String? ?? '',
        value: (json['value'] as num?)?.toDouble() ?? 0,
        status: json['status'] as String? ?? 'HEALTHY',
        dataQuality: json['dataQuality'] as String? ?? 'OBSERVED',
        unit: json['unit'] as String?,
        target: (json['target'] as num?)?.toDouble(),
        changePercent: (json['changePercent'] as num?)?.toDouble() ?? 0,
        direction: json['direction'] as String? ?? 'STABLE',
        source: json['source'] as String? ?? '',
      );

  final String id;
  final String label;
  final double value;
  final String status;
  final String dataQuality;
  final String? unit;
  final double? target;
  final double changePercent;
  final String direction;
  final String source;

  /// `PROXY` e `MOCK` mudam como o número deve ser lido.
  bool get needsProvenanceMark =>
      dataQuality == 'PROXY' || dataQuality == 'MOCK';

  String get formattedValue {
    final rounded = value == value.roundToDouble()
        ? value.toStringAsFixed(0)
        : value.toStringAsFixed(1);
    return unit == '%' ? '$rounded%' : rounded;
  }
}

/// `GET /analytics/dashboard` — recorte usado no app.
class OperationalSummary {
  const OperationalSummary({
    required this.healthScore,
    required this.openOperations,
    required this.slaCompliance,
    required this.equipmentAvailability,
    required this.metrics,
  });

  factory OperationalSummary.fromJson(Map<String, dynamic> json) {
    final headline = json['headline'] as Map<String, dynamic>? ?? const {};
    return OperationalSummary(
      healthScore: (headline['healthScore'] as num?)?.toDouble() ?? 0,
      openOperations: (headline['openOperations'] as num?)?.toDouble() ?? 0,
      slaCompliance: (headline['slaCompliance'] as num?)?.toDouble() ?? 0,
      equipmentAvailability:
          (headline['equipmentAvailability'] as num?)?.toDouble() ?? 0,
      metrics: (json['metrics'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AnalyticsMetric.fromJson)
          .toList(growable: false),
    );
  }

  final double healthScore;
  final double openOperations;
  final double slaCompliance;
  final double equipmentAvailability;
  final List<AnalyticsMetric> metrics;
}

/// Notificação (`GET /notifications`).
///
/// O modelo do backend não tem severidade: o que existe é `type` (chave livre
/// de até 80 caracteres) e `status`. O app não inventa gravidade — apresenta o
/// tipo como veio e destaca apenas o que ainda não foi lido.
class OrbitNotification {
  const OrbitNotification({
    required this.id,
    required this.title,
    required this.type,
    required this.status,
    this.body,
    this.readAt,
    this.createdAt,
  });

  factory OrbitNotification.fromJson(Map<String, dynamic> json) =>
      OrbitNotification(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        type: json['type'] as String? ?? '',
        status: json['status'] as String? ?? '',
        body: json['body'] as String?,
        readAt: DateTime.tryParse(json['readAt'] as String? ?? ''),
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      );

  final String id;
  final String title;
  final String type;
  final String status;
  final String? body;
  final DateTime? readAt;
  final DateTime? createdAt;

  bool get isUnread => readAt == null;
}
