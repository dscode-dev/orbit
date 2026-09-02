/// Contratos públicos da projeção de campo (MB-01).
///
/// Espelham `mobile-field.read-models.ts`. O backend entrega o item de
/// trabalho **já classificado, ordenado e autorizado**: `dueState` diz se está
/// atrasado, `allowedActions` diz o que pode ser feito, e a ordem da lista é a
/// dele. Este arquivo desserializa; não interpreta.
///
/// Códigos desconhecidos viram `null` e a linha é descartada pelo chamador —
/// nunca `crash`, e nunca um valor inventado para preencher o buraco.
library;

enum MobileWorkItemKind { serviceOperation, pmoc, rvt }

MobileWorkItemKind? mobileWorkItemKindFrom(String? value) => switch (value) {
  'SERVICE_OPERATION' => MobileWorkItemKind.serviceOperation,
  'PMOC' => MobileWorkItemKind.pmoc,
  'RVT' => MobileWorkItemKind.rvt,
  _ => null,
};

enum MobileDueState { inProgress, overdue, dueToday, upcoming, unscheduled }

/// A classificação de prazo **vem pronta**. O app não compara datas para
/// chegar a "atrasado": quem sabe que horas são na unidade é o servidor.
MobileDueState? mobileDueStateFrom(String? value) => switch (value) {
  'IN_PROGRESS' => MobileDueState.inProgress,
  'OVERDUE' => MobileDueState.overdue,
  'DUE_TODAY' => MobileDueState.dueToday,
  'UPCOMING' => MobileDueState.upcoming,
  'UNSCHEDULED' => MobileDueState.unscheduled,
  _ => null,
};

enum MobileFieldAction {
  view,
  openRoute,
  callContact,
  whatsappContact,
  start,
  resume,
  complete,
  addEvidence,
  viewDocument,
  downloadDocument,
  executePmoc,
  executeRvt,
  scanEquipment,
}

/// Ação publicada em `allowedActions` / `primaryAction`.
///
/// Devolve `null` para código que esta versão do app não conhece. Uma ação sem
/// nome claro não deve virar botão: convida ao toque sem dizer o que faz.
MobileFieldAction? mobileFieldActionFrom(String? value) => switch (value) {
  'VIEW' => MobileFieldAction.view,
  'OPEN_ROUTE' => MobileFieldAction.openRoute,
  'CALL_CONTACT' => MobileFieldAction.callContact,
  'WHATSAPP_CONTACT' => MobileFieldAction.whatsappContact,
  'START' => MobileFieldAction.start,
  'RESUME' => MobileFieldAction.resume,
  'COMPLETE' => MobileFieldAction.complete,
  'ADD_EVIDENCE' => MobileFieldAction.addEvidence,
  'VIEW_DOCUMENT' => MobileFieldAction.viewDocument,
  'DOWNLOAD_DOCUMENT' => MobileFieldAction.downloadDocument,
  'EXECUTE_PMOC' => MobileFieldAction.executePmoc,
  'EXECUTE_RVT' => MobileFieldAction.executeRvt,
  'SCAN_EQUIPMENT' => MobileFieldAction.scanEquipment,
  _ => null,
};

class MobilePartySummaryContract {
  const MobilePartySummaryContract({required this.id, required this.name});

  factory MobilePartySummaryContract.fromJson(Map<String, dynamic> json) =>
      MobilePartySummaryContract(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
      );

  final String id;
  final String name;
}

class MobileContactSummaryContract {
  const MobileContactSummaryContract({
    required this.name,
    this.phone,
    this.email,
  });

  factory MobileContactSummaryContract.fromJson(Map<String, dynamic> json) =>
      MobileContactSummaryContract(
        name: json['name'] as String? ?? '',
        phone: json['phone'] as String?,
        email: json['email'] as String?,
      );

  final String name;
  final String? phone;
  final String? email;
}

class MobileCustomerSummaryContract extends MobilePartySummaryContract {
  const MobileCustomerSummaryContract({
    required super.id,
    required super.name,
    this.address,
    this.contact,
  });

  factory MobileCustomerSummaryContract.fromJson(Map<String, dynamic> json) =>
      MobileCustomerSummaryContract(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        address: json['address'] as Map<String, dynamic>?,
        contact: json['contact'] == null
            ? null
            : MobileContactSummaryContract.fromJson(
                json['contact'] as Map<String, dynamic>,
              ),
      );

  /// Endereço é JSON livre no backend; a tela lê o que reconhecer.
  final Map<String, Object?>? address;
  final MobileContactSummaryContract? contact;
}

