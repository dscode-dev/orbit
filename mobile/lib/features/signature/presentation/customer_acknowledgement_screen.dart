/// Aceite do cliente.
///
/// ## O aparelho passa de mão
///
/// Esta é a única tela do app pensada para ser lida por **outra pessoa**. Ela
/// é empurrada fora do shell, então a barra de navegação do app não aparece:
/// enquanto o cliente revisa o resumo e confirma, o resto do trabalho do
/// técnico fica fora de vista. A seta de voltar continua ali — quem devolve o
/// aparelho é o técnico, e prendê-lo na tela não protegeria nada.
///
/// ## O que o cliente vê é o que o servidor congelou
///
/// `serviceSummary` chega redigido, e é exatamente o texto que o `contentHash`
/// cobre. Montar um resumo alternativo aqui quebraria a correspondência: o
/// cliente concordaria com um texto e o backend registraria outro.
///
/// ## Aceite não é assinatura
///
/// A assinatura gráfica é opcional por política (`signatureRequired: false`).
/// Por isso o termo é "aceite", e não "assinatura do cliente" — e em lugar
/// nenhum se promete assinatura digital certificada.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/contracts/mobile_signature_contracts.dart';
import '../../../core/errors/orbit_exception.dart';
import '../../../core/presentation/orbit_format.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../../field/application/execution_controller.dart' show newCommandId;
import '../application/signature_providers.dart';

class CustomerAcknowledgementScreen extends ConsumerStatefulWidget {
  const CustomerAcknowledgementScreen({super.key, required this.operationId});

  final String operationId;

  @override
  ConsumerState<CustomerAcknowledgementScreen> createState() =>
      _CustomerAcknowledgementScreenState();
}

class _CustomerAcknowledgementScreenState
    extends ConsumerState<CustomerAcknowledgementScreen> {
  final _signerName = TextEditingController();
  bool _sending = false;
  String? _failure;
  CustomerAcknowledgementResult? _result;

  @override
  void dispose() {
    _signerName.dispose();
    super.dispose();
  }

  Future<void> _submit(CustomerAcknowledgementPreparation preparation) async {
    final name = _signerName.text.trim();
    if (name.length < 2 || _sending) return;

    setState(() {
      _sending = true;
      _failure = null;
    });
    try {
      final result = await ref
          .read(signatureRepositoryProvider)
          .acknowledge(
            widget.operationId,
            signerName: name,

            /// Devolvidos **verbatim**: é o que amarra o aceite ao texto lido.
            contentVersion: preparation.contentVersion,
            contentHash: preparation.contentHash,
            commandId: newCommandId(),
          );
      if (mounted) setState(() => _result = result);
    } on OrbitException catch (error) {
      /// 409 significa que o atendimento mudou desde que o resumo foi
      /// congelado. A saída é recarregar e coletar de novo — nunca registrar
      /// concordância com um texto que o cliente não leu.
      if (error.isConflict) {
        ref.invalidate(acknowledgementPreparationProvider(widget.operationId));
      }
      if (mounted) setState(() => _failure = error.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final preparation = ref.watch(
      acknowledgementPreparationProvider(widget.operationId),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Aceite do cliente')),
      body: SafeArea(
        child: preparation.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(OrbitSpacing.md),
            child: SectionLoading(lines: 5),
          ),
          error: (error, _) => ListView(
            padding: const EdgeInsets.all(OrbitSpacing.md),
            children: [
              SectionError(
                error: error,
                onRetry: () => ref.invalidate(
                  acknowledgementPreparationProvider(widget.operationId),
                ),
              ),
            ],
          ),
          data: (value) => _result == null
              ? _Form(
                  preparation: value,
                  signerName: _signerName,
                  sending: _sending,
                  failure: _failure,
                  onSubmit: () => _submit(value),
                )
              : _Accepted(result: _result!),
        ),
      ),
    );
  }
}

class _Form extends StatelessWidget {
  const _Form({
    required this.preparation,
    required this.signerName,
    required this.sending,
    required this.failure,
    required this.onSubmit,
  });

