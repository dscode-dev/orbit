/// Public contracts for authenticated Equipment QR field resolution.
///
/// The QR token is a physical lookup key, never an authorization grant. Mobile
/// must render only `allowedActions` returned by the backend.
enum EquipmentFieldAction {
  viewDetails,
  startServiceOrder,
  executePmoc,
  addToRvt,
  viewHistory,
}

class EquipmentPmocContextContract {
  const EquipmentPmocContextContract({
    required this.planId,
    required this.planName,
    required this.eligible,
    this.cycleId,
    this.dueOn,
    this.blockedReason,
  });

  final String planId;
  final String planName;
  final String? cycleId;
  final DateTime? dueOn;
  final bool eligible;
  final String? blockedReason;
}

class EquipmentQrResolvedContract {
  const EquipmentQrResolvedContract({
    required this.id,
    required this.code,
    required this.name,
    required this.type,
    required this.status,
    required this.allowedActions,
    required this.pmocContexts,
    this.brand,
    this.model,
    this.serialNumber,
    this.serviceLocation,
  });

  final String id;
  final String code;
  final String name;
  final String type;
  final String status;
  final String? brand;
  final String? model;
  final String? serialNumber;
  final String? serviceLocation;
  final List<EquipmentFieldAction> allowedActions;
  final List<EquipmentPmocContextContract> pmocContexts;
}

class EquipmentServiceOrderPreparationContract {
  const EquipmentServiceOrderPreparationContract({
    required this.equipmentId,
    required this.businessUnitId,
    required this.operationCreated,
    this.customerId,
    this.address,
    this.serviceLocation,
  });

  final String equipmentId;
  final String businessUnitId;
  final String? customerId;
  final Map<String, Object?>? address;
  final String? serviceLocation;
  final bool operationCreated;
}

class RvtAddExistingEquipmentContextContract {
  const RvtAddExistingEquipmentContextContract({
    required this.executionId,
    required this.equipmentId,
  });

  final String executionId;
  final String equipmentId;
}

