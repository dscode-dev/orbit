/// Estados de seção.
///
/// Cada painel do app resolve carregando → erro → vazio → conteúdo por aqui.
/// Uma seção que falha mostra o próprio erro e **não derruba a tela**: as
/// demais continuam utilizáveis.
library;

import 'package:flutter/material.dart';

import '../errors/orbit_exception.dart';
import '../presentation/field_registry.dart';
import '../theme/orbit_theme.dart';

/// Cartão de seção com título e conteúdo.
class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    required this.title,
    required this.child,
    this.trailing,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(OrbitSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (subtitle != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            subtitle!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: OrbitColors.textSecondary,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
            const SizedBox(height: OrbitSpacing.md),
            child,
          ],
        ),
      ),
    );
  }
}

class SectionLoading extends StatelessWidget {
  const SectionLoading({super.key, this.lines = 3});

  final int lines;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        lines,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: OrbitSpacing.sm),
          child: _Shimmer(widthFactor: index == 0 ? 0.6 : 1),
        ),
      ),
    );
  }
}

class _Shimmer extends StatelessWidget {
  const _Shimmer({required this.widthFactor});

  final double widthFactor;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      alignment: Alignment.centerLeft,
      widthFactor: widthFactor,
      child: Container(
        height: 14,
        decoration: BoxDecoration(
          color: OrbitColors.surface.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(7),
        ),
      ),
    );
  }
}

class SectionEmpty extends StatelessWidget {
  const SectionEmpty({super.key, required this.message, this.icon});

  final String message;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: OrbitSpacing.md),
      child: Column(
        children: [
          Icon(
            icon ?? Icons.inbox_outlined,
            color: OrbitColors.textSecondary,
            size: 28,
          ),
          const SizedBox(height: OrbitSpacing.sm),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              color: OrbitColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Erro de leitura.
///
/// Cada recusa tem a sua forma:
///
/// - **403** é ausência de acesso, não falha. Sem "tentar novamente": repetir
///   dá o mesmo resultado, e insistir sugere que o problema é passageiro.
/// - **409** é dado que mudou por baixo. A saída é reler, e o botão diz isso.
/// - **404** é ausência neutra: nada sobre outro tenant, outra unidade ou
///   registro revogado — distinguir os casos vira um oráculo.
/// - **rede** é o aparelho, não o servidor.
///
/// O `requestId` aparece discreto quando o erro é inesperado. Não é para o
/// usuário entender: é para ele conseguir dizer ao suporte qual foi a
/// requisição, e o suporte achá-la no log.
class SectionError extends StatelessWidget {
  const SectionError({super.key, required this.error, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final orbitError = error is OrbitException ? error as OrbitException : null;

    if (orbitError?.isForbidden ?? false) {
      return SectionEmpty(
        icon: Icons.lock_outline,
        message: errorCodeLabels['FORBIDDEN']!,
      );
    }

    if (orbitError?.isNotFound ?? false) {
      return const SectionEmpty(
        icon: Icons.search_off,
        message: 'Este registro não está disponível.',
      );
    }

    final isOffline = orbitError?.isOffline ?? false;
    final isConflict = orbitError?.isConflict ?? false;

    /// Mensagem do servidor quando existe; o mapa é a rede de segurança.
    final message = isConflict
        ? errorCodeLabels['CONFLICT']!
        : (orbitError?.message ??
              errorCodeLabel(orbitError?.code) ??
              'Não foi possível carregar.');

    /// `requestId` só no que é inesperado — 409 e falta de rede o usuário
    /// resolve sozinho, e a referência ali seria ruído.
    final reference = (isOffline || isConflict) ? null : orbitError?.requestId;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: OrbitSpacing.md),
      child: Column(
        children: [
          Icon(
            isOffline
                ? Icons.wifi_off_rounded
                : isConflict
                ? Icons.sync_problem
                : Icons.error_outline,
            color: isOffline || isConflict
                ? OrbitColors.warning
                : OrbitColors.danger,
            size: 28,
          ),
          const SizedBox(height: OrbitSpacing.sm),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              color: OrbitColors.textSecondary,
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: OrbitSpacing.sm),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 18),
              label: Text(isConflict ? 'Atualizar' : 'Tentar novamente'),
            ),
          ],
          if (reference != null) ...[
            const SizedBox(height: OrbitSpacing.xs),
            Text(
              'Referência: $reference',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                color: OrbitColors.textSecondary.withValues(alpha: 0.7),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Aviso de dado vindo do cache.
///
/// Deixa explícito que o conteúdo pode estar desatualizado — exigência do
/// modo offline desta PR.
class StaleDataBanner extends StatelessWidget {
  const StaleDataBanner({super.key, required this.cachedAt});

  final DateTime cachedAt;

  @override
  Widget build(BuildContext context) {
    final minutes = DateTime.now().difference(cachedAt).inMinutes;
    final label = minutes < 1
        ? 'agora há pouco'
        : minutes < 60
        ? 'há $minutes min'
        : 'há ${(minutes / 60).floor()} h';

    return Container(
      margin: const EdgeInsets.only(bottom: OrbitSpacing.md),
      padding: const EdgeInsets.symmetric(
        horizontal: OrbitSpacing.md,
        vertical: OrbitSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: OrbitColors.warning.withValues(alpha: 0.12),
        borderRadius: OrbitRadius.field,
        border: Border.all(color: OrbitColors.warning.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.cloud_off_rounded,
            size: 18,
            color: OrbitColors.warning,
          ),
          const SizedBox(width: OrbitSpacing.sm),
          Expanded(
            child: Text(
              'Sem conexão — mostrando dados salvos $label.',
              style: const TextStyle(fontSize: 12, color: OrbitColors.warning),
            ),
          ),
        ],
      ),
    );
  }
}

/// Etiqueta de procedência de indicador.
///
/// O backend classifica cada KPI em `dataQuality`. `OBSERVED` e `DERIVED` são
/// informação legítima e não recebem marca; `PROXY` e `MOCK` recebem, porque
/// mudam como o número deve ser lido.
class ProvenanceChip extends StatelessWidget {
  const ProvenanceChip({super.key, required this.dataQuality});

  final String dataQuality;

  @override
  Widget build(BuildContext context) {
    if (dataQuality != 'PROXY' && dataQuality != 'MOCK') {
      return const SizedBox.shrink();
    }
    final isMock = dataQuality == 'MOCK';
    return Tooltip(
      message: isMock
          ? 'Valor não observado — não representa dados reais da operação.'
          : 'Aproximação: o backend usa outra entidade como substituta.',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: (isMock ? OrbitColors.warning : OrbitColors.textSecondary)
              .withValues(alpha: 0.16),
          borderRadius: OrbitRadius.pill,
        ),
        child: Text(
          isMock ? 'não observado' : 'proxy',
          style: TextStyle(
            fontSize: 10,
            color: isMock ? OrbitColors.warning : OrbitColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
