/// A barra de navegação — a arquitetura de informação do aplicativo.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:orbit_operator/core/routing/app_shell.dart';
import 'package:orbit_operator/core/routing/orbit_router.dart';
import 'package:orbit_operator/core/theme/orbit_theme.dart';

Widget host(String location, {double textScale = 1.0, double width = 390}) =>
    ProviderScope(
      child: MediaQuery(
        data: MediaQueryData(
          textScaler: TextScaler.linear(textScale),
          size: Size(width, 800),
        ),
        child: MaterialApp(
          theme: OrbitTheme.light(),
          home: AppShell(
            location: location,
            child: const SizedBox.shrink(),
          ),
        ),
      ),
    );

void main() {
  Object? layoutError;
  setUp(() {
    layoutError = null;
    FlutterError.onError = (details) => layoutError ??= details.exception;
  });
  tearDown(() => FlutterError.onError = FlutterError.presentError);

  testWidgets('cinco destinos, com o nome do que a pessoa faz', (tester) async {
    await tester.pumpWidget(host(OrbitRoutes.home));

    for (final rotulo in [
      'Início',
      'Atendimentos',
      'Agenda',
      'Documentos',
      'Perfil',
    ]) {
      expect(find.text(rotulo), findsOneWidget);
    }

    /// "Trabalho" descrevia a estrutura de dados, não a coisa.
    expect(find.text('Trabalho'), findsNothing);
  });

  testWidgets('documentos é destino, não caminho por dentro do atendimento', (
    tester,
  ) async {
    await tester.pumpWidget(host(OrbitRoutes.documents));

    final barra = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(barra.selectedIndex, 3);
  });

  testWidgets('a aba mais específica vence o prefixo', (tester) async {
    /// `/perfil/sincronizacao` começa com `/perfil`. Uma varredura ingênua
    /// acertaria por acaso enquanto os prefixos não colidissem.
    await tester.pumpWidget(host(OrbitRoutes.syncCenter));

    final barra = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(barra.selectedIndex, 4);
  });

  testWidgets('rota fora das abas não deixa a barra sem seleção', (
    tester,
  ) async {
    await tester.pumpWidget(host('/rota-que-nao-existe'));

    final barra = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(barra.selectedIndex, 0);
  });

  for (final (largura, escala) in [(320.0, 1.0), (375.0, 1.3), (430.0, 2.0)]) {
    testWidgets('cabe em ${largura.toInt()}px com texto ${escala}x', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(OrbitRoutes.home, width: largura, textScale: escala),
      );
      await tester.pumpAndSettle();
      expect(layoutError, isNull);
    });
  }
}
