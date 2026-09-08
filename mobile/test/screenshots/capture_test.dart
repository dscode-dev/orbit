/// Capturas das telas reais, para olhar.
///
/// Não é teste de regressão: é o instrumento para julgar a interface. Roda com
/// `flutter test test/screenshots/capture_test.dart --update-goldens` e as
/// imagens saem em `test/screenshots/out/`.
library;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:orbit_operator/app/providers.dart';
import 'package:orbit_operator/core/config/environment.dart';
import 'package:orbit_operator/core/network/orbit_api_client.dart';
import 'package:orbit_operator/core/observability/orbit_logger.dart';
import 'package:orbit_operator/core/theme/orbit_theme.dart';
import 'package:orbit_operator/features/field/presentation/field_dashboard_screen.dart';
import 'package:orbit_operator/features/operations/data/operations_repository.dart';
import 'package:orbit_operator/features/operations/presentation/operations_screen.dart';
import 'package:orbit_operator/features/field/presentation/work_queue_screen.dart';
import 'package:orbit_operator/features/scheduling/presentation/agenda_screen.dart';

import '../support/fakes.dart';
import '../support/scripted_adapter.dart';
import 'harness.dart';
import 'package:orbit_operator/features/documents/presentation/documents_screen.dart';
import 'package:orbit_operator/features/profile/presentation/profile_screen.dart';
import 'package:orbit_operator/core/design/orbit_operational.dart';
import 'package:orbit_operator/features/field/presentation/operation_execution_screen.dart';
import 'package:orbit_operator/features/sync/application/sync_providers.dart';
import 'package:orbit_operator/features/sync/data/command_journal.dart';
import 'package:orbit_operator/features/sync/data/journal_file.dart';
import 'package:orbit_operator/features/sync/data/sync_projection.dart';

Map<String, dynamic> item({
  required String id,
  required String titulo,
  required String cliente,
  required String unidade,
  String dueState = 'DUE_TODAY',
  String status = 'SCHEDULED',
  String? quando = '2026-09-08T12:00:00.000Z',
  List<String> acoes = const ['VIEW', 'START'],
  List<Map<String, dynamic>> equipamentos = const [],
}) => {
  'id': 'SERVICE_OPERATION:$id',
  'kind': 'SERVICE_OPERATION',
  'sourceId': id,
  'title': titulo,
  'businessUnit': {'id': 'bu', 'name': unidade},
  'customer': {'id': 'c$id', 'name': cliente},
  'timezone': 'America/Recife',
  'scheduledFor': quando,
  'dueState': dueState,
  'operationalStatus': status,
  'auxiliaryTechnicians': const [],
  'equipmentSummary': equipamentos,
  'allowedActions': acoes,
  'navigationContext': {'kind': 'SERVICE_OPERATION', 'sourceId': id},
  'updatedAt': '2026-09-08T10:00:00.000Z',
};

Map<String, dynamic> doc({
  required String id,
  required String tipo,
  required String rotulo,
  required String cliente,
  String estado = 'AVAILABLE',
}) => {
  'artifactId': id,
  'documentType': tipo,
  'label': rotulo,
  'customerName': cliente,
  'createdAt': '2026-09-07T14:00:00.000Z',
  'state': estado,
};

