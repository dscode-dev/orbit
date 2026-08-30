enum MobileProfessionalRole { fieldTechnician, technicalResponsible }

MobileProfessionalRole mobileProfessionalRoleFromWire(String value) =>
    switch (value) {
      'FIELD_TECHNICIAN' => MobileProfessionalRole.fieldTechnician,
      'TECHNICAL_RESPONSIBLE' => MobileProfessionalRole.technicalResponsible,
      _ => throw FormatException('Unsupported professional role: $value'),
    };

final class MobileSignatureStatus {
  const MobileSignatureStatus({
    required this.signatureAvailable,
    required this.version,
    required this.updatedAt,
    required this.roles,
  });
  final bool signatureAvailable;
  final int? version;
  final DateTime? updatedAt;
  final List<MobileProfessionalRole> roles;

  factory MobileSignatureStatus.fromJson(Map<String, Object?> json) =>
      MobileSignatureStatus(
        signatureAvailable: json['signatureAvailable']! as bool,
        version: json['version'] as int?,
        updatedAt: json['updatedAt'] == null
            ? null
            : DateTime.parse(json['updatedAt']! as String),
        roles: (json['roles']! as List<Object?>)
            .map((value) => mobileProfessionalRoleFromWire(value! as String))
            .toList(growable: false),
      );
}

final class MobileSignatureUploadInput {
  const MobileSignatureUploadInput(this.storageObjectId);
  final String storageObjectId;
  Map<String, Object?> toJson() => {'storageObjectId': storageObjectId};
}

final class MobileSignatureUploadReservationInput {
  const MobileSignatureUploadReservationInput({
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
  });
  final String fileName;
  final String mimeType;
  final int sizeBytes;
  Map<String, Object?> toJson() => {
    'fileName': fileName,
    'mimeType': mimeType,
    'sizeBytes': sizeBytes,
  };
}

final class MobileSignatureUploadReservation {
  const MobileSignatureUploadReservation({
    required this.fileId,
    required this.url,
    required this.expiresAt,
    required this.requiredHeaders,
  });
  final String fileId;
  final Uri url;
  final DateTime expiresAt;
  final Map<String, String> requiredHeaders;
  factory MobileSignatureUploadReservation.fromJson(Map<String, Object?> json) {
    final upload = json['upload']! as Map<String, Object?>;
    final headers = upload['requiredHeaders']! as Map<String, Object?>;
    return MobileSignatureUploadReservation(
      fileId: json['fileId']! as String,
      url: Uri.parse(upload['url']! as String),
      expiresAt: DateTime.parse(upload['expiresAt']! as String),
      requiredHeaders: headers.map(
        (key, value) => MapEntry(key, value! as String),
      ),
    );
  }
}

final class MobileSignatureUploadResult {
  const MobileSignatureUploadResult({
    required this.status,
    required this.replacedVersion,
  });
  final MobileSignatureStatus status;
  final int? replacedVersion;
  factory MobileSignatureUploadResult.fromJson(Map<String, Object?> json) =>
      MobileSignatureUploadResult(
        status: MobileSignatureStatus.fromJson(json),
        replacedVersion: json['replacedVersion'] as int?,
      );
}

final class ProfessionalSignatureRequirement {
  const ProfessionalSignatureRequirement({
    required this.required,
    required this.available,
    required this.role,
    required this.eligible,
    required this.blockedReason,
    required this.message,
  });
  final bool required;
  final bool available;
  final MobileProfessionalRole? role;
  final bool eligible;
  final String? blockedReason;
  final String? message;
  factory ProfessionalSignatureRequirement.fromJson(
    Map<String, Object?> json,
  ) => ProfessionalSignatureRequirement(
    required: json['required']! as bool,
    available: json['available']! as bool,
    role: json['role'] == null
        ? null
        : mobileProfessionalRoleFromWire(json['role']! as String),
    eligible: json['eligible']! as bool,
    blockedReason: json['blockedReason'] as String?,
    message: json['message'] as String?,
  );
}

final class CustomerAcknowledgementInput {
  const CustomerAcknowledgementInput({
    required this.signerName,
    required this.expectedVersion,
    required this.contentHash,
    required this.commandId,
    this.signatureStorageFileId,
    this.contactId,
    this.occurredAt,
  });
  final String signerName;
  final String expectedVersion;
  final String contentHash;
  final String commandId;
  final String? signatureStorageFileId;
  final String? contactId;
  final DateTime? occurredAt;
  Map<String, Object?> toJson() => {
    'signerName': signerName,
    'expectedVersion': expectedVersion,
    'contentHash': contentHash,
    'commandId': commandId,
    if (signatureStorageFileId != null)
      'signatureStorageFileId': signatureStorageFileId,
    if (contactId != null) 'contactId': contactId,
    if (occurredAt != null) 'occurredAt': occurredAt!.toUtc().toIso8601String(),
  };
}

final class CustomerAcknowledgementPreparation {
  const CustomerAcknowledgementPreparation({
    required this.executionId,
    required this.serviceSummary,
    required this.contentVersion,
    required this.contentHash,
    required this.signatureRequired,
    required this.signatureOptional,
  });
  final String executionId;
  final String serviceSummary;
  final String contentVersion;
  final String contentHash;
  final bool signatureRequired;
  final bool signatureOptional;
  factory CustomerAcknowledgementPreparation.fromJson(
    Map<String, Object?> json,
  ) {
    final policy = json['signerPolicy']! as Map<String, Object?>;
    return CustomerAcknowledgementPreparation(
      executionId: json['executionId']! as String,
      serviceSummary: json['serviceSummary']! as String,
      contentVersion: json['contentVersion']! as String,
      contentHash: json['contentHash']! as String,
      signatureRequired: policy['signatureRequired']! as bool,
      signatureOptional: policy['signatureOptional']! as bool,
    );
  }
}

final class CustomerAcknowledgementResult {
  const CustomerAcknowledgementResult({
    required this.id,
    required this.executionId,
    required this.signerName,
    required this.hasSignature,
    required this.acknowledgedAt,
    required this.contentVersion,
    required this.contentHash,
    required this.idempotentReplay,
  });
  final String id;
  final String executionId;
  final String signerName;
  final bool hasSignature;
  final DateTime acknowledgedAt;
  final String contentVersion;
  final String contentHash;
  final bool idempotentReplay;
  factory CustomerAcknowledgementResult.fromJson(Map<String, Object?> json) =>
      CustomerAcknowledgementResult(
        id: json['id']! as String,
        executionId: json['executionId']! as String,
        signerName: json['signerName']! as String,
        hasSignature: json['hasSignature']! as bool,
        acknowledgedAt: DateTime.parse(json['acknowledgedAt']! as String),
        contentVersion: json['contentVersion']! as String,
        contentHash: json['contentHash']! as String,
        idempotentReplay: json['idempotentReplay']! as bool,
      );
}
