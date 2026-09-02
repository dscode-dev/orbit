/// O cartão da fila em campo.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:orbit_operator/core/contracts/mobile_field_contracts.dart';
import 'package:orbit_operator/features/field/presentation/widgets/work_item_card.dart';

MobileWorkItemContract item({
  String id = 'SERVICE_OPERATION:1',
  String kind = 'SERVICE_OPERATION',
  String dueState = 'DUE_TODAY',
  String? customer = 'Cliente Teste',
  String? scheduledFor = '2026-09-01T12:00:00.000Z',
  Map<String, dynamic>? location,
  List<Map<String, dynamic>> equipment = const [],
  String? responsibleId,
  List<String> auxiliaryIds = const [],
}) => MobileWorkItemContract.fromJson({
  'id': id,
  'kind': kind,
  'sourceId': '1',
  'title': 'Atendimento',
  'businessUnit': {'id': 'bu', 'name': 'Matriz'},
  if (customer != null) 'customer': {'id': 'c1', 'name': customer},
  'location': location,
  'timezone': 'America/Recife',
  'scheduledFor': scheduledFor,
  'dueState': dueState,
  'operationalStatus': 'SCHEDULED',
  if (responsibleId != null)
    'responsibleFieldTechnician': {'id': responsibleId, 'name': 'Téc'},
  'auxiliaryTechnicians': [
    for (final id in auxiliaryIds) {'id': id, 'name': 'Aux'},
  ],
  'equipmentSummary': equipment,
  'allowedActions': <String>['VIEW'],
  'navigationContext': {'kind': kind, 'sourceId': '1'},
  'updatedAt': '2026-09-01T12:00:00.000Z',
})!;

Widget host(Widget child, {double textScale = 1.0, double width = 360}) =>
    MediaQuery(
      data: MediaQueryData(
        textScaler: TextScaler.linear(textScale),
        size: Size(width, 720),
      ),
      child: MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: width,
            child: SingleChildScrollView(child: child),
          ),
        ),
      ),
    );

void main() {
  setUpAll(() async => initializeDateFormatting('pt_BR'));

  Object? layoutError;
  setUp(() {
    layoutError = null;
    FlutterError.onError = (details) => layoutError ??= details.exception;
  });
  tearDown(() => FlutterError.onError = FlutterError.presentError);

  testWidgets('mostra tipo, prazo, cliente e horário em português', (
    tester,
  ) async {
    await tester.pumpWidget(host(WorkItemCard(item: item(), onOpen: () {})));

    expect(find.text('Atendimento'), findsOneWidget);
    expect(find.text('Hoje'), findsOneWidget);
    expect(find.text('Cliente Teste'), findsOneWidget);

    /// Nenhum código de domínio na tela.
    expect(find.textContaining('SERVICE_OPERATION'), findsNothing);
    expect(find.textContaining('DUE_TODAY'), findsNothing);
  });

  testWidgets('PMOC e RVT ganham o nome do produto', (tester) async {
    await tester.pumpWidget(
      host(
        Column(
          children: [
            WorkItemCard(
              item: item(id: 'a', kind: 'PMOC'),
              onOpen: () {},
            ),
            WorkItemCard(
              item: item(id: 'b', kind: 'RVT'),
              onOpen: () {},
            ),
          ],
        ),
      ),
    );

    expect(find.text('Manutenção preventiva'), findsOneWidget);
    expect(find.text('Visita técnica'), findsOneWidget);
    expect(find.textContaining('PMOC'), findsNothing);
    expect(find.textContaining('RVT'), findsNothing);
  });

  testWidgets('item sem data diz "Sem data" em vez de inventar uma', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        WorkItemCard(
          item: item(dueState: 'UNSCHEDULED', scheduledFor: null),
          onOpen: () {},
        ),
      ),
    );

    expect(find.text('Sem data'), findsAtLeastNWidgets(1));
  });

  testWidgets('a função de quem lê aparece quando ele está escalado', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        Column(
          children: [
            WorkItemCard(
              item: item(id: 'a', responsibleId: 'eu'),
              currentUserId: 'eu',
              onOpen: () {},
            ),
            WorkItemCard(
              item: item(id: 'b', auxiliaryIds: const ['eu']),
              currentUserId: 'eu',
              onOpen: () {},
            ),
          ],
        ),
      ),
    );

    expect(find.text('Técnico em Campo'), findsOneWidget);
    expect(find.text('Auxiliar'), findsOneWidget);

    /// Nada de "Equipe" genérico: os papéis são distintos no domínio.
    expect(find.text('Equipe'), findsNothing);
  });

  testWidgets('abrir o cartão chama a navegação', (tester) async {
    var opened = 0;
    await tester.pumpWidget(
      host(WorkItemCard(item: item(), onOpen: () => opened += 1)),
    );

    await tester.tap(find.byType(InkWell));
    await tester.pump();
    expect(opened, 1);
  });

  testWidgets('leitor de tela recebe um rótulo útil', (tester) async {
    await tester.pumpWidget(host(WorkItemCard(item: item(), onOpen: () {})));

    final label = semanticLabel(item());
    expect(label, contains('Atendimento'));
    expect(label, contains('Hoje'));
    expect(label, contains('Cliente Teste'));
  });

  for (final scale in [1.0, 1.3, 2.0]) {
    testWidgets('não estoura com texto em ${scale}x', (tester) async {
      await tester.pumpWidget(
        host(
          WorkItemCard(
            item: item(
              customer:
                  'Condomínio Empresarial Torre Norte — Central de Água '
                  'Gelada, Subsolo 2, Ala Leste',
              location: const {
                'label':
                    'Avenida Governador Agamenon Magalhães, 4775, '
                    'Sala 1802, Empresarial Isaac Newton, Recife',
              },
              equipment: const [
                {
                  'id': 'e1',
                  'name':
                      'Chiller Centrífugo de Alta Capacidade — Unidade '
                      'Condensadora Externa 03',
                  'type': 'CHILLER',
                  'status': 'ACTIVE',
                },
              ],
            ),
            onOpen: () {},
          ),
          textScale: scale,
        ),
      );
      expect(layoutError, isNull);
    });
  }

  testWidgets('tela estreita continua íntegra', (tester) async {
    await tester.pumpWidget(
      host(
        WorkItemCard(item: item(), onOpen: () {}),
        width: 280,
        textScale: 1.5,
      ),
    );
    expect(layoutError, isNull);
  });
}
