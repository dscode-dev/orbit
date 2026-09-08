/// Ler a etiqueta de um equipamento.
///
/// ## O que a etiqueta é, e o que ela não é
///
/// É uma **chave de busca**. Quem lê continua sendo quem está logado: o
/// servidor resolve o equipamento e responde de acordo com as permissões da
/// sessão. Ter o papel na mão não dá acesso a nada — e é por isso que esta
/// tela não guarda token, não o mostra e não o coloca em log.
///
/// ## Por que existe entrada manual
///
/// Casa de máquinas tem pouca luz, etiqueta velha descasca, e luva de raspa
/// não segura um celular firme. Quando a câmera não resolve, digitar o código
/// resolve — e é a diferença entre registrar a manutenção agora e registrar
/// de memória à noite.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/contracts/equipment_qr_contracts.dart';
import '../../../core/design/orbit_primitives.dart';
import '../../../core/presentation/field_registry.dart';
import '../../../core/presentation/orbit_format.dart';
import '../../../core/theme/orbit_theme.dart';
import '../../../core/widgets/section_states.dart';
import '../application/equipment_qr_providers.dart';
import '../data/equipment_qr_repository.dart';

class EquipmentScannerScreen extends ConsumerStatefulWidget {
  const EquipmentScannerScreen({super.key});

  @override
  ConsumerState<EquipmentScannerScreen> createState() =>
      _EquipmentScannerScreenState();
}

class _EquipmentScannerScreenState
    extends ConsumerState<EquipmentScannerScreen> {
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [BarcodeFormat.qrCode],
  );

  /// O token lido. Enquanto houver um, a câmera para de decidir: duas leituras
  /// seguidas do mesmo papel abririam duas folhas empilhadas.
  String? _token;

  /// O que foi lido e não era etiqueta do Orbit. Vale dizer — o contrário é a
  /// pessoa mirando a mesma etiqueta errada pela quinta vez.
  bool _naoReconhecido = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _aoDetectar(BarcodeCapture captura) {
    if (_token != null) return;
    for (final codigo in captura.barcodes) {
      final valor = codigo.rawValue;
      if (valor == null) continue;
      final token = equipmentQrToken(valor);
      if (token != null) {
        setState(() {
          _token = token;
          _naoReconhecido = false;
        });
        return;
      }
    }
    if (!_naoReconhecido) setState(() => _naoReconhecido = true);
  }

  void _limpar() => setState(() {
    _token = null;
    _naoReconhecido = false;
  });

  @override
  Widget build(BuildContext context) {
    final token = _token;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Ler etiqueta'),
        actions: [
          IconButton(
            onPressed: () => _controller.toggleTorch(),
            icon: const Icon(Icons.flashlight_on_outlined),
            tooltip: 'Lanterna',
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                MobileScanner(
                  controller: _controller,
                  onDetect: _aoDetectar,
                  errorBuilder: (context, error) =>
                      _CameraIndisponivel(error: error),
                ),
                const _Mira(),
                if (_naoReconhecido && token == null)
                  const Align(
                    alignment: Alignment.bottomCenter,
                    child: _Aviso(
                      texto: 'Este código não é uma etiqueta do Orbit.',
                    ),
                  ),
              ],
            ),
          ),

          /// O resultado ocupa a metade de baixo, onde o polegar alcança.
          if (token != null)
            Expanded(child: _Resultado(token: token, onFechar: _limpar))
          else
            const _EntradaManualBotao(),
        ],
      ),
    );
  }
}

/// Um quadro de mira. Não desenha regra nenhuma — orienta o enquadramento.
class _Mira extends StatelessWidget {
  const _Mira();

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: Center(
      child: Container(
        width: 220,
        height: 220,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white70, width: 2),
          borderRadius: OrbitRadius.card,
        ),
      ),
    ),
  );
}

class _Aviso extends StatelessWidget {
  const _Aviso({required this.texto});

  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(OrbitSpacing.gutter),
    child: Container(
      padding: const EdgeInsets.symmetric(
        horizontal: OrbitSpacing.gutter,
        vertical: OrbitSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.7),
        borderRadius: OrbitRadius.pill,
      ),
      child: Text(texto, style: const TextStyle(color: Colors.white)),
    ),
  );
}

class _CameraIndisponivel extends StatelessWidget {
  const _CameraIndisponivel({required this.error});

  final MobileScannerException error;

  @override
  Widget build(BuildContext context) {
    /// A permissão negada é a causa comum, e ela tem conserto do lado de quem
    /// lê — as outras não. Dizer qual é evita a viagem até o suporte.
    final semPermissao =
        error.errorCode == MobileScannerErrorCode.permissionDenied;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(OrbitSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.no_photography_outlined, color: Colors.white70),
            const SizedBox(height: OrbitSpacing.ms),
            Text(
              semPermissao
                  ? 'O Orbit precisa da câmera para ler a etiqueta. '
                        'Autorize nas configurações do aparelho.'
                  : 'Não foi possível abrir a câmera neste aparelho.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70),
            ),
          ],
        ),
      ),
    );
  }
}

/// Abre a digitação do código quando a câmera não resolve.
class _EntradaManualBotao extends StatelessWidget {
  const _EntradaManualBotao();

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: context.orbit.background,
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(OrbitSpacing.gutter),
        child: TextButton.icon(
          onPressed: () => showModalBottomSheet<void>(
            context: context,
            isScrollControlled: true,
            builder: (_) => const EquipmentManualEntrySheet(),
          ),
          icon: const Icon(Icons.keyboard_alt_outlined, size: 18),
          label: const Text('Digitar o código da etiqueta'),
        ),
      ),
    ),
  );
}

