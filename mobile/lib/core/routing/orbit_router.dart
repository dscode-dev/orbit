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
import '../../features/field/presentation/field_dashboard_screen.dart';
import '../../features/field/presentation/operation_execution_screen.dart';
import '../../features/field/presentation/work_item_detail_screen.dart';
import '../../features/field/presentation/work_queue_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/signature/presentation/customer_acknowledgement_screen.dart';
import '../../features/signature/presentation/my_signature_screen.dart';
import '../../features/operations/presentation/operation_detail_screen.dart';
import '../../features/operations/presentation/operations_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/scheduling/presentation/agenda_screen.dart';
import 'app_shell.dart';

abstract final class OrbitRoutes {
  static const splash = '/';
  static const login = '/login';
  static const home = '/inicio';

  /// A fila de campo — o item de trabalho canônico, não a lista
  /// administrativa de atendimentos.
  static const workQueue = '/trabalho';
  static const operations = '/operacoes';
  static const agenda = '/agenda';
  static const profile = '/perfil';

  static String operationDetail(String id) => '$operations/$id';

  /// O ID do item é **opaco** e vai codificado: o backend o compõe com `:`
  /// (`PMOC:<ciclo>:<equipamento>`), que é separador de caminho na URL.
  static String workItemDetail(String id) =>
      '$workQueue/${Uri.encodeComponent(id)}';

  /// Execução de um atendimento. A rota usa o **id da Operation**, que é o
  /// que os comandos do MB-02 endereçam — não o id composto do item.
  static String operationExecution(String operationId) =>
      '$workQueue/execucao/$operationId';

  /// A assinatura profissional pertence ao usuário: mora sob o perfil.
  static const mySignature = '/perfil/assinatura';

  /// Aceite do cliente — a única tela feita para outra pessoa ler.
  static String customerAcknowledgement(String operationId) =>
      '$workQueue/execucao/$operationId/aceite';
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

            /// Duas homes, um caminho.
            ///
            /// Quem executa em campo abre o **Meu dia** do MB-01 — uma
            /// requisição que responde o que fazer agora. Quem administra
            /// continua vendo os indicadores. É a mesma distinção que o shell
            /// já fazia entre "Início" e "Visão Geral"; agora ela vale também
            /// para o conteúdo, não só para o rótulo.
            builder: (context, state) {
              final session = ref.read(sessionProvider);
              return session?.profile == OrbitProfile.owner
                  ? const HomeScreen()
                  : const FieldDashboardScreen();
            },
          ),
          GoRoute(
            path: OrbitRoutes.workQueue,
            builder: (context, state) => const WorkQueueScreen(),
            routes: [
              /// Antes de `:id`, senão o caminho de execução seria lido como
              /// um id de item.
              GoRoute(
                path: 'execucao/:operationId',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => OperationExecutionScreen(
                  operationId: state.pathParameters['operationId'] ?? '',
                ),
                routes: [
                  GoRoute(
                    path: 'aceite',
                    parentNavigatorKey: _rootNavigatorKey,
                    builder: (context, state) => CustomerAcknowledgementScreen(
                      operationId: state.pathParameters['operationId'] ?? '',
                    ),
                  ),
                ],
              ),
              GoRoute(
                path: ':id',

                /// Fora do shell: o contexto do item ocupa a tela inteira.
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => WorkItemDetailScreen(
                  workItemId: Uri.decodeComponent(
                    state.pathParameters['id'] ?? '',
                  ),
                ),
              ),
            ],
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
            routes: [
              GoRoute(
                path: 'assinatura',
                parentNavigatorKey: _rootNavigatorKey,
                builder: (context, state) => const MySignatureScreen(),
              ),
            ],
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
