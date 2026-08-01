/// Ponto de entrada do Orbit Operator.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/providers.dart';
import 'core/routing/orbit_router.dart';
import 'core/theme/orbit_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // O app de campo é usado na vertical, com o aparelho na mão.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // A leitura das preferências é assíncrona; a árvore precisa dela pronta.
  final preferences = await SharedPreferences.getInstance();

  runApp(
    ProviderScope(
      overrides: [sharedPreferencesProvider.overrideWithValue(preferences)],
      child: const OrbitOperatorApp(),
    ),
  );
}

class OrbitOperatorApp extends ConsumerStatefulWidget {
  const OrbitOperatorApp({super.key});

  @override
  ConsumerState<OrbitOperatorApp> createState() => _OrbitOperatorAppState();
}

class _OrbitOperatorAppState extends ConsumerState<OrbitOperatorApp> {
  @override
  void initState() {
    super.initState();
    // Restaura a sessão guardada assim que a árvore monta.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authControllerProvider.notifier).restore();
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Orbit Operator',
      debugShowCheckedModeBanner: false,
      theme: OrbitTheme.dark(),
      darkTheme: OrbitTheme.dark(),
      themeMode: ThemeMode.dark,
      routerConfig: ref.watch(routerProvider),
    );
  }
}