  final CustomerAcknowledgementPreparation preparation;
  final TextEditingController signerName;
  final bool sending;
  final String? failure;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.only(
        left: OrbitSpacing.md,
        right: OrbitSpacing.md,
        top: OrbitSpacing.md,

        /// O teclado empurra o conteúdo; o botão nunca fica coberto.
        bottom: MediaQuery.viewInsetsOf(context).bottom + OrbitSpacing.xl,
      ),
      children: [
        if (preparation.existingAcknowledgement case final existing?)
          _PreviousAcknowledgement(existing: existing),

        SectionCard(
          title: 'Resumo do atendimento',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (preparation.customerName case final name?)
                _Line(label: 'Cliente', value: name),
              if (preparation.performedAt != null)
                _Line(
                  label: 'Realizado em',
                  value: OrbitFormat.dateHourOf(preparation.performedAt),
                ),
              for (final equipment in preparation.equipment)
                _Line(
                  label: 'Equipamento',
                  value: '${equipment.name} · ${equipment.code}',
                ),
              const SizedBox(height: OrbitSpacing.sm),

              /// O texto do servidor, como veio.
              Text(
                preparation.serviceSummary,
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.4,
                  color: OrbitColors.textPrimary,
                ),
              ),
            ],
          ),
        ),

        SectionCard(
          title: 'Quem está dando ciência',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: signerName,
                textCapitalization: TextCapitalization.words,
                maxLength: 180,
                decoration: const InputDecoration(
                  labelText: 'Nome de quem recebeu o serviço',
                ),
              ),

              /// O nome fica **no aceite**, não no cadastro do cliente: quem
              /// recebe pode ser o zelador, o síndico, qualquer um presente.
              const Text(
                'O nome fica registrado neste atendimento e não altera o '
                'cadastro do cliente.',
                style: TextStyle(
                  fontSize: 12,
                  color: OrbitColors.textSecondary,
                ),
              ),

              if (failure case final String message) ...[
                const SizedBox(height: OrbitSpacing.sm),
                Text(
                  message,
                  style: const TextStyle(
                    fontSize: 13,
                    color: OrbitColors.danger,
                  ),
                ),
              ],

              const SizedBox(height: OrbitSpacing.md),
              Semantics(
                button: true,
                enabled: !sending,
                label: 'Confirmar ciência',
                child: FilledButton(
                  onPressed: sending ? null : onSubmit,
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 52)),
                  child: Text(sending ? 'Registrando…' : 'Confirmar ciência'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Um aceite já registrado — fato, sem juízo sobre validade.
class _PreviousAcknowledgement extends StatelessWidget {
  const _PreviousAcknowledgement({required this.existing});

  final ExistingAcknowledgement existing;

  @override
  Widget build(BuildContext context) => SectionCard(
    title: 'Ciência já registrada',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          existing.signerName,
          style: const TextStyle(fontSize: 14, color: OrbitColors.textPrimary),
        ),
        Text(
          OrbitFormat.dateHourOf(existing.acknowledgedAt),
          style: const TextStyle(
            fontSize: 12,
            color: OrbitColors.textSecondary,
          ),
        ),
        const SizedBox(height: OrbitSpacing.sm),
        const Text(
          'Se o atendimento mudou depois disso, colete a ciência novamente.',
          style: TextStyle(fontSize: 12, color: OrbitColors.textSecondary),
        ),
      ],
    ),
  );
}

class _Accepted extends StatelessWidget {
  const _Accepted({required this.result});

  final CustomerAcknowledgementResult result;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(OrbitSpacing.md),
    children: [
      SectionCard(
        title: 'Ciência registrada',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              result.signerName,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: OrbitColors.textPrimary,
              ),
            ),
            Text(
              OrbitFormat.dateHourOf(result.acknowledgedAt),
              style: const TextStyle(
                fontSize: 13,
                color: OrbitColors.textSecondary,
              ),
            ),
            const SizedBox(height: OrbitSpacing.sm),

            /// Ciência não é documento emitido — e não se promete que seja.
            const Text(
              'O documento do atendimento é emitido em separado.',
              style: TextStyle(fontSize: 12, color: OrbitColors.textSecondary),
            ),
          ],
        ),
      ),
      FilledButton(
        onPressed: () => Navigator.of(context).pop(),
        style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
        child: const Text('Voltar ao atendimento'),
      ),
    ],
  );
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            color: OrbitColors.textSecondary,
          ),
        ),
        Text(
          value,
          style: const TextStyle(fontSize: 14, color: OrbitColors.textPrimary),
        ),
      ],
    ),
  );
}
