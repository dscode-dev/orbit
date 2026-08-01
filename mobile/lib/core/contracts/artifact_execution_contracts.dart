/// Public contracts for `/api/v1/artifact-executions`.
/// Additive fields are ignored to keep the mobile v1 parser forward-compatible.
library;

typedef JsonObject = Map<String, dynamic>;

class ArtifactSnapshotContract {
  const ArtifactSnapshotContract({
    required this.id,
    required this.templateId,
    required this.templateVersion,
    required this.sections,
    required this.signatureSlots,
  });
  factory ArtifactSnapshotContract.fromJson(JsonObject json) =>
      ArtifactSnapshotContract(
        id: json['id'] as String? ?? '',
        templateId: json['templateId'] as String? ?? '',
        templateVersion: (json['templateVersion'] as num?)?.toInt() ?? 0,
        sections: (json['sections'] as List<dynamic>? ?? const [])
            .whereType<JsonObject>()
            .toList(growable: false),
        signatureSlots: (json['signatureSlots'] as List<dynamic>? ?? const [])
            .whereType<JsonObject>()
            .toList(growable: false),
      );
  final String id;
  final String templateId;
  final int templateVersion;
  final List<JsonObject> sections;
  final List<JsonObject> signatureSlots;
}

class ArtifactResponseContract {
  const ArtifactResponseContract({
    required this.id,
    required this.sectionId,
    required this.fieldId,
    required this.value,
    required this.valueType,
    required this.provenance,
  });
  factory ArtifactResponseContract.fromJson(JsonObject json) =>
      ArtifactResponseContract(
        id: json['id'] as String? ?? '',
        sectionId: json['sectionId'] as String? ?? '',
        fieldId: json['fieldId'] as String? ?? '',
        value: json['value'],
        valueType: json['valueType'] as String? ?? '',
        provenance: json['provenance'] as String? ?? 'USER',
      );
  final String id;
  final String sectionId;
  final String fieldId;
  final dynamic value;
  final String valueType;
  final String provenance;
}

class ArtifactProgressContract {
  const ArtifactProgressContract({
    required this.percentage,
    required this.requiredPending,
    required this.pendingSignatures,
    required this.canComplete,
  });
  factory ArtifactProgressContract.fromJson(JsonObject json) =>
      ArtifactProgressContract(
        percentage: (json['percentage'] as num?)?.toInt() ?? 0,
        requiredPending: (json['requiredPending'] as num?)?.toInt() ?? 0,
        pendingSignatures: (json['pendingSignatures'] as num?)?.toInt() ?? 0,
        canComplete: json['canComplete'] as bool? ?? false,
      );
  final int percentage;
  final int requiredPending;
  final int pendingSignatures;
  final bool canComplete;
}

class ArtifactExecutionContract {
  const ArtifactExecutionContract({
    required this.id,
    required this.code,
    required this.title,
    required this.status,
    required this.progress,
    required this.snapshot,
    required this.responses,
    required this.progressDetails,
  });
  factory ArtifactExecutionContract.fromJson(JsonObject json) =>
      ArtifactExecutionContract(
        id: json['id'] as String? ?? '',
        code: json['code'] as String? ?? '',
        title: json['title'] as String? ?? '',
        status: json['status'] as String? ?? 'DRAFT',
        progress: (json['progress'] as num?)?.toInt() ?? 0,
        snapshot: ArtifactSnapshotContract.fromJson(
          json['snapshot'] as JsonObject? ?? const {},
        ),
        responses: (json['responses'] as List<dynamic>? ?? const [])
            .whereType<JsonObject>()
            .map(ArtifactResponseContract.fromJson)
            .toList(growable: false),
        progressDetails: ArtifactProgressContract.fromJson(
          json['progressDetails'] as JsonObject? ?? const {},
        ),
      );
  final String id;
  final String code;
  final String title;
  final String status;
  final int progress;
  final ArtifactSnapshotContract snapshot;
  final List<ArtifactResponseContract> responses;
  final ArtifactProgressContract progressDetails;
}
