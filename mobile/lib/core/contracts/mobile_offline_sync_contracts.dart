import 'mobile_field_contracts.dart';

/// MB-04 command-based offline protocol. Domain decisions remain server-side.
enum OfflineCommandType {
  operationStart,
  operationChecklistUpdate,
  operationAddNote,
  operationAddMaterial,
  operationComplete,
  customerAcknowledgement,
}

enum OfflineCommandStatus {
  applied,
  alreadyApplied,
  conflict,
  rejected,
  retryableError,
  blocked,
}

String offlineCommandTypeToWire(OfflineCommandType value) => switch (value) {
  OfflineCommandType.operationStart => 'OPERATION_START',
  OfflineCommandType.operationChecklistUpdate => 'OPERATION_CHECKLIST_UPDATE',
  OfflineCommandType.operationAddNote => 'OPERATION_ADD_NOTE',
  OfflineCommandType.operationAddMaterial => 'OPERATION_ADD_MATERIAL',
  OfflineCommandType.operationComplete => 'OPERATION_COMPLETE',
  OfflineCommandType.customerAcknowledgement => 'CUSTOMER_ACKNOWLEDGEMENT',
};

sealed class OfflineCommandPayload {
  const OfflineCommandPayload();
  Map<String, Object?> toJson();
}

final class EmptyOfflinePayload extends OfflineCommandPayload {
  const EmptyOfflinePayload();
  @override
  Map<String, Object?> toJson() => const {};
}

final class OperationNoteOfflinePayload extends OfflineCommandPayload {
  const OperationNoteOfflinePayload({
    required this.note,
    this.customerVisible = false,
  });
  final String note;
  final bool customerVisible;
  @override
  Map<String, Object?> toJson() => {
    'note': note,
    'visibility': customerVisible ? 'CUSTOMER_VISIBLE' : 'INTERNAL',
  };
}

final class OperationChecklistOfflinePayload extends OfflineCommandPayload {
  const OperationChecklistOfflinePayload({
    required this.checklistId,
    required this.answers,
    this.notes,
    this.complete = false,
  });
  final String checklistId;
  final Map<String, Object?> answers;
  final String? notes;
  final bool complete;
  @override
  Map<String, Object?> toJson() => {
    'checklistId': checklistId,
    'answers': answers,
    if (notes != null) 'notes': notes,
    'complete': complete,
  };
}

final class OperationMaterialOfflinePayload extends OfflineCommandPayload {
  const OperationMaterialOfflinePayload({
    required this.catalogItemId,
    required this.quantity,
    this.reason,
    this.notes,
  });
  final String catalogItemId;
  final double quantity;
  final String? reason;
  final String? notes;
  @override
  Map<String, Object?> toJson() => {
    'catalogItemId': catalogItemId,
    'quantity': quantity,
    if (reason != null) 'reason': reason,
    if (notes != null) 'notes': notes,
  };
}

final class CustomerAcknowledgementOfflinePayload
    extends OfflineCommandPayload {
  const CustomerAcknowledgementOfflinePayload({
    required this.signerName,
    required this.contentHash,
    this.contactId,
    this.signatureStorageFileId,
  });
  final String signerName;
  final String contentHash;
  final String? contactId;
  final String? signatureStorageFileId;
  @override
  Map<String, Object?> toJson() => {
    'signerName': signerName,
    'contentHash': contentHash,
    if (contactId != null) 'contactId': contactId,
    if (signatureStorageFileId != null)
      'signatureStorageFileId': signatureStorageFileId,
  };
}

final class OfflineCommandEnvelope {
  const OfflineCommandEnvelope({
    required this.commandId,
    required this.idempotencyKey,
    required this.commandType,
    required this.aggregateId,
    required this.expectedVersion,
    required this.occurredAt,
    required this.payload,
    this.deviceInstanceId,
    this.clientContextVersion,
  });
  final String commandId;
  final String idempotencyKey;
  final OfflineCommandType commandType;
  final String aggregateId;
  final String expectedVersion;
  final DateTime occurredAt;
  final OfflineCommandPayload payload;
  final String? deviceInstanceId;
  final String? clientContextVersion;
  Map<String, Object?> toJson() => {
    'commandId': commandId,
    'idempotencyKey': idempotencyKey,
    'commandType': offlineCommandTypeToWire(commandType),
    'aggregateType': 'OPERATION',
    'aggregateId': aggregateId,
    'expectedVersion': expectedVersion,
    'occurredAt': occurredAt.toUtc().toIso8601String(),
    'payload': payload.toJson(),
    if (deviceInstanceId != null) 'deviceInstanceId': deviceInstanceId,
    if (clientContextVersion != null)
      'clientContextVersion': clientContextVersion,
  };
}

final class OfflineCommandConflict {
  const OfflineCommandConflict({
    required this.code,
    required this.message,
    required this.refreshRequired,
  });
  final String code;
  final String message;
  final bool refreshRequired;
  factory OfflineCommandConflict.fromJson(Map<String, Object?> json) =>
      OfflineCommandConflict(
        code: json['code']! as String,
        message: json['message']! as String,
        refreshRequired: json['refreshRequired']! as bool,
      );
}

final class OfflineCommandError {
  const OfflineCommandError({
    required this.code,
    required this.message,
    required this.retryable,
  });
  final String code;
  final String message;
  final bool retryable;
  factory OfflineCommandError.fromJson(Map<String, Object?> json) =>
      OfflineCommandError(
        code: json['code']! as String,
        message: json['message']! as String,
        retryable: json['retryable']! as bool,
      );
}

