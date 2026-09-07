/// A tela inicial de quem trabalha em campo.
///
/// O que os testes cobram é o que a tela promete: responder "o que eu preciso
/// fazer agora" sem inventar dado, sem mostrar seção vazia e sem traduzir enum
/// por conta própria.
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

import '../support/fakes.dart';
import '../support/scripted_adapter.dart';

Map<String, dynamic> workItem({
  String id = 'SERVICE_OPERATION:1',
  String kind = 'SERVICE_OPERATION',
  String dueState = 'DUE_TODAY',
  String customer = 'Cliente Teste',
  String? scheduledFor = '2026-09-01T12:00:00.000Z',
}) => {
  'id': id,
  'kind': kind,
  'sourceId': '1',
  'title': 'Atendimento',
  'businessUnit': {'id': 'bu', 'name': 'Matriz'},
  'customer': {'id': 'c1', 'name': customer},
  'timezone': 'America/Recife',
  'scheduledFor': scheduledFor,
  'dueState': dueState,
  'operationalStatus': 'SCHEDULED',
  'auxiliaryTechnicians': const [],
  'equipmentSummary': const [],
  'allowedActions': const ['VIEW'],
  'navigationContext': {'kind': kind, 'sourceId': '1'},
  'updatedAt': '2026-09-01T12:00:00.000Z',
};

Map<String, dynamic> home({
  List<Map<String, dynamic>> today = const [],
  List<Map<String, dynamic>> overdue = const [],
  List<Map<String, dynamic>> inProgress = const [],
  Map<String, dynamic>? next,
  List<Map<String, dynamic>> documents = const [],
  List<Map<String, dynamic>> appointments = const [],
  bool canScan = false,
  Map<String, int> counters = const {},
}) => {
  'dashboard': {
    'next': next,
    'counters': {
      'today': counters['today'] ?? today.length,
      'overdue': counters['overdue'] ?? overdue.length,
      'inProgress': counters['inProgress'] ?? inProgress.length,
      'upcoming': counters['upcoming'] ?? 0,
    },
    'today': today,
    'overdue': overdue,
    'inProgress': inProgress,
    'capabilities': {
      'canScanEquipment': canScan,
      'canCreateAdHocRvt': false,
    },
  },
  'recentDocuments': documents,
  'recentAppointments': appointments,
};

Map<String, dynamic> document({
  String id = 'a1',
  String type = 'SERVICE_ORDER',
  String label = 'Ordem de serviço',
  String? customer = 'Cliente do Documento',
  String state = 'AVAILABLE',
}) => {
  'artifactId': id,
  'documentType': type,
  'label': label,
  'customerName': customer,
  'createdAt': '2026-09-01T14:00:00.000Z',
  'state': state,
};

Widget host(
  Map<String, dynamic> payload, {
  double textScale = 1.0,
  double width = 390,
  int status = 200,
}) {
  Future<ResponseBody> handler(RequestOptions options) async => jsonResponse(
    status == 200
        ? {'success': true, 'data': payload}
        : {
            'success': false,
            'error': {
              'code': 'INTERNAL_ERROR',
              'status': status,
              'message': 'Falhou.',
            },
          },
    status: status,
  );

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
    ],
    child: MediaQuery(
      data: MediaQueryData(
        textScaler: TextScaler.linear(textScale),
        size: Size(width, 800),
      ),
      child: MaterialApp(
        theme: OrbitTheme.light(),
        home: const FieldDashboardScreen(),
      ),
    ),
  );
}

