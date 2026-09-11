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
import '../../../core/design/orbit_operational.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../../signature/application/signature_providers.dart';
import '../../signature/presentation/widgets/professional_signature_preview.dart';
import '../../sync/application/sync_providers.dart';
import '../../authentication/domain/session.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (session == null) return const SizedBox.shrink();

    final units = session.organization?.businessUnits ?? const [];
    final sync = ref.watch(syncControllerProvider);
    final signature = ref.watch(signatureStatusProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Perfil')),
      body: ListView(
        padding: const EdgeInsets.all(OrbitSpacing.gutter),
        children: [
          /// Identity remains compact and aligned with the shared gutter.
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: LayoutBuilder(
              builder: (context, constraints) => Wrap(
                spacing: OrbitSpacing.md,
                runSpacing: OrbitSpacing.sm,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  OrbitAvatar(
                    initials: session.user.initials,
                    url: session.user.avatarUrl,
                    size: 56,
                  ),
                  SizedBox(
                    width: MediaQuery.textScalerOf(context).scale(1) > 1.3
                        ? constraints.maxWidth
                        : constraints.maxWidth - 56 - OrbitSpacing.md,
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

          SectionBlock(
            inset: 0,
            title: 'Contexto',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
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
              ],
            ),
          ),
          const SizedBox(height: OrbitSpacing.md),

          /// A assinatura profissional pertence ao usuário — por isso mora
          /// aqui, e não escondida dentro de um atendimento: quem precisa
          /// cadastrá-la costuma descobrir isso longe do campo.
          SectionBlock(
            inset: 0,
            title: 'Minha assinatura',
            subtitle: 'Usada nos documentos que você assina',
            child: signature.when(
              loading: () => const SectionLoading(lines: 2),
              error: (error, _) => SectionError(
                error: error,
                onRetry: () => ref.invalidate(signatureStatusProvider),
              ),
              data: (status) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (status.signatureAvailable) ...[
                    const ProfessionalSignaturePreview(height: 104),
                    if (status.updatedAt != null)
                      Padding(
                        padding: const EdgeInsets.only(top: OrbitSpacing.sm),
                        child: Text(
                          'Atualizada em ${_signatureDate(status.updatedAt!)}',
                          style: OrbitType.caption.copyWith(
                            color: context.orbit.inkMuted,
                          ),
                        ),
                      ),
                  ] else
                    const SectionEmpty(
                      icon: Icons.draw_outlined,
                      message:
                          'Cadastre sua assinatura para usá-la nos documentos.',
                    ),
                  const SizedBox(height: OrbitSpacing.sm),
                  OutlinedButton.icon(
                    key: const Key('profile.signature.action'),
                    onPressed: () => context.push(OrbitRoutes.mySignature),
                    icon: Icon(
                      status.signatureAvailable
                          ? Icons.edit_outlined
                          : Icons.add,
                    ),
                    label: Text(
                      status.signatureAvailable
                          ? 'Alterar assinatura'
                          : 'Cadastrar assinatura',
                    ),
                  ),
                ],
              ),
            ),
          ),

          /// A fila local tem endereço fixo, e não só a faixa que aparece
          /// quando há pendência: quem quer conferir se o trabalho subiu
          /// precisa de um lugar para olhar, mesmo quando está tudo em ordem.
          SectionBlock(
            inset: 0,
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
            SectionBlock(
              inset: 0,
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
            SectionBlock(
              inset: 0,
              title: 'Unidade ativa',
              child: _Row(
                label: 'Unidade',
                value: session.businessUnit?.name ?? '—',
              ),
            ),

          const SizedBox(height: OrbitSpacing.md),

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

String _signatureDate(DateTime value) {
  final local = value.toLocal();
  String two(int number) => number.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year} às '
      '${two(local.hour)}:${two(local.minute)}';
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final labelText = Text(
      label,
      style: OrbitType.label.copyWith(
        fontWeight: FontWeight.w400,
        color: context.orbit.inkMuted,
      ),
    );
    final valueText = Text(value, style: OrbitType.caption);
    return Padding(
      padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
      child: MediaQuery.textScalerOf(context).scale(1) > 1.3
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [labelText, const SizedBox(height: 2), valueText],
            )
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(width: 120, child: labelText),
                Expanded(child: valueText),
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