class MobileEquipmentSummaryContract {
  const MobileEquipmentSummaryContract({
    required this.id,
    required this.name,
    required this.type,
    required this.status,
    required this.qrAvailable,
    this.code,
    this.brand,
    this.model,
    this.sector,
  });

  factory MobileEquipmentSummaryContract.fromJson(Map<String, dynamic> json) =>
      MobileEquipmentSummaryContract(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        type: json['type'] as String? ?? '',
        status: json['status'] as String? ?? '',
        qrAvailable: json['qrAvailable'] as bool? ?? false,
        code: json['code'] as String?,
        brand: json['brand'] as String?,
        model: json['model'] as String?,
        sector: json['sector'] as String?,
      );

  final String id;
  final String? code;
  final String name;
  final String type;
  final String? brand;
  final String? model;
  final String? sector;
  final String status;
  final bool qrAvailable;
}

class MobileArtifactSummaryContract {
  const MobileArtifactSummaryContract({
    required this.id,
    required this.type,
    required this.status,
    required this.previewAvailable,
    required this.downloadAvailable,
  });

  factory MobileArtifactSummaryContract.fromJson(Map<String, dynamic> json) =>
      MobileArtifactSummaryContract(
        id: json['id'] as String? ?? '',
        type: json['type'] as String? ?? '',
        status: json['status'] as String? ?? '',
        previewAvailable: json['previewAvailable'] as bool? ?? false,
        downloadAvailable: json['downloadAvailable'] as bool? ?? false,
      );

  final String id;
  final String type;
  final String status;
  final bool previewAvailable;
  final bool downloadAvailable;
}

class MobileNavigationContextContract {
  const MobileNavigationContextContract({
    required this.kind,
    required this.sourceId,
    this.executionId,
    this.occurrenceId,
    this.cycleId,
    this.equipmentId,
  });

  /// `null` quando o tipo de item não é conhecido por esta versão do app.
  static MobileNavigationContextContract? fromJson(Map<String, dynamic> json) {
    final kind = mobileWorkItemKindFrom(json['kind'] as String?);
    if (kind == null) return null;
    return MobileNavigationContextContract(
      kind: kind,
      sourceId: json['sourceId'] as String? ?? '',
      executionId: json['executionId'] as String?,
      occurrenceId: json['occurrenceId'] as String?,
      cycleId: json['cycleId'] as String?,
      equipmentId: json['equipmentId'] as String?,
    );
  }

  final MobileWorkItemKind kind;
  final String sourceId;
  final String? executionId;
  final String? occurrenceId;
  final String? cycleId;
  final String? equipmentId;
}

class MobileWorkItemContract {
  const MobileWorkItemContract({
    required this.id,
    required this.kind,
    required this.sourceId,
    required this.title,
    required this.businessUnit,
    required this.timezone,
    required this.dueState,
    required this.operationalStatus,
    required this.responsibleFieldTechnician,
    required this.auxiliaryTechnicians,
    required this.equipmentSummary,
    required this.artifacts,
    required this.allowedActions,
    required this.navigationContext,
    required this.updatedAt,
    this.schedulingId,
    this.description,
    this.customer,
    this.location,
    this.scheduledFor,
    this.scheduledEnd,
    this.priority,
    this.primaryAction,
  });

  /// Identidade canônica do item, **opaca**.
  ///
  /// O backend a compõe (`SERVICE_OPERATION:<id>`, `PMOC:<ciclo>:<equip>`,
  /// `RVT:<ocorrência>`). O app usa como chave e a devolve na navegação —
  /// nunca a decompõe: para saber o tipo existe `kind`, e para navegar existe
  /// `navigationContext`.
  final String id;
  final MobileWorkItemKind kind;
  final String sourceId;
  final String? schedulingId;
  final String title;
  final String? description;
  final MobilePartySummaryContract businessUnit;
  final MobileCustomerSummaryContract? customer;
  final Map<String, Object?>? location;
  final DateTime? scheduledFor;
  final DateTime? scheduledEnd;
  final String timezone;
  final MobileDueState dueState;
  final String operationalStatus;
  final String? priority;
  final MobilePartySummaryContract? responsibleFieldTechnician;
  final List<MobilePartySummaryContract> auxiliaryTechnicians;
  final List<MobileEquipmentSummaryContract> equipmentSummary;
  final List<MobileArtifactSummaryContract> artifacts;
  final List<MobileFieldAction> allowedActions;
  final MobileFieldAction? primaryAction;
  final MobileNavigationContextContract navigationContext;
  final DateTime updatedAt;

