/// Marca do Orbit.
///
/// O símbolo é o arquivo oficial extraído da logomarca; a tipografia
/// acompanha o Design System. Nenhum desenho novo — o app só posiciona o
/// símbolo entregue.
library;

import 'package:flutter/material.dart';

import '../theme/orbit_theme.dart';

/// Caminho único do símbolo. Trocar o arquivo aqui atualiza todo o app.
const String orbitSymbolAsset = 'assets/brand/orbit-symbol.png';

class OrbitSymbol extends StatelessWidget {
  const OrbitSymbol({super.key, this.size = 72});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      orbitSymbolAsset,
      width: size,
      height: size,
      filterQuality: FilterQuality.medium,
      semanticLabel: 'Orbit',
    );
  }
}

/// Símbolo + nome, usado na autenticação e no perfil.
class OrbitWordmark extends StatelessWidget {
  const OrbitWordmark({super.key, this.symbolSize = 64, this.showTagline = true});

  final double symbolSize;
  final bool showTagline;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        OrbitSymbol(size: symbolSize),
        const SizedBox(height: OrbitSpacing.sm),
        ShaderMask(
          shaderCallback: (bounds) => OrbitGradients.brand.createShader(bounds),
          child: const Text(
            'Orbit',
            style: TextStyle(
              fontSize: 30,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
              color: Colors.white,
            ),
          ),
        ),
        if (showTagline) ...[
          const SizedBox(height: OrbitSpacing.xs),
          Text(
            'OPERATIONS ERP',
            style: TextStyle(
              fontSize: 11,
              letterSpacing: 3,
              color: OrbitColors.textSecondary.withValues(alpha: 0.9),
            ),
          ),
        ],
      ],
    );
  }
}

/// Fundo da marca: azul profundo com o brilho azul–roxo da identidade.
class OrbitBackground extends StatelessWidget {
  const OrbitBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: RadialGradient(
          center: Alignment(-0.6, -0.8),
          radius: 1.4,
          colors: [Color(0xFF16305C), OrbitColors.deepSky],
        ),
      ),
      child: child,
    );
  }
}