void main() {
  setUpAll(() async => initializeDateFormatting('pt_BR'));

  Object? layoutError;
  setUp(() {
    layoutError = null;
    FlutterError.onError = (details) => layoutError ??= details.exception;
  });
  tearDown(() => FlutterError.onError = FlutterError.presentError);

  testWidgets('abre com saudação e data, e não com contadores', (tester) async {
    await tester.pumpWidget(host(home(today: [workItem()])));
    await tester.pumpAndSettle();

    expect(find.textContaining(RegExp('Bom dia|Boa tarde|Boa noite')),
        findsOneWidget);

    /// A versão anterior abria com quatro números soltos. Contador informa;
    /// ele não diz o que fazer.
    expect(find.text('Em andamento'), findsNothing);
    expect(find.text('Próximos'), findsNothing);
  });

  testWidgets('seção vazia não aparece', (tester) async {
    await tester.pumpWidget(host(home(today: [workItem()])));
    await tester.pumpAndSettle();

    expect(find.text('HOJE'), findsOneWidget);
    expect(find.text('ATRASADOS'), findsNothing);
    expect(find.text('DOCUMENTOS RECENTES'), findsNothing);
    expect(find.text('AGENDAMENTOS RECENTES'), findsNothing);
  });

  testWidgets('a contagem do servidor acompanha o título quando é maior', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        home(
          overdue: [workItem(id: 'a', dueState: 'OVERDUE')],
          counters: const {'overdue': 7},
        ),
      ),
    );
    await tester.pumpAndSettle();

    /// Cinco linhas com "12" no rótulo é honesto; inventar doze linhas não.
    expect(find.text('ATRASADOS · 7'), findsOneWidget);
  });

  testWidgets('em andamento vem antes de tudo', (tester) async {
    await tester.pumpWidget(
      host(
        home(
          inProgress: [workItem(id: 'x', dueState: 'IN_PROGRESS')],
          overdue: [workItem(id: 'y', dueState: 'OVERDUE')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    final andamento = tester.getTopLeft(find.text('EM ANDAMENTO')).dy;
    final atrasados = tester.getTopLeft(find.text('ATRASADOS')).dy;
    expect(andamento, lessThan(atrasados));
  });

  testWidgets('o próximo não se repete quando já está em andamento', (
    tester,
  ) async {
    final item = workItem(id: 'mesmo', dueState: 'IN_PROGRESS');
    await tester.pumpWidget(host(home(inProgress: [item], next: item)));
    await tester.pumpAndSettle();

    expect(find.text('PRÓXIMO ATENDIMENTO'), findsNothing);
  });

  testWidgets('documentos recentes usam o rótulo que o servidor mandou', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        home(
          documents: [
            document(),
            document(id: 'a2', type: 'RVT', label: 'RVT', state: 'PREPARING'),
            document(id: 'a3', type: 'PMOC', label: 'PMOC', state: 'FAILED'),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('DOCUMENTOS RECENTES'), findsOneWidget);
    expect(find.text('Ordem de serviço'), findsOneWidget);

    /// O que ainda está sendo gerado diz isso — nunca oferece um arquivo que
    /// não existe. E o que falhou diz que falhou: preparando resolve sozinho,
    /// falhou não.
    expect(find.text('Preparando'), findsOneWidget);
    expect(find.text('Falhou'), findsOneWidget);

    /// Nenhum código de domínio na tela.
    expect(find.textContaining('SERVICE_ORDER'), findsNothing);
    expect(find.textContaining('AVAILABLE'), findsNothing);
  });

  testWidgets('ler etiqueta só aparece quando o servidor permite', (
    tester,
  ) async {
    await tester.pumpWidget(host(home(today: [workItem()])));
    await tester.pumpAndSettle();
    expect(find.text('Ler etiqueta'), findsNothing);

    await tester.pumpWidget(host(home(today: [workItem()], canScan: true)));
    await tester.pumpAndSettle();
    expect(find.text('Ler etiqueta'), findsOneWidget);
  });

  testWidgets('as ações rápidas cabem e são alcançáveis', (tester) async {
    await tester.pumpWidget(host(home(today: [workItem()])));
    await tester.pumpAndSettle();

    expect(find.text('AÇÕES RÁPIDAS'), findsOneWidget);
    for (final rotulo in ['Minha fila', 'Agenda', 'Documentos']) {
      expect(find.text(rotulo), findsOneWidget);
    }
  });

  testWidgets('dia sem trabalho orienta em vez de constatar', (tester) async {
    await tester.pumpWidget(host(home()));
    await tester.pumpAndSettle();

    expect(find.text('Nenhum atendimento programado'), findsOneWidget);
    expect(
      find.textContaining('aparece aqui'),
      findsOneWidget,
    );
  });

  testWidgets('falha do servidor mostra erro com nova tentativa', (
    tester,
  ) async {
    await tester.pumpWidget(host(const {}, status: 500));
    await tester.pumpAndSettle();

    expect(find.text('Tentar novamente'), findsOneWidget);
  });

  for (final (largura, escala) in [
    (320.0, 1.0),
    (375.0, 1.3),
    (390.0, 1.0),
    (430.0, 2.0),
  ]) {
    testWidgets('cabe em ${largura.toInt()}px com texto ${escala}x', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          home(
            today: [workItem(customer: 'Condomínio Empresarial Torre Norte')],
            overdue: [workItem(id: 'b', dueState: 'OVERDUE')],
            documents: [document()],
            appointments: const [
              {
                'id': 'e1',
                'title': 'Visita de manutenção preventiva semestral',
                'customerName': 'Central de Água Gelada',
                'type': 'MAINTENANCE',
                'status': 'CONFIRMED',
                'startsAt': '2026-09-01T09:00:00.000Z',
              },
            ],
            canScan: true,
          ),
          width: largura,
          textScale: escala,
        ),
      );
      await tester.pumpAndSettle();
      expect(layoutError, isNull);
    });
  }
}
