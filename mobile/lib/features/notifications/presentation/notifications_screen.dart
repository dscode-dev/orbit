/// A caixa de avisos.
///
/// A home mostra os mais recentes num carrossel; aqui está a lista inteira,
/// com o que já foi lido separado do que não foi. Tocar num aviso o marca como
/// lido — é o gesto que a pessoa já fez, e pedir um segundo toque para
/// confirmar leitura seria burocracia.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/contracts/notification_contracts.dart';
import '../../../core/design/orbit_primitives.dart';
import '../../../core/presentation/orbit_format.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import 'package:go_router/go_router.dart';

import '../application/notification_providers.dart';
import '../domain/deep_link.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final avisos = ref.watch(notificationsProvider);
    final dados = avisos.valueOrNull?.value;

    return Scaffold(
      backgroundColor: context.orbit.background,
      appBar: AppBar(title: const Text('Notificações')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(notificationsProvider),
        child: switch ((dados, avisos.hasError)) {
          (final OrbitNotificationPage pagina, _) when pagina.data.isNotEmpty =>
            ListView(
              padding: const EdgeInsets.all(OrbitSpacing.gutter),
              children: [
                OrbitCard(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (final (indice, aviso) in pagina.data.indexed) ...[
                        if (indice > 0) const OrbitRowDivider(),
                        _AvisoRow(aviso: aviso, ref: ref),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          (final OrbitNotificationPage _, _) => ListView(
            padding: const EdgeInsets.all(OrbitSpacing.gutter),
            children: const [
              OrbitEmptyState(
                icon: Icons.notifications_none_rounded,
                title: 'Nenhuma notificação',
                description: 'Avisos sobre o seu trabalho aparecem aqui.',
              ),
            ],
          ),
          (_, true) => ListView(
            padding: const EdgeInsets.all(OrbitSpacing.gutter),
            children: [
              SectionError(
                error: avisos.error!,
                onRetry: () => ref.invalidate(notificationsProvider),
              ),
            ],
          ),
          _ => const Padding(
            padding: EdgeInsets.all(OrbitSpacing.gutter),
            child: SectionLoading(lines: 6),
          ),
        },
      ),
    );
  }
}

class _AvisoRow extends StatelessWidget {
  const _AvisoRow({required this.aviso, required this.ref});

  final OrbitNotification aviso;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    return OrbitListRow(
      title: aviso.title,
      subtitle: aviso.body,
      detail: OrbitFormat.dateHourOf(aviso.createdAt),
      trailing: aviso.isUnread
          ? Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: palette.accent,
                shape: BoxShape.circle,
              ),
            )
          : null,
      /// Tocar faz as duas coisas que a pessoa espera: marca como lido e
      /// leva ao que o aviso é sobre. Ler sem poder ir até lá transforma a
      /// caixa num mural.
      onTap: () async {
        final destino = routeForNotificationPayload(aviso.payload);
        if (aviso.isUnread) {
          await ref.read(notificationRepositoryProvider).markRead(aviso.id);
          ref.invalidate(notificationsProvider);
        }
        if (destino == null || !context.mounted) return;
        context.push(destino);
      },
    );
  }
}