  /// Um item cujo tipo, prazo ou contexto o app não entende é descartado.
  ///
  /// Descartar é mais honesto que adivinhar: um item sem classificação
  /// apareceria fora de ordem, e um sem contexto não levaria a lugar nenhum.
  static MobileWorkItemContract? fromJson(Map<String, dynamic> json) {
    final kind = mobileWorkItemKindFrom(json['kind'] as String?);
    final dueState = mobileDueStateFrom(json['dueState'] as String?);
    final navigation = MobileNavigationContextContract.fromJson(
      json['navigationContext'] as Map<String, dynamic>? ?? const {},
    );
    if (kind == null || dueState == null || navigation == null) return null;

    return MobileWorkItemContract(
      id: json['id'] as String? ?? '',
      kind: kind,
      sourceId: json['sourceId'] as String? ?? '',
      schedulingId: json['schedulingId'] as String?,
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      businessUnit: MobilePartySummaryContract.fromJson(
        json['businessUnit'] as Map<String, dynamic>? ?? const {},
      ),
      customer: json['customer'] == null
          ? null
          : MobileCustomerSummaryContract.fromJson(
              json['customer'] as Map<String, dynamic>,
            ),
      location: json['location'] as Map<String, dynamic>?,
      scheduledFor: DateTime.tryParse(json['scheduledFor'] as String? ?? ''),
      scheduledEnd: DateTime.tryParse(json['scheduledEnd'] as String? ?? ''),
      timezone: json['timezone'] as String? ?? '',
      dueState: dueState,
      operationalStatus: json['operationalStatus'] as String? ?? '',
      priority: json['priority'] as String?,
      responsibleFieldTechnician: json['responsibleFieldTechnician'] == null
          ? null
          : MobilePartySummaryContract.fromJson(
              json['responsibleFieldTechnician'] as Map<String, dynamic>,
            ),
      auxiliaryTechnicians:
          (json['auxiliaryTechnicians'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(MobilePartySummaryContract.fromJson)
              .toList(growable: false),
      equipmentSummary: (json['equipmentSummary'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(MobileEquipmentSummaryContract.fromJson)
          .toList(growable: false),
      artifacts: (json['artifacts'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(MobileArtifactSummaryContract.fromJson)
          .toList(growable: false),

      /// Ação desconhecida some da lista em vez de virar botão sem nome.
      allowedActions: (json['allowedActions'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .map(mobileFieldActionFrom)
          .whereType<MobileFieldAction>()
          .toList(growable: false),
      primaryAction: mobileFieldActionFrom(json['primaryAction'] as String?),
      navigationContext: navigation,
      updatedAt:
          DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
    );
  }
}

class MobileFieldCountersContract {
  const MobileFieldCountersContract({
    required this.today,
    required this.overdue,
    required this.inProgress,
    required this.upcoming,
  });
  factory MobileFieldCountersContract.fromJson(Map<String, dynamic> json) =>
      MobileFieldCountersContract(
        today: (json['today'] as num?)?.toInt() ?? 0,
        overdue: (json['overdue'] as num?)?.toInt() ?? 0,
        inProgress: (json['inProgress'] as num?)?.toInt() ?? 0,
        upcoming: (json['upcoming'] as num?)?.toInt() ?? 0,
      );

  /// Contagens do servidor. O app **não** as recalcula percorrendo a fila —
  /// a fila é paginada, e somar o que está em mãos daria outro número.
  final int today;
  final int overdue;
  final int inProgress;
  final int upcoming;
}

class MobileFieldDashboardContract {
  const MobileFieldDashboardContract({
    required this.counters,
    required this.today,
    required this.overdue,
    required this.inProgress,
    required this.canScanEquipment,
    required this.canCreateAdHocRvt,
    this.next,
  });
  factory MobileFieldDashboardContract.fromJson(Map<String, dynamic> json) {
    final capabilities =
        json['capabilities'] as Map<String, dynamic>? ?? const {};
    return MobileFieldDashboardContract(
      next: json['next'] == null
          ? null
          : MobileWorkItemContract.fromJson(
              json['next'] as Map<String, dynamic>,
            ),
      counters: MobileFieldCountersContract.fromJson(
        json['counters'] as Map<String, dynamic>? ?? const {},
      ),
      today: _items(json['today']),
      overdue: _items(json['overdue']),
      inProgress: _items(json['inProgress']),
      canScanEquipment: capabilities['canScanEquipment'] as bool? ?? false,
      canCreateAdHocRvt: capabilities['canCreateAdHocRvt'] as bool? ?? false,
    );
  }

  /// O próximo item é escolha **do servidor**, não do app.
  final MobileWorkItemContract? next;
  final MobileFieldCountersContract counters;
  final List<MobileWorkItemContract> today;
  final List<MobileWorkItemContract> overdue;
  final List<MobileWorkItemContract> inProgress;
  final bool canScanEquipment;
  final bool canCreateAdHocRvt;
}

class MobileWorkQueuePageContract {
  const MobileWorkQueuePageContract({
    required this.data,
    required this.limit,
    required this.hasNextPage,
    this.nextCursor,
  });
  factory MobileWorkQueuePageContract.fromJson(Map<String, dynamic> json) {
    final meta = json['meta'] as Map<String, dynamic>? ?? const {};
    return MobileWorkQueuePageContract(
      data: _items(json['data']),
      limit: (meta['limit'] as num?)?.toInt() ?? 0,
      nextCursor: meta['nextCursor'] as String?,
      hasNextPage: meta['hasNextPage'] as bool? ?? false,
    );
  }

  /// **Na ordem do servidor.** Reordenar aqui recriaria a regra de prioridade
  /// que o backend já aplicou — e as duas divergiriam na primeira mudança.
  final List<MobileWorkItemContract> data;
  final int limit;
  final String? nextCursor;
  final bool hasNextPage;
}

List<MobileWorkItemContract> _items(Object? value) =>
    (value as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(MobileWorkItemContract.fromJson)
        .whereType<MobileWorkItemContract>()
        .toList(growable: false);

/// Um procedimento previsto para o item.
class MobileProcedureContract {
  const MobileProcedureContract({
    required this.id,
    required this.title,
    required this.status,
  });

  factory MobileProcedureContract.fromJson(Map<String, dynamic> json) =>
      MobileProcedureContract(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        status: json['status'] as String? ?? '',
      );

  final String id;
  final String title;
  final String status;
}

/// Resumo financeiro, quando o contrato o publica para este item.
class MobileFinancialSummaryContract {
  const MobileFinancialSummaryContract({
    required this.currency,
    this.approvedAmount,
    this.paymentStatus,
  });

  factory MobileFinancialSummaryContract.fromJson(Map<String, dynamic> json) =>
      MobileFinancialSummaryContract(
        currency: json['currency'] as String? ?? 'BRL',
        approvedAmount: json['approvedAmount'] as String?,
        paymentStatus: json['paymentStatus'] as String?,
      );

  final String currency;
  final String? approvedAmount;
  final String? paymentStatus;
}

/// O contexto consolidado de um item (`GET /mobile/field/work-items/:id`).
///
/// **Uma consulta.** Traz o item, a descrição do chamado, os procedimentos, os
/// documentos e o resumo financeiro. Montar isso a partir de várias APIs
/// reconstruiria no aparelho o recorte que o servidor já fez — e cada pedaço
/// chegaria de um instante diferente.
class MobileFieldContextContract {
  const MobileFieldContextContract({
    required this.workItem,
    required this.procedures,
    required this.documentContext,
    required this.snapshotVersion,
    this.requestDescription,
    this.financialSummary,
  });

  static MobileFieldContextContract? fromJson(Map<String, dynamic> json) {
    final workItem = MobileWorkItemContract.fromJson(
      json['workItem'] as Map<String, dynamic>? ?? const {},
    );
    if (workItem == null) return null;

    final request = json['request'] as Map<String, dynamic>?;
    final financial = json['financialSummary'] as Map<String, dynamic>?;

    return MobileFieldContextContract(
      workItem: workItem,
      requestDescription: request?['description'] as String?,
      procedures: (json['procedures'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(MobileProcedureContract.fromJson)
          .toList(growable: false),
      documentContext: (json['documentContext'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(MobileArtifactSummaryContract.fromJson)
          .toList(growable: false),
      financialSummary: financial == null
          ? null
          : MobileFinancialSummaryContract.fromJson(financial),
      snapshotVersion: (json['snapshotVersion'] as num?)?.toInt() ?? 1,
    );
  }

  final MobileWorkItemContract workItem;

  /// O que o cliente pediu, quando existe.
  final String? requestDescription;
  final List<MobileProcedureContract> procedures;
  final List<MobileArtifactSummaryContract> documentContext;
  final MobileFinancialSummaryContract? financialSummary;
  final int snapshotVersion;
}
