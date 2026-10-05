/// O roteiro de etapas.
///
/// O que se cobra aqui é a fronteira: o roteiro navega e mostra progresso;
/// ele **não** decide nada de domínio, e mudar de etapa não envia comando.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:orbit_operator/core/design/orbit_wizard.dart';
import 'package:orbit_operator/core/theme/orbit_theme.dart';

Widget host(
  List<OrbitWizardStep> steps, {
  double textScale = 1.0,
  double width = 390,
  Widget? footer,
}) => MediaQuery(
  data: MediaQueryData(
    textScaler: TextScaler.linear(textScale),
    size: Size(width, 800),
  ),
  child: MaterialApp(
    theme: OrbitTheme.light(),
    home: Scaffold(
      body: SingleChildScrollView(
        child: OrbitWizard(steps: steps, footer: footer),
      ),
    ),
  ),
);

OrbitWizardStep step(
  String title, {
  bool complete = false,
  String? lockedReason,
  String? hint,
}) => OrbitWizardStep(
  title: title,
  complete: complete,
  lockedReason: lockedReason,
  hint: hint,
  child: Text('conteúdo de $title'),
);

void main() {
  Object? layoutError;
  setUp(() {
    layoutError = null;
    FlutterError.onError = (details) => layoutError ??= details.exception;
  });
  tearDown(() => FlutterError.onError = FlutterError.presentError);

  testWidgets('diz onde a pessoa está', (tester) async {
    await tester.pumpWidget(host([step('Preparação'), step('Execução')]));

    expect(find.text('Etapa 1 de 2'), findsOneWidget);
    expect(find.text('conteúdo de Preparação'), findsOneWidget);
    expect(find.text('conteúdo de Execução'), findsNothing);
  });

  testWidgets('avançar e voltar são navegação', (tester) async {
    await tester.pumpWidget(
      host([step('Preparação'), step('Execução'), step('Evidências')]),
    );

    await tester.tap(find.text('Avançar · Execução'));
    await tester.pumpAndSettle();
    expect(find.text('Etapa 2 de 3'), findsOneWidget);

    await tester.tap(find.text('Voltar'));
    await tester.pumpAndSettle();
    expect(find.text('Etapa 1 de 3'), findsOneWidget);
  });

  testWidgets('a primeira etapa não oferece voltar; a última, avançar', (
    tester,
  ) async {
    await tester.pumpWidget(host([step('Preparação'), step('Execução')]));

    expect(find.text('Voltar'), findsNothing);

    await tester.tap(find.text('Avançar · Execução'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Avançar'), findsNothing);
    expect(find.text('Voltar'), findsOneWidget);
  });

  /// O defeito que este grupo existe para impedir.
  ///
  /// O roteiro pulava etapas travadas, e em campo isso acontecia por omissão: sem
  /// checklist previsto, sem execução aberta ainda. Quem executava via "Etapa 1 de 6"
  /// virar "Etapa 3 de 6" e nunca soube o que havia na 2.
  group('nenhuma etapa é pulada', () {
    testWidgets('avançar vai para a vizinha, mesmo travada', (tester) async {
      await tester.pumpWidget(
        host([
          step('Preparação'),
          step('Execução', lockedReason: 'Abra o atendimento primeiro.'),
          step('Evidências'),
        ]),
      );

      /// O rótulo nomeia a vizinha — não "a próxima alcançável".
      await tester.tap(find.text('Avançar · Execução'));
      await tester.pumpAndSettle();
      expect(find.text('Etapa 2 de 3'), findsOneWidget);
    });

    testWidgets('a etapa travada mostra o motivo no lugar do conteúdo', (
      tester,
    ) async {
      await tester.pumpWidget(
        host([
          step('Preparação'),
          step('Execução', lockedReason: 'Abra o atendimento primeiro.'),
        ]),
      );

      await tester.tap(find.text('Avançar · Execução'));
      await tester.pumpAndSettle();

      expect(find.text('Abra o atendimento primeiro.'), findsOneWidget);

      /// O conteúdo é interativo; travar é trocá-lo, não só avisar por cima.
      expect(find.text('conteúdo de Execução'), findsNothing);
    });

    testWidgets('o trilho leva a uma etapa travada', (tester) async {
      await tester.pumpWidget(
        host([
          step('Preparação'),
          step('Execução', lockedReason: 'Abra o atendimento primeiro.'),
        ]),
      );

      /// Tocar na etapa travada é a única forma de descobrir o motivo — antes o
      /// toque era ignorado, e o motivo não existia em lugar nenhum.
      await tester.tap(find.text('Execução'));
      await tester.pumpAndSettle();
      expect(find.text('Etapa 2 de 2'), findsOneWidget);
      expect(find.text('Abra o atendimento primeiro.'), findsOneWidget);
    });

    testWidgets('voltar também não salta', (tester) async {
      await tester.pumpWidget(
        host([
          step('Preparação'),
          step('Execução', lockedReason: 'Abra o atendimento primeiro.'),
          step('Evidências'),
        ]),
      );

      await tester.tap(find.text('Evidências'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Voltar'));
      await tester.pumpAndSettle();
      expect(find.text('Etapa 2 de 3'), findsOneWidget);
    });
  });

  testWidgets('o trilho leva direto a uma etapa alcançável', (tester) async {
    await tester.pumpWidget(
      host([step('Preparação'), step('Execução'), step('Evidências')]),
    );

    await tester.tap(find.text('Evidências'));
    await tester.pumpAndSettle();
    expect(find.text('Etapa 3 de 3'), findsOneWidget);
  });

  testWidgets('o rodapé acompanha a etapa', (tester) async {
    await tester.pumpWidget(
      host([
        step('Preparação'),
        step('Finalização'),
      ], footer: const Text('ação do domínio')),
    );

    expect(find.text('ação do domínio'), findsOneWidget);
  });

  testWidgets('a dica da etapa aparece quando existe', (tester) async {
    await tester.pumpWidget(
      host([step('Preparação', hint: 'Confira antes de começar.')]),
    );

    expect(find.text('Confira antes de começar.'), findsOneWidget);
  });

  testWidgets('leitor de tela recebe a posição e o estado da etapa', (
    tester,
  ) async {
    await tester.pumpWidget(
      host([step('Preparação', complete: true), step('Execução')]),
    );

    expect(
      find.bySemanticsLabel('Preparação, etapa 1 de 2, concluída'),
      findsOneWidget,
    );
  });

  for (final (largura, escala) in [(320.0, 1.0), (375.0, 1.3), (430.0, 2.0)]) {
    testWidgets('cabe em ${largura.toInt()}px com texto ${escala}x', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          [
            step('Preparação'),
            step('Execução'),
            step('Evidências'),
            step('Materiais'),
            step('Confirmação'),
            step('Finalização'),
          ],
          width: largura,
          textScale: escala,
        ),
      );
      await tester.pumpAndSettle();
      expect(layoutError, isNull);
    });
  }
}
