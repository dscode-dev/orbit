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
