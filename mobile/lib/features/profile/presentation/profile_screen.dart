/// Perfil e contexto da sessão.
///
/// Mostra quem está autenticado, em qual organização e unidade, com quais
/// papéis e qual plano — tudo lido da sessão, sem consulta extra.
///
/// A troca de unidade muda o filtro `businessUnitId` que o app envia; o escopo
/// do token continua sendo do servidor.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/providers.dart';
import '../../../core/routing/orbit_router.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../sync/application/sync_providers.dart';
import '../../../core/widgets/section_states.dart';
import '../../authentication/domain/session.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (session == null) return const SizedBox.shrink();

    final units = session.organization?.businessUnits ?? const [];
    final sync = ref.watch(syncControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Perfil')),
      body: ListView(
        padding: const EdgeInsets.all(OrbitSpacing.md),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(OrbitSpacing.md),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: OrbitColors.brand.withValues(alpha: 0.22),
                    child: Text(
                      session.user.initials,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: OrbitSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          session.user.displayName,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          session.user.email,
                          style: const TextStyle(
                            fontSize: 12,
                            color: OrbitColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: OrbitSpacing.md),

          SectionCard(
            title: 'Contexto',
            child: Column(
              children: [
                _Row(
                  label: 'Perfil no app',
                  value: session.profile == OrbitProfile.owner
                      ? 'Gestão'
                      : 'Operação',
                ),
                _Row(
                  label: 'Organização',
                  value: session.organization?.displayName ?? '—',
                ),
                _Row(
                  label: 'Plano',
                  value:
                      session.entitlements?.planKey ??
                      session.organization?.plan?.key ??
                      '—',
                ),
                _Row(
                  label: 'Assinatura',
                  value: session.hasActiveSubscription ? 'Ativa' : 'Inativa',
                ),
                _Row(
                  label: 'Papéis',
                  value: session.roles.isEmpty ? '—' : session.roles.join(', '),
                ),
              ],
            ),
          ),
          const SizedBox(height: OrbitSpacing.md),

          /// A assinatura profissional pertence ao usuário — por isso mora
          /// aqui, e não escondida dentro de um atendimento: quem precisa
          /// cadastrá-la costuma descobrir isso longe do campo.
          SectionCard(
            title: 'Assinatura profissional',
            subtitle: 'Usada nos documentos que você assina',
            child: ListTile(
              onTap: () => context.push(OrbitRoutes.mySignature),
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.draw_outlined),
              title: const Text(
                'Minha assinatura',
                style: TextStyle(fontSize: 14),
              ),
              trailing: const Icon(Icons.chevron_right),
            ),
          ),

          /// A fila local tem endereço fixo, e não só a faixa que aparece
          /// quando há pendência: quem quer conferir se o trabalho subiu
          /// precisa de um lugar para olhar, mesmo quando está tudo em ordem.
          SectionCard(
            title: 'Sincronização',
            subtitle: 'O que ainda não chegou ao servidor',
            child: ListTile(
              onTap: () => context.push(OrbitRoutes.syncCenter),
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                sync.needsAttention
                    ? Icons.error_outline
                    : sync.pending > 0
                    ? Icons.cloud_queue
                    : Icons.cloud_done_outlined,
                color: sync.needsAttention
                    ? OrbitColors.danger
                    : sync.pending > 0
                    ? OrbitColors.warning
                    : OrbitColors.success,
              ),
              title: const Text(
                'Ações pendentes',
                style: TextStyle(fontSize: 14),
              ),
              subtitle: Text(
                sync.hasWork
                    ? '${sync.pending + sync.conflicts + sync.rejected + sync.expired} '
                          'ação(ões) neste aparelho'
                    : 'Nada pendente',
                style: const TextStyle(fontSize: 12),
              ),
              trailing: const Icon(Icons.chevron_right),
            ),
          ),

          if (units.length > 1)
            SectionCard(
              title: 'Unidade ativa',
              subtitle: 'Filtra as consultas do aplicativo',
              child: Column(
                children: [
                  for (final unit in units)
                    ListTile(
                      onTap: () => ref
                          .read(authControllerProvider.notifier)
                          .selectBusinessUnit(unit.id),
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        unit.name,
                        style: const TextStyle(fontSize: 14),
                      ),
                      subtitle: unit.city == null
                          ? null
                          : Text(
                              unit.city!,
                              style: const TextStyle(fontSize: 12),
                            ),
                      trailing: Icon(
                        unit.id == session.businessUnitId
                            ? Icons.radio_button_checked
                            : Icons.radio_button_unchecked,
                        color: unit.id == session.businessUnitId
                            ? OrbitColors.brand
                            : OrbitColors.textSecondary,
                      ),
                    ),
                ],
              ),
            )
          else
            SectionCard(
              title: 'Unidade ativa',
              child: _Row(
                label: 'Unidade',
                value: session.businessUnit?.name ?? '—',
              ),
            ),

          const SizedBox(height: OrbitSpacing.md),

          SectionCard(
            title: 'Módulos do plano',
            subtitle: 'Capabilities concedidas pelo backend',
            child: session.capabilities.isEmpty
                ? const SectionEmpty(
                    message: 'Nenhuma capability informada pelo servidor.',
                  )
                : Wrap(
                    spacing: OrbitSpacing.sm,
                    runSpacing: OrbitSpacing.sm,
                    children: [
                      for (final capability in session.capabilities)
                        Chip(
                          label: Text(capability),
                          visualDensity: VisualDensity.compact,
                        ),
                    ],
                  ),
          ),
          const SizedBox(height: OrbitSpacing.lg),

          OutlinedButton.icon(
            key: const Key('profile.logout'),
            onPressed: () => _logout(context, ref),
            icon: const Icon(Icons.logout),
            label: const Text('Sair da conta'),
            style: OutlinedButton.styleFrom(
              foregroundColor: OrbitColors.danger,
            ),
          ),
          const SizedBox(height: OrbitSpacing.xl),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                color: OrbitColors.textSecondary,
              ),
            ),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }
}

/// Sair da conta, sem levar o trabalho de ninguém junto.
///
/// Duas decisões distintas:
///
/// - **A projeção do servidor é apagada.** O próprio pacote de campo vem
///   marcado `purgeOnLogout: true`, e ele carrega nome de cliente, endereço e
///   histórico. Isso não fica num aparelho depois que a pessoa sai dele.
/// - **A fila de comandos permanece.** Apagá-la seria destruir o registro de um
///   trabalho que aconteceu de verdade só porque alguém tocou "Sair" antes de
///   pegar sinal. Ela fica presa ao escopo de quem a criou, então o próximo a
///   entrar não a vê nem a envia.
Future<void> _logout(BuildContext context, WidgetRef ref) async {
  final sync = ref.read(syncControllerProvider);
  if (sync.hasWork) {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sair com ações não sincronizadas?'),
        content: Text(
          '${sync.pending + sync.conflicts + sync.rejected + sync.expired} '
          'ação(ões) ainda não chegaram ao servidor. Elas ficam guardadas '
          'neste aparelho e serão enviadas quando você entrar de novo com '
          'esta mesma conta.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Continuar conectado'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Sair mesmo assim'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
  }

  await ref.read(syncProjectionProvider).clear();
  await ref.read(authControllerProvider.notifier).logout();
}
