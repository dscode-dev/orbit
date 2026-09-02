enum FieldEvidenceTarget { operation, pmocEquipmentExecution, rvtExecution }

enum EvidenceCategory { before, after, general, equipment, defect, measurement }

enum EvidenceSource { camera, gallery, file }

enum EvidenceUploadStatus {
  pendingUpload,
  uploaded,
  finalized,
  failed,
  expired,
}

String fieldEvidenceTargetToWire(FieldEvidenceTarget value) => switch (value) {
  FieldEvidenceTarget.operation => 'OPERATION',
  FieldEvidenceTarget.pmocEquipmentExecution => 'PMOC_EQUIPMENT_EXECUTION',
  FieldEvidenceTarget.rvtExecution => 'RVT_EXECUTION',
};

final class FieldEvidenceTargetContract {
  const FieldEvidenceTargetContract({required this.type, required this.id});
  final FieldEvidenceTarget type;
  final String id;
  Map<String, Object?> toJson() => {
    'type': fieldEvidenceTargetToWire(type),
    'id': id,
  };
}

final class EvidenceUploadIntentRequest {
  const EvidenceUploadIntentRequest({
    required this.target,
    required this.filename,
    required this.declaredMimeType,
    required this.declaredSize,
    required this.idempotencyKey,
    this.category = EvidenceCategory.general,
    this.source = EvidenceSource.camera,
    this.capturedAt,
    this.localMediaId,
    this.expectedSha256,
  });
  final FieldEvidenceTargetContract target;
  final String filename;
  final String declaredMimeType;
  final int declaredSize;
  final String idempotencyKey;
  final EvidenceCategory category;
  final EvidenceSource source;
  final DateTime? capturedAt;
  final String? localMediaId;
  final String? expectedSha256;
  Map<String, Object?> toJson() => {
    'target': target.toJson(),
    'filename': filename,
    'declaredMimeType': declaredMimeType,
    'declaredSize': declaredSize,
    'idempotencyKey': idempotencyKey,
    'category': category.name.toUpperCase(),
    'source': source.name.toUpperCase(),
    if (capturedAt != null) 'capturedAt': capturedAt!.toUtc().toIso8601String(),
    if (localMediaId != null) 'localMediaId': localMediaId,
    if (expectedSha256 != null) 'expectedSha256': expectedSha256,
  };
}

final class EvidenceUploadIntent {
  const EvidenceUploadIntent({
    required this.uploadId,
    required this.requiredHeaders,
    required this.expiresAt,
    required this.maxSize,
    required this.status,
    this.uploadUrl,
    this.method,
    this.localMediaId,
  });
  final String uploadId;
  final String? uploadUrl;
  final String? method;
  final Map<String, String> requiredHeaders;
  final DateTime expiresAt;
  final int maxSize;
  final String? localMediaId;
  final EvidenceUploadStatus status;
}

final class EvidenceFinalizeRequest {
  const EvidenceFinalizeRequest({this.expectedSha256});
  final String? expectedSha256;
  Map<String, Object?> toJson() => {
    if (expectedSha256 != null) 'expectedSha256': expectedSha256,
  };
}

final class FieldEvidenceAuthorContract {
  const FieldEvidenceAuthorContract({required this.id, required this.name});
  final String id;
  final String name;
}

final class FieldEvidenceReadModel {
  const FieldEvidenceReadModel({
    required this.id,
    required this.target,
    required this.category,
    required this.filename,
    required this.mimeType,
    required this.sizeBytes,
    required this.sha256,
    required this.uploadedAt,
    required this.capturedBy,
    required this.source,
    required this.previewAvailable,
    required this.downloadAvailable,
    this.capturedAt,
    this.localMediaId,
  });
  final String id;
  final FieldEvidenceTargetContract target;
  final EvidenceCategory category;
  final String filename;
  final String mimeType;
  final int sizeBytes;
  final String sha256;
  final DateTime? capturedAt;
  final DateTime uploadedAt;
  final FieldEvidenceAuthorContract capturedBy;
  final EvidenceSource source;
  final String? localMediaId;
  final bool previewAvailable;
  final bool downloadAvailable;
}

final class EvidencePolicy {
  const EvidencePolicy({
    required this.acceptedMimeTypes,
    required this.imageMaxBytes,
    required this.documentMaxBytes,
    required this.maximumFiles,
    required this.pendingUploadTtlHours,
  });
  final List<String> acceptedMimeTypes;
  final int imageMaxBytes;
  final int documentMaxBytes;
  final int maximumFiles;
  final int pendingUploadTtlHours;
}
