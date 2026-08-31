enum FieldArtifactSourceType { operation, rvtExecution, pmocEquipmentExecution }

enum FieldArtifactDocumentType { serviceOrder, rvt, pmoc }

enum FieldArtifactStatus {
  notPrepared,
  prepared,
  pending,
  rendering,
  ready,
  failed,
}

enum FieldArtifactAllowedAction {
  prepareDocument,
  generateDocument,
  viewDocument,
  downloadDocument,
}

enum FieldArtifactBlockedReason {
  sourceNotCompleted,
  fieldTechnicianSignatureMissing,
  technicalResponsibleMissing,
  rtSignatureMissing,
  acknowledgementRequired,
  acknowledgementStale,
  evidencePending,
  templateNotAvailable,
  notAuthorized,
}

class FieldArtifactEligibility {
  const FieldArtifactEligibility({
    required this.eligible,
    required this.blockedReasons,
  });

  final bool eligible;
  final List<FieldArtifactBlockedReason> blockedReasons;
}

class FieldArtifactReadModel {
  const FieldArtifactReadModel({
    required this.id,
    required this.artifactExecutionId,
    required this.sourceType,
    required this.sourceId,
    required this.documentType,
    required this.status,
    required this.snapshotVersion,
    required this.snapshotHash,
    required this.templateVersion,
    required this.generatedAt,
    required this.previewAvailable,
    required this.downloadAvailable,
    required this.allowedActions,
  });

  final String id;
  final String artifactExecutionId;
  final FieldArtifactSourceType sourceType;
  final String sourceId;
  final FieldArtifactDocumentType documentType;
  final FieldArtifactStatus status;
  final int snapshotVersion;
  final String snapshotHash;
  final int templateVersion;
  final DateTime? generatedAt;
  final bool previewAvailable;
  final bool downloadAvailable;
  final List<FieldArtifactAllowedAction> allowedActions;
}

class FieldArtifactPreparation {
  const FieldArtifactPreparation({
    required this.sourceType,
    required this.sourceId,
    required this.documentType,
    required this.eligibility,
    required this.templateVersion,
    required this.fieldSignatureAvailable,
    required this.technicalResponsibleRequired,
    required this.technicalResponsibleSignatureAvailable,
    required this.customerAcknowledgementRequired,
    required this.customerAcknowledgementAvailable,
    required this.finalizedEvidence,
    required this.pendingEvidence,
    required this.existingArtifact,
    required this.allowedActions,
  });

  final FieldArtifactSourceType sourceType;
  final String sourceId;
  final FieldArtifactDocumentType documentType;
  final FieldArtifactEligibility eligibility;
  final int? templateVersion;
  final bool fieldSignatureAvailable;
  final bool technicalResponsibleRequired;
  final bool technicalResponsibleSignatureAvailable;
  final bool customerAcknowledgementRequired;
  final bool customerAcknowledgementAvailable;
  final int finalizedEvidence;
  final int pendingEvidence;
  final FieldArtifactReadModel? existingArtifact;
  final List<FieldArtifactAllowedAction> allowedActions;
}

class FieldArtifactDownload {
  const FieldArtifactDownload({
    required this.artifactId,
    required this.operation,
    required this.url,
    required this.expiresAt,
    required this.requiredHeaders,
  });

  final String artifactId;
  final String operation;
  final Uri url;
  final DateTime expiresAt;
  final Map<String, String> requiredHeaders;
}