final payloadRico = {
  'dashboard': {
    'next': item(
      id: '1',
      titulo: 'Manutenção preventiva — Chiller 40TR',
      cliente: 'Shopping Recife',
      unidade: 'Matriz',
      quando: '2026-09-08T12:30:00.000Z',
      equipamentos: const [
        {'id': 'e1', 'tag': 'CH-01', 'name': 'Chiller Carrier 40TR'},
      ],
    ),
    'counters': {'today': 6, 'overdue': 2, 'inProgress': 1, 'upcoming': 9},
    'today': [
      item(
        id: '1',
        titulo: 'Manutenção preventiva — Chiller 40TR',
        cliente: 'Shopping Recife',
        unidade: 'Matriz',
        quando: '2026-09-08T12:30:00.000Z',
      ),
      item(
        id: '2',
        titulo: 'Corretiva — Split não gela',
        cliente: 'Hospital Santa Joana',
        unidade: 'Matriz',
        quando: '2026-09-08T15:00:00.000Z',
      ),
      item(
        id: '3',
        titulo: 'PMOC trimestral — Casa de máquinas',
        cliente: 'Edifício Empresarial Norte',
        unidade: 'Filial Sul',
        quando: '2026-09-08T17:30:00.000Z',
      ),
    ],
    'overdue': [
      item(
        id: '9',
        titulo: 'Corretiva — Vazamento de gás',
        cliente: 'Frigorífico Boa Carne',
        unidade: 'Filial Sul',
        dueState: 'OVERDUE',
        quando: '2026-09-05T09:00:00.000Z',
      ),
    ],
    'inProgress': [
      item(
        id: '5',
        titulo: 'Instalação — VRF 8 evaporadoras',
        cliente: 'Clínica Vida',
        unidade: 'Matriz',
        status: 'IN_PROGRESS',
        dueState: 'IN_PROGRESS',
        acoes: const ['VIEW', 'RESUME'],
      ),
    ],
    'capabilities': {'canScanEquipment': true, 'canCreateAdHocRvt': true},
  },
  'recentDocuments': [
    doc(
      id: 'a1',
      tipo: 'SERVICE_ORDER',
      rotulo: 'Ordem de serviço 2026-0148',
      cliente: 'Shopping Recife',
    ),
    doc(
      id: 'a2',
      tipo: 'RVT',
      rotulo: 'Relatório de visita técnica',
      cliente: 'Hospital Santa Joana',
    ),
  ],
  'recentAppointments': const [],
};

Widget host(Map<String, dynamic> payload, Widget tela, {bool profile = false}) {
  Future<ResponseBody> handler(RequestOptions options) async =>
      jsonResponse({'success': true, 'data': payload});

  final dio = Dio()..httpClientAdapter = ScriptedAdapter(handler);
  final plain = Dio()..httpClientAdapter = ScriptedAdapter(handler);
  final client = OrbitApiClient.create(
    environment: OrbitEnvironment.fromDefines(),
    storage: InMemoryTokenStorage(),
    logger: const OrbitLogger(isProduction: true),
    dio: dio,
    retryDio: plain,
  );

  return ProviderScope(
    overrides: [
      apiClientProvider.overrideWithValue(client),
      readCacheProvider.overrideWithValue(InMemoryReadCache()),
      if (profile) sessionProvider.overrideWithValue(sessionFrom()),
      commandJournalProvider.overrideWithValue(
        CommandJournal(file: MemoryJournalFile()),
      ),
      syncProjectionProvider.overrideWithValue(
        SyncProjectionStore(file: MemoryJournalFile()),
      ),
    ],
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: OrbitTheme.light(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: TextScaler.linear(captureScale)),
        child: child!,
      ),
      home: Scaffold(
        body: tela,
        bottomNavigationBar: OrbitBottomNav(
          selected: tela is DocumentsScreen
              ? 3
              : tela is ProfileScreen
              ? 4
              : tela is AgendaScreen
              ? 2
              : tela is WorkQueueScreen
              ? 1
              : 0,
          onSelect: (_) {},
          items: const [
            (
              label: 'Início',
              icon: Icons.home_outlined,
              selectedIcon: Icons.home,
            ),
            (
              label: 'Atendimentos',
              icon: Icons.checklist_rtl_outlined,
              selectedIcon: Icons.checklist_rtl,
            ),
            (
              label: 'Agenda',
              icon: Icons.calendar_today_outlined,
              selectedIcon: Icons.calendar_today,
            ),
            (
              label: 'Documentos',
              icon: Icons.description_outlined,
              selectedIcon: Icons.description,
            ),
            (
              label: 'Perfil',
              icon: Icons.person_outline,
              selectedIcon: Icons.person,
            ),
          ],
        ),
      ),
    ),
  );
}