/// Digitar o código, para quando a câmera não resolve.
class EquipmentManualEntrySheet extends ConsumerStatefulWidget {
  const EquipmentManualEntrySheet({super.key});

  @override
  ConsumerState<EquipmentManualEntrySheet> createState() =>
      _EquipmentManualEntrySheetState();
}

class _EquipmentManualEntrySheetState
    extends ConsumerState<EquipmentManualEntrySheet> {
  final _campo = TextEditingController();
  String? _token;
  bool _invalido = false;

  @override
  void dispose() {
    _campo.dispose();
    super.dispose();
  }

  void _confirmar() {
    final token = equipmentQrToken(_campo.text);
    setState(() {
      _token = token;
      _invalido = token == null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final token = _token;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: OrbitSpacing.md,
          right: OrbitSpacing.md,
          top: OrbitSpacing.md,
          bottom: MediaQuery.viewInsetsOf(context).bottom + OrbitSpacing.md,
        ),
        child: token != null
            ? SizedBox(
                height: 360,
                child: _Resultado(
                  token: token,
                  onFechar: () => setState(() => _token = null),
                ),
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Código da etiqueta',
                    style: OrbitType.sectionTitle.copyWith(
                      color: context.orbit.ink,
                    ),
                  ),
                  const SizedBox(height: OrbitSpacing.sm),
                  TextField(
                    controller: _campo,
                    autofocus: true,
                    decoration: InputDecoration(
                      hintText: 'Cole o endereço ou digite o código',
                      errorText: _invalido
                          ? 'Este código não é uma etiqueta do Orbit.'
                          : null,
                    ),
                    onSubmitted: (_) => _confirmar(),
                  ),
                  const SizedBox(height: OrbitSpacing.md),
                  FilledButton(
                    onPressed: _confirmar,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 48),
                    ),
                    child: const Text('Buscar equipamento'),
                  ),
                ],
              ),
      ),
    );
  }
}

/// O equipamento que a etiqueta identificou.
class _Resultado extends ConsumerWidget {
  const _Resultado({required this.token, required this.onFechar});

  final String token;
  final VoidCallback onFechar;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final equipamento = ref.watch(equipmentByQrProvider(token));

    return ColoredBox(
      color: context.orbit.background,
      child: SafeArea(
        top: false,
        child: equipamento.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(OrbitSpacing.gutter),
            child: SectionLoading(lines: 4),
          ),
          error: (error, _) => ListView(
            padding: const EdgeInsets.all(OrbitSpacing.gutter),
            children: [
              SectionError(
                error: error,
                onRetry: () => ref.invalidate(equipmentByQrProvider(token)),
              ),
              const SizedBox(height: OrbitSpacing.sm),
              TextButton(onPressed: onFechar, child: const Text('Ler outra')),
            ],
          ),
          data: (dados) => _Equipamento(equipment: dados, onFechar: onFechar),
        ),
      ),
    );
  }
}

class _Equipamento extends StatelessWidget {
  const _Equipamento({required this.equipment, required this.onFechar});

  final EquipmentQrResolvedContract equipment;
  final VoidCallback onFechar;

  @override
  Widget build(BuildContext context) {
    final palette = context.orbit;
    final identificacao = [
      equipment.brand,
      equipment.model,
      if (equipment.serialNumber case final String serie) 'nº $serie',
    ].whereType<String>().where((parte) => parte.isNotEmpty).join(' · ');

    return ListView(
      padding: const EdgeInsets.only(bottom: OrbitSpacing.lg),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            OrbitSpacing.md,
            OrbitSpacing.md,
            OrbitSpacing.md,
            OrbitSpacing.sm,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                equipment.name,
                style: OrbitType.sectionTitle.copyWith(color: palette.ink),
              ),
              if (identificacao.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  identificacao,
                  style: OrbitType.caption.copyWith(color: palette.inkMuted),
                ),
              ],
            ],
          ),
        ),

        if (equipment.customer case final cliente?)
          OrbitListRow(
            title: cliente.name,
            subtitle: [
              equipment.serviceLocation,
              equipment.sector,
            ].whereType<String>().join(' · '),
            detail: cliente.contactName,
          ),

        if (equipment.lastService case final ultimo?)
          OrbitListRow(
            title: 'Último atendimento',
            subtitle: ultimo.type,
            detail: OrbitFormat.dateHourOf(ultimo.date),
          ),

        if (equipment.nextMaintenance case final proxima?)
          OrbitListRow(
            title: 'Próxima manutenção',
            detail: OrbitFormat.dateHourOf(proxima),
          ),

        /// As ações vêm do servidor e são mostradas como **o que é permitido**,
        /// não como botões: as telas que as executam ainda são as do
        /// atendimento, e um botão que leva a lugar nenhum é pior do que
        /// nenhum botão.
        if (equipment.allowedActions.isNotEmpty)
          OrbitSection(
            title: 'Permitido para você',
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: OrbitSpacing.gutter,
              ),
              child: Wrap(
                spacing: OrbitSpacing.sm,
                runSpacing: OrbitSpacing.sm,
                children: [
                  for (final acao in equipment.allowedActions)
                    OrbitStatusBadge(
                      label: equipmentFieldActionLabel(acao),
                      tone: OrbitTone.info,
                    ),
                ],
              ),
            ),
          ),

        const SizedBox(height: OrbitSpacing.md),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: OrbitSpacing.gutter),
          child: OutlinedButton.icon(
            onPressed: onFechar,
            icon: const Icon(Icons.qr_code_scanner, size: 18),
            label: const Text('Ler outra etiqueta'),
            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
          ),
        ),
      ],
    );
  }
}
