/// Shell de navegação.
///
/// As abas são montadas conforme o perfil derivado das permissões: o operador
/// vê "Início", o gestor vê "Visão Geral". As demais abas são as mesmas — o
/// conteúdo é que muda.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../features/authentication/domain/session.dart';
import '../../features/sync/presentation/widgets/sync_status_bar.dart';
import '../widgets/sync_indicator.dart';
import 'orbit_router.dart';

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.location, required this.child});

  final String location;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final isOwner = session?.profile == OrbitProfile.owner;

    final destinations = <_ShellDestination>[
      _ShellDestination(
        route: OrbitRoutes.home,
        label: isOwner ? 'Visão Geral' : 'Início',
        icon: isOwner ? Icons.insights_outlined : Icons.home_outlined,
        selectedIcon: isOwner ? Icons.insights : Icons.home,
      ),

      /// A entrada operacional é a **fila de campo**, não a lista
      /// administrativa de atendimentos: PMOC e visitas técnicas também são
      /// trabalho, e apareciam fora dali.
      const _ShellDestination(
        route: OrbitRoutes.workQueue,
        label: 'Trabalho',
        icon: Icons.checklist_rtl_outlined,
        selectedIcon: Icons.checklist_rtl,
      ),
      const _ShellDestination(
        route: OrbitRoutes.agenda,
        label: 'Agenda',
        icon: Icons.calendar_today_outlined,
        selectedIcon: Icons.calendar_today,
      ),
      const _ShellDestination(
        route: OrbitRoutes.profile,
        label: 'Perfil',
        icon: Icons.person_outline,
        selectedIcon: Icons.person,
      ),
    ];

    final index = destinations.indexWhere(
      (destination) => location.startsWith(destination.route),
    );

    return Scaffold(
      body: child,
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Estado da fila de evidências, sempre visível durante o trabalho.
          const SyncStatusBar(),
          const SyncIndicator(),
          NavigationBar(
            selectedIndex: index < 0 ? 0 : index,
            onDestinationSelected: (selected) =>
                context.go(destinations[selected].route),
            destinations: [
              for (final destination in destinations)
                NavigationDestination(
                  icon: Icon(destination.icon),
                  selectedIcon: Icon(destination.selectedIcon),
                  label: destination.label,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ShellDestination {
  const _ShellDestination({
    required this.route,
    required this.label,
    required this.icon,
    required this.selectedIcon,
  });

  final String route;
  final String label;
  final IconData icon;
  final IconData selectedIcon;
}
