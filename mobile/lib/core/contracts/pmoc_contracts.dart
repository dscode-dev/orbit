/// Contratos públicos aditivos do PMOC V2 (`/api/v1/pmoc`).
library;

typedef PmocJson = Map<String, dynamic>;

abstract final class PmocEquipmentExecutionStatus {
  static const inProgress = 'IN_PROGRESS';
  static const completed = 'COMPLETED';
  static const cancelled = 'CANCELLED';
  static const all = [inProgress, completed, cancelled];
}

class PmocExecutionEligibilityContract {
  const PmocExecutionEligibilityContract({
    required this.ready,
    required this.blockedReasons,
  });
  factory PmocExecutionEligibilityContract.fromJson(PmocJson json) =>
      PmocExecutionEligibilityContract(
        ready: json['ready'] as bool? ?? false,
        blockedReasons: (json['blockedReasons'] as List<dynamic>? ?? const [])
            .whereType<String>()
            .toList(growable: false),
      );
  final bool ready;
  final List<String> blockedReasons;
}

class PmocEquipmentExecutionContract {
  const PmocEquipmentExecutionContract({
    required this.id,
    required this.status,
    required this.asset,
    required this.evidence,
    this.performedAt,
    this.operation,
    this.artifactExecution,
  });
  factory PmocEquipmentExecutionContract.fromJson(PmocJson json) =>
      PmocEquipmentExecutionContract(
        id: json['id'] as String? ?? '',
        status: json['status'] as String? ?? '',
        asset: json['asset'] as PmocJson? ?? const {},
        evidence: (json['evidence'] as List<dynamic>? ?? const [])
            .whereType<PmocJson>()
            .toList(growable: false),
        performedAt: DateTime.tryParse(json['performedAt'] as String? ?? ''),
        operation: json['operation'] as PmocJson?,
        artifactExecution: json['artifactExecution'] as PmocJson?,
      );
  final String id;
  final String status;
  final PmocJson asset;
  final List<PmocJson> evidence;
  final DateTime? performedAt;
  final PmocJson? operation;
  final PmocJson? artifactExecution;
}

class PmocExecutionPreparationContract {
  const PmocExecutionPreparationContract({
    required this.plan,
    required this.cycle,
    required this.equipment,
    required this.procedure,
    required this.eligibility,
    required this.allowedActions,
    this.existingExecution,
  });
  factory PmocExecutionPreparationContract.fromJson(PmocJson json) =>
      PmocExecutionPreparationContract(
        plan: json['plan'] as PmocJson? ?? const {},
        cycle: json['cycle'] as PmocJson? ?? const {},
        equipment: json['equipment'] as PmocJson? ?? const {},
        procedure: json['procedure'],
        eligibility: PmocExecutionEligibilityContract.fromJson(
          json['eligibility'] as PmocJson? ?? const {},
        ),
        allowedActions: (json['allowedActions'] as List<dynamic>? ?? const [])
            .whereType<String>()
            .toList(growable: false),
        existingExecution: json['existingExecution'] is PmocJson
            ? PmocEquipmentExecutionContract.fromJson(
                json['existingExecution'] as PmocJson,
              )
            : null,
      );
  final PmocJson plan;
  final PmocJson cycle;
  final PmocJson equipment;
  final dynamic procedure;
  final PmocExecutionEligibilityContract eligibility;
  final List<String> allowedActions;
  final PmocEquipmentExecutionContract? existingExecution;
}

class PmocCursorPageContract<T> {
  const PmocCursorPageContract({
    required this.data,
    required this.hasNextPage,
    this.nextCursor,
  });
  final List<T> data;
  final String? nextCursor;
  final bool hasNextPage;
}

class PmocTimelineItemContract {
  const PmocTimelineItemContract({
    required this.id,
    required this.type,
    required this.message,
    required this.occurredAt,
    required this.data,
    this.actor,
    this.equipment,
  });
  factory PmocTimelineItemContract.fromJson(PmocJson json) =>
      PmocTimelineItemContract(
        id: json['id'] as String? ?? '',
        type: json['type'] as String? ?? '',
        message: json['message'] as String? ?? '',
        occurredAt: DateTime.parse(json['occurredAt'] as String),
        actor: json['actor'] as PmocJson?,
        equipment: json['equipment'] as PmocJson?,
        data: json['data'] as PmocJson? ?? const {},
      );
  final String id;
  final String type;
  final String message;
  final DateTime occurredAt;
  final PmocJson? actor;
  final PmocJson? equipment;
  final PmocJson data;
}

class PmocGeneratedArtifactContract {
  const PmocGeneratedArtifactContract({
    required this.artifactExecutionId,
    required this.created,
    required this.sourceType,
    required this.sourceEntityId,
  });
  factory PmocGeneratedArtifactContract.fromJson(PmocJson json) =>
      PmocGeneratedArtifactContract(
        artifactExecutionId: json['artifactExecutionId'] as String? ?? '',
        created: json['created'] as bool? ?? false,
        sourceType: json['sourceType'] as String? ?? '',
        sourceEntityId: json['sourceEntityId'] as String? ?? '',
      );
  final String artifactExecutionId;
  final bool created;
  final String sourceType;
  final String sourceEntityId;
}