void main() {
  for (final width in [320.0, 375.0, 390.0, 430.0]) {
    for (final scale in [1.0, 1.3, 1.5, 2.0]) {
      group('${width.toInt()}px ${scale}x', () {
        setUp(() {
          captureWidth = width;
          captureScale = scale;
        });
        registerCaptures();
      });
    }
  }
}

void registerCaptures() {
  setUpAll(() async => initializeDateFormatting('pt_BR'));

  testWidgets('documentos', (tester) async {
    await carregarFontes();
    prepararTela(tester);
    await tester.pumpWidget(
      host({
        'data': payloadRico['recentDocuments'],
        'meta': {'limit': 20, 'hasNextPage': false, 'nextCursor': null},
      }, const DocumentsScreen()),
    );
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile(
        'out/${captureWidth.toInt()}_${captureScale}/05_documentos.png',
      ),
    );
  });

  testWidgets('perfil', (tester) async {
    await carregarFontes();
    prepararTela(tester);
    await tester.pumpWidget(host({}, const ProfileScreen(), profile: true));
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile(
        'out/${captureWidth.toInt()}_${captureScale}/06_perfil.png',
      ),
    );
  });

  testWidgets('wizard', (tester) async {
    await carregarFontes();
    prepararTela(tester);
    await tester.pumpWidget(
      host({
        'operation': {
          'id': 'op-1',
          'code': 'OS-024',
          'title': 'Manutenção preventiva',
          'status': 'SCHEDULED',
          'priority': 'NORMAL',
        },
        'customer': {'id': 'customer-1', 'name': 'Clínica Santa Maria'},
        'equipment': <Map<String, dynamic>>[],
        'auxiliaryTechnicians': <Map<String, dynamic>>[],
        'checklist': <Map<String, dynamic>>[],
        'materialPolicy': {'enabled': true},
        'allowedTransitions': ['IN_PROGRESS'],
        'allowedActions': ['START'],
        'primaryAction': 'START',
        'version': '2026-09-08T12:00:00.000Z',
        'executionEligibility': {'eligible': true, 'blockers': <String>[]},
      }, const OperationExecutionScreen(operationId: 'op-1')),
    );
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile(
        'out/${captureWidth.toInt()}_${captureScale}/07_wizard.png',
      ),
    );
  });

  testWidgets('dashboard de campo', (tester) async {
    await carregarFontes();
    prepararTela(tester);

    await tester.pumpWidget(host(payloadRico, const FieldDashboardScreen()));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile(
        'out/${captureWidth.toInt()}_${captureScale}/01_field_dashboard.png',
      ),
    );
  });

  testWidgets('lista de servicos', (tester) async {
    await carregarFontes();
    prepararTela(tester);

    Map<String, dynamic> op(
      String id,
      String titulo,
      String status,
      String prioridade,
      String quando,
    ) => {
      'id': id,
      'code': 'OP-${id.padLeft(4, '0')}',
      'title': titulo,
      'status': status,
      'kind': 'MAINTENANCE',
      'priority': prioridade,
      'scheduledStart': quando,
      'users': const [],
      'attachments': const [],
      'checklistExecutions': const [],
    };

    final dados = [
      op(
        '1',
        'Manutencao preventiva - Chiller 40TR',
        'IN_PROGRESS',
        'HIGH',
        '2026-09-08T12:30:00.000Z',
      ),
      op(
        '2',
        'Corretiva - Split nao gela',
        'SCHEDULED',
        'URGENT',
        '2026-09-08T15:00:00.000Z',
      ),
      op(
        '3',
        'PMOC trimestral - Casa de maquinas',
        'SCHEDULED',
        'MEDIUM',
        '2026-09-08T17:30:00.000Z',
      ),
      op(
        '4',
        'Instalacao - VRF 8 evaporadoras',
        'COMPLETED',
        'LOW',
        '2026-09-06T11:00:00.000Z',
      ),
    ];

    Future<ResponseBody> handler(RequestOptions options) async => jsonResponse({
      'success': true,
      'data': {
        'data': dados,
        'meta': {
          'page': 1,
          'limit': 20,
          'total': dados.length,
          'totalPages': 1,
          'hasNextPage': false,
          'hasPreviousPage': false,
        },
      },
    });

    final dio = Dio()..httpClientAdapter = ScriptedAdapter(handler);
    final plain = Dio()..httpClientAdapter = ScriptedAdapter(handler);
    final client = OrbitApiClient.create(
      environment: OrbitEnvironment.fromDefines(),
      storage: InMemoryTokenStorage(),
      logger: const OrbitLogger(isProduction: true),
      dio: dio,
      retryDio: plain,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          operationsRepositoryProvider.overrideWithValue(
            OperationsRepository(client: client, cache: InMemoryReadCache()),
          ),
        ],
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: OrbitTheme.light(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(captureScale)),
            child: child!,
          ),
          home: const OperationsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile(
        'out/${captureWidth.toInt()}_${captureScale}/02_servicos.png',
      ),
    );
  });

  testWidgets('fila de trabalho', (tester) async {
    await carregarFontes();
    prepararTela(tester);

    final fila = {
      'data': [
        item(
          id: '1',
          titulo: 'Manutenção preventiva — Chiller 40TR',
          cliente: 'Shopping Recife',
          unidade: 'Matriz',
        ),
        item(
          id: '9',
          titulo: 'Corretiva — Vazamento de gás',
          cliente: 'Frigorífico Boa Carne',
          unidade: 'Filial Sul',
          dueState: 'OVERDUE',
          quando: '2026-09-05T09:00:00.000Z',
        ),
        item(
          id: '3',
          titulo: 'PMOC trimestral — Casa de máquinas',
          cliente: 'Edifício Empresarial Norte',
          unidade: 'Filial Sul',
        ),
      ],
      'nextCursor': null,
    };

    await tester.pumpWidget(host(fila, const WorkQueueScreen()));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile(
        'out/${captureWidth.toInt()}_${captureScale}/03_fila.png',
      ),
    );
  });

  testWidgets('agenda', (tester) async {
    await carregarFontes();
    prepararTela(tester);

    Map<String, dynamic> evento(
      String id,
      String titulo,
      String inicio,
      String fim,
      String prioridade,
    ) => {
      'occurrenceId': id,
      'eventId': id,
      'title': titulo,
      'startsAt': inicio,
      'endsAt': fim,
      'status': 'SCHEDULED',
      'priority': prioridade,
      'type': 'SERVICE',
    };

    final agenda = {
      'view': 'DAY',
      'range': {'start': '2026-09-08', 'end': '2026-09-08'},
      'summary': {'total': 3, 'hoursAllocated': 6.5},
      'days': [
        {
          'date': '2026-09-08',
          'events': [
            evento(
              'e1',
              'Shopping Recife — Manutenção preventiva Chiller 40TR',
              '2026-09-08T12:30:00.000Z',
              '2026-09-08T14:00:00.000Z',
              'HIGH',
            ),
            evento(
              'e2',
              'Hospital Santa Joana — Corretiva, split não gela',
              '2026-09-08T15:00:00.000Z',
              '2026-09-08T16:30:00.000Z',
              'URGENT',
            ),
            evento(
              'e3',
              'Edifício Empresarial Norte — PMOC trimestral',
              '2026-09-08T17:30:00.000Z',
              '2026-09-08T19:00:00.000Z',
              'NORMAL',
            ),
          ],
        },
      ],
      'generatedAt': '2026-09-08T10:00:00.000Z',
    };

    await tester.pumpWidget(host(agenda, const AgendaScreen()));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile(
        'out/${captureWidth.toInt()}_${captureScale}/04_agenda.png',
      ),
    );
  });
}