final class OfflineCommandResult {
  const OfflineCommandResult({
    required this.commandId,
    required this.commandType,
    required this.status,
    this.serverVersion,
    this.authoritativeResourceRef,
    this.conflict,
    this.error,
  });
  final String commandId;
  final String commandType;
  final OfflineCommandStatus status;
  final String? serverVersion;
  final String? authoritativeResourceRef;
  final OfflineCommandConflict? conflict;
  final OfflineCommandError? error;
  factory OfflineCommandResult.fromJson(Map<String, Object?> json) =>
      OfflineCommandResult(
        commandId: json['commandId']! as String,
        commandType: json['commandType']! as String,
        status: OfflineCommandStatus.values.byName(
          _statusName(json['status']! as String),
        ),
        serverVersion: json['serverVersion'] as String?,
        authoritativeResourceRef: json['authoritativeResourceRef'] as String?,
        conflict: json['conflict'] == null
            ? null
            : OfflineCommandConflict.fromJson(
                json['conflict']! as Map<String, Object?>,
              ),
        error: json['error'] == null
            ? null
            : OfflineCommandError.fromJson(
                json['error']! as Map<String, Object?>,
              ),
      );
}

String _statusName(String wire) => switch (wire) {
  'APPLIED' => 'applied',
  'ALREADY_APPLIED' => 'alreadyApplied',
  'CONFLICT' => 'conflict',
  'REJECTED' => 'rejected',
  'RETRYABLE_ERROR' => 'retryableError',
  'BLOCKED' => 'blocked',
  _ => throw FormatException('Unsupported offline command status: $wire'),
};

final class MobileSyncPushRequest {
  const MobileSyncPushRequest(this.commands, {this.checkpoint});
  final List<OfflineCommandEnvelope> commands;
  final String? checkpoint;
  Map<String, Object?> toJson() => {
    'commands': commands.map((item) => item.toJson()).toList(growable: false),
    if (checkpoint != null) 'checkpoint': checkpoint,
  };
}

final class MobileSyncCursor {
  const MobileSyncCursor(this.value);
  final String value;
}

final class FullResyncRequired {
  const FullResyncRequired();
}

final class FieldPackageContract {
  const FieldPackageContract({
    required this.packageId,
    required this.generatedAt,
    required this.serverCheckpoint,
    required this.kind,
    required this.allowedActionsAtGeneration,
    required this.versionTokens,
    required this.workItem,
    required this.context,
    this.expiresAt,
    this.operation,
    this.pmoc,
    this.rvt,
  });
  final String packageId;
  final DateTime generatedAt;
  final DateTime? expiresAt;
  final String serverCheckpoint;
  final String kind;
  final List<String> allowedActionsAtGeneration;
  final Map<String, String> versionTokens;
  final MobileWorkItemContract workItem;
  final OfflineFieldContextContract context;
  final Object? operation;
  final PmocFieldPackageContextContract? pmoc;
  final RvtFieldPackageContextContract? rvt;
}

final class FieldPackageTechnicalResponsibleContract {
  const FieldPackageTechnicalResponsibleContract({
    required this.required,
    this.userId,
  });
  final bool required;
  final String? userId;
}

final class FieldPackageEvidencePolicyContract {
  const FieldPackageEvidencePolicyContract({
    required this.acceptedKinds,
    this.blobsIncluded = false,
  });
  final List<String> acceptedKinds;
  final bool blobsIncluded;
}

final class PmocFieldPackageContextContract {
  const PmocFieldPackageContextContract({
    required this.cycle,
    required this.procedure,
    required this.technicalResponsible,
    required this.evidencePolicy,
    this.equipmentExecution,
  });
  final Map<String, Object?> cycle;
  final Map<String, Object?>? equipmentExecution;
  final Object? procedure;
  final FieldPackageTechnicalResponsibleContract technicalResponsible;
  final FieldPackageEvidencePolicyContract evidencePolicy;
}

final class RvtFieldPackageContextContract {
  const RvtFieldPackageContextContract({
    required this.occurrence,
    required this.procedure,
    required this.technicalResponsible,
    required this.customerAcknowledgementPolicy,
    required this.evidencePolicy,
    this.execution,
  });
  final Map<String, Object?> occurrence;
  final Map<String, Object?>? execution;
  final Object? procedure;
  final FieldPackageTechnicalResponsibleContract technicalResponsible;
  final Map<String, bool> customerAcknowledgementPolicy;
  final FieldPackageEvidencePolicyContract evidencePolicy;
}

final class OfflineProcedureContract {
  const OfflineProcedureContract({
    required this.id,
    required this.title,
    required this.status,
  });
  final String id;
  final String title;
  final String status;
}

final class OfflineFieldContextContract {
  const OfflineFieldContextContract({
    required this.workItem,
    required this.requestDescription,
    required this.procedures,
    required this.snapshotVersion,
  });
  final MobileWorkItemContract workItem;
  final String? requestDescription;
  final List<OfflineProcedureContract> procedures;
  final int snapshotVersion;
}

typedef OperationFieldPackage = FieldPackageContract;
typedef PmocFieldPackage = FieldPackageContract;
typedef RvtFieldPackage = FieldPackageContract;
