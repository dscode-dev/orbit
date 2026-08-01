/// Navegação.
///
/// Um `GoRouter` que observa a sessão: enquanto ela é restaurada mostra a
/// splash, sem sessão manda para o login, e com sessão monta o shell do perfil.
///
/// **Guards são de navegação, não de autorização.** A interface esconde o que
/// o usuário não pode fazer; quem recusa de verdade é o backend.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../features/authentication/domain/session.dart';
import '../../features/authentication/presentation/login_screen.dart';
import '../../features/authentication/presentation/splash_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/operations/presentation/operation_detail_screen.dart';
import '../../features/operations/presentation/operations_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/scheduling/presentation/agenda_screen.dart';
import 'app_shell.dart';

abstract final class OrbitRoutes {
  static const splash = '/';
  static const login = '/login';
  static const home = '/inicio';
  static const operations = '/operacoes';
  static const agenda = '/agenda';
  static const profile = '/perfil';

  static String operationDetail(String id) => '$operations/$id';
}

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = _AuthRefreshNotifier(ref);
  ref.onDispose(notifier.dispose);

  return GoRouter(
    initialLocation: OrbitRoutes.splash,
    refreshListenable: notifier,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final location = state.matchedLocation;

      if (auth is AuthRestoring) {
        return location == OrbitRoutes.splash ? null : OrbitRoutes.splash;
      }
      if (auth is AuthUnauthenticated) {
        return location == OrbitRoutes.login ? null : OrbitRoutes.login;
      }
      // Autenticado: sai da splash e do login.
      if (location == OrbitRoutes.splash || location == OrbitRoutes.login) {
        return OrbitRoutes.home;
      }
      return null;
    },
    routes: [
      GoRoute(
        path: OrbitRoutes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: OrbitRoutes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) =>
            AppShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(
            path: OrbitRoutes.home,
            builder: (context, state) => const HomeScreen(),
          ),
          GoRoute(
            path: OrbitRoutes.operations,
            builder: (context, state) => const OperationsScreen(),
            routes: [
              GoRoute(
                path: ':id',
                // Fora do shell: o detalhe ocupa a tela inteira.
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => OperationDetailScreen(
                  operationId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: OrbitRoutes.agenda,
            builder: (context, state) => const AgendaScreen(),
          ),
          GoRoute(
            path: OrbitRoutes.profile,
            builder: (context, state) => const ProfileScreen(),
          ),
        ],
      ),
    ],
    navigatorKey: _rootNavigatorKey,
    errorBuilder: (context, state) => Scaffold(
      body: Center(child: Text('Rota não encontrada: ${state.uri}')),
    ),
  );
});

final _rootNavigatorKey = GlobalKey<NavigatorState>();

/// Faz o GoRouter reavaliar o `redirect` quando a sessão muda.
class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    _subscription = ref.listen<AuthState>(
      authControllerProvider,
      (_, __) => notifyListeners(),
    );
  }

  late final ProviderSubscription<AuthState> _subscription;

  @override
  void dispose() {
    _subscription.close();
    super.dispose();
  }
}
