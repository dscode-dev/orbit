/// Tema do Orbit Operator.
///
/// ## O que mudou, e por quê
///
/// O tema anterior era azul-marinho com gradiente azul–roxo: bonito numa
/// apresentação, ruim numa laje ao meio-dia. Uma ferramenta de campo é lida em
/// pé, com luva, sob sol, entre uma tarefa e outra — o que ela precisa é
/// contraste alto, hierarquia clara e nenhuma decoração competindo com a
/// informação.
///
/// Agora o fundo é **branco**, o texto é quase preto, e a cor existe para
/// significar alguma coisa: azul é ação, verde é concluído, âmbar é atenção,
/// vermelho é problema. Nada é colorido por enfeite.
///
/// ## Pronto para o escuro, sem o escuro
///
/// Só o claro é implementado nesta rodada. Mas nenhuma tela conhece
/// `Colors.white` ou `Colors.blue`: elas pedem `OrbitPalette`, que é uma
/// `ThemeExtension`. Trocar a paleta é acrescentar um segundo objeto e ligá-lo
/// em `darkTheme` — nenhum widget muda.
library;

import 'package:flutter/material.dart';

/// Os tons crus. **Nenhuma tela usa este arquivo diretamente**: as telas leem
/// `OrbitPalette`, que é o que troca no dia do tema escuro.
abstract final class _Tokens {
  /// Superfícies: branco, e cinzas muito claros com leve viés frio.
  static const white = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFF6F7F9);
  static const surfaceSunken = Color(0xFFEFF1F5);
  static const border = Color(0xFFE2E5EB);
  static const borderStrong = Color(0xFFCBD1DA);

  /// Texto: quase preto, e cinzas com contraste conferido sobre branco.
  static const ink = Color(0xFF111827);
  static const inkMuted = Color(0xFF4B5563);
  static const inkSubtle = Color(0xFF6B7280);
  static const inkDisabled = Color(0xFF9CA3AF);

  /// Azul da marca. Ação, seleção e destaque — nunca área grande.
  static const brand = Color(0xFF1D4ED8);
  static const brandHover = Color(0xFF1E40AF);
  static const brandSoft = Color(0xFFEFF4FF);

  /// Semânticas.
  static const success = Color(0xFF15803D);
  static const successSoft = Color(0xFFECFDF3);
  static const warning = Color(0xFFB45309);
  static const warningSoft = Color(0xFFFFF7ED);
  static const danger = Color(0xFFB91C1C);
  static const dangerSoft = Color(0xFFFEF2F2);

  /// Roxo: **somente** inteligência. Não é cor de interface.
  static const intelligence = Color(0xFF6D28D9);
  static const intelligenceSoft = Color(0xFFF5F3FF);
}

/// A paleta semântica que as telas consomem.
///
/// Os nomes dizem o **papel**, não o tom: `surface`, `ink`, `accent`,
/// `success`. É o que permite trocar todos os valores de uma vez sem procurar
/// cor solta em cinquenta widgets.
@immutable
class OrbitPalette extends ThemeExtension<OrbitPalette> {
  const OrbitPalette({
    required this.background,
    required this.surface,
    required this.surfaceMuted,
    required this.surfaceSunken,
    required this.border,
    required this.borderStrong,
    required this.ink,
    required this.inkMuted,
    required this.inkSubtle,
    required this.inkDisabled,
    required this.accent,
    required this.accentStrong,
    required this.accentSoft,
    required this.success,
    required this.successSoft,
    required this.warning,
    required this.warningSoft,
    required this.danger,
    required this.dangerSoft,
    required this.intelligence,
    required this.intelligenceSoft,
  });

  final Color background;
  final Color surface;
  final Color surfaceMuted;
  final Color surfaceSunken;
  final Color border;
  final Color borderStrong;
  final Color ink;
  final Color inkMuted;
  final Color inkSubtle;
  final Color inkDisabled;
  final Color accent;
  final Color accentStrong;
  final Color accentSoft;
  final Color success;
  final Color successSoft;
  final Color warning;
  final Color warningSoft;
  final Color danger;
  final Color dangerSoft;
  final Color intelligence;
  final Color intelligenceSoft;

  static const light = OrbitPalette(
    background: _Tokens.white,
    surface: _Tokens.white,
    surfaceMuted: _Tokens.surfaceMuted,
    surfaceSunken: _Tokens.surfaceSunken,
    border: _Tokens.border,
    borderStrong: _Tokens.borderStrong,
    ink: _Tokens.ink,
    inkMuted: _Tokens.inkMuted,
    inkSubtle: _Tokens.inkSubtle,
    inkDisabled: _Tokens.inkDisabled,
    accent: _Tokens.brand,
    accentStrong: _Tokens.brandHover,
    accentSoft: _Tokens.brandSoft,
    success: _Tokens.success,
    successSoft: _Tokens.successSoft,
    warning: _Tokens.warning,
    warningSoft: _Tokens.warningSoft,
    danger: _Tokens.danger,
    dangerSoft: _Tokens.dangerSoft,
    intelligence: _Tokens.intelligence,
    intelligenceSoft: _Tokens.intelligenceSoft,
  );

  @override
  OrbitPalette copyWith({
    Color? background,
    Color? surface,
    Color? surfaceMuted,
    Color? surfaceSunken,
    Color? border,
    Color? borderStrong,
    Color? ink,
    Color? inkMuted,
    Color? inkSubtle,
    Color? inkDisabled,
    Color? accent,
    Color? accentStrong,
    Color? accentSoft,
    Color? success,
    Color? successSoft,
    Color? warning,
    Color? warningSoft,
    Color? danger,
    Color? dangerSoft,
    Color? intelligence,
    Color? intelligenceSoft,
  }) {
    return OrbitPalette(
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceMuted: surfaceMuted ?? this.surfaceMuted,
      surfaceSunken: surfaceSunken ?? this.surfaceSunken,
      border: border ?? this.border,
      borderStrong: borderStrong ?? this.borderStrong,
      ink: ink ?? this.ink,
      inkMuted: inkMuted ?? this.inkMuted,
      inkSubtle: inkSubtle ?? this.inkSubtle,
      inkDisabled: inkDisabled ?? this.inkDisabled,
      accent: accent ?? this.accent,
      accentStrong: accentStrong ?? this.accentStrong,
      accentSoft: accentSoft ?? this.accentSoft,
      success: success ?? this.success,
      successSoft: successSoft ?? this.successSoft,
      warning: warning ?? this.warning,
      warningSoft: warningSoft ?? this.warningSoft,
      danger: danger ?? this.danger,
      dangerSoft: dangerSoft ?? this.dangerSoft,
      intelligence: intelligence ?? this.intelligence,
      intelligenceSoft: intelligenceSoft ?? this.intelligenceSoft,
    );
  }

  @override
  OrbitPalette lerp(OrbitPalette? other, double t) {
    if (other == null) return this;
    Color mix(Color a, Color b) => Color.lerp(a, b, t) ?? a;
    return OrbitPalette(
      background: mix(background, other.background),
      surface: mix(surface, other.surface),
      surfaceMuted: mix(surfaceMuted, other.surfaceMuted),
      surfaceSunken: mix(surfaceSunken, other.surfaceSunken),
      border: mix(border, other.border),
      borderStrong: mix(borderStrong, other.borderStrong),
      ink: mix(ink, other.ink),
      inkMuted: mix(inkMuted, other.inkMuted),
      inkSubtle: mix(inkSubtle, other.inkSubtle),
      inkDisabled: mix(inkDisabled, other.inkDisabled),
      accent: mix(accent, other.accent),
      accentStrong: mix(accentStrong, other.accentStrong),
      accentSoft: mix(accentSoft, other.accentSoft),
      success: mix(success, other.success),
      successSoft: mix(successSoft, other.successSoft),
      warning: mix(warning, other.warning),
      warningSoft: mix(warningSoft, other.warningSoft),
      danger: mix(danger, other.danger),
      dangerSoft: mix(dangerSoft, other.dangerSoft),
      intelligence: mix(intelligence, other.intelligence),
      intelligenceSoft: mix(intelligenceSoft, other.intelligenceSoft),
    );
  }
}

/// Os nomes semânticos que as telas já usavam, agora apontando para o claro.
///
/// O vocabulário anterior já era quase todo de papel — `textSecondary`,
/// `warning`, `danger`, `success` —, e só os tons (`deepSky`, `brandBright`)
/// eram nome de cor. Repontá-lo é o que faz as trinta e três telas existentes
/// nascerem no tema branco sem trinta e três edições, e é a costura por onde a
/// migração continua: quem toca numa tela passa a usar `context.orbit`.
///
/// **Nada aqui é constante de tom.** Todos os valores vêm de `OrbitPalette`,
/// que é o objeto que troca no dia do tema escuro.
abstract final class OrbitColors {
  static const textPrimary = _Tokens.ink;
  static const textSecondary = _Tokens.inkMuted;
  static const border = _Tokens.border;
  static const surface = _Tokens.surfaceMuted;

  /// Azul de ação. Usado em botão, link, seleção — nunca como área grande.
  static const brand = _Tokens.brand;

  /// Antes era um azul mais claro para brilhar no escuro. No branco, o que
  /// destaca é o tom mais forte: contraste vem do escuro sobre claro.
  static const brandBright = _Tokens.brandHover;

  static const success = _Tokens.success;
  static const warning = _Tokens.warning;
  static const danger = _Tokens.danger;

  /// Roxo, e **somente** para a camada de inteligência.
  static const intelligence = _Tokens.intelligence;
}

/// Acesso curto à paleta: `context.orbit.accent`.
extension OrbitPaletteAccess on BuildContext {
  OrbitPalette get orbit =>
      Theme.of(this).extension<OrbitPalette>() ?? OrbitPalette.light;
}

/// Raios. Consistentes e discretos — 24–32 em tudo faz interface de brinquedo.
abstract final class OrbitRadius {
  static const card = BorderRadius.all(Radius.circular(14));
  static const field = BorderRadius.all(Radius.circular(12));
  static const pill = BorderRadius.all(Radius.circular(999));
}

/// A escala de espaço. Múltiplos de quatro, e só estes.
abstract final class OrbitSpacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const ms = 12.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
}

/// A hierarquia tipográfica.
///
/// Seis papéis, e cada um com um trabalho: título de tela, título de seção,
/// corpo, apoio, rótulo e **número**. O número tem estilo próprio porque
/// horário e contagem precisam ser lidos de relance, com dígitos de largura
/// fixa para não dançarem entre uma linha e outra.
abstract final class OrbitType {
  static const screenTitle = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w700,
    height: 1.2,
    letterSpacing: -0.2,
  );
  static const sectionTitle = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.3,
  );
  static const itemTitle = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    height: 1.3,
  );
  static const body = TextStyle(fontSize: 14, height: 1.4);
  static const caption = TextStyle(fontSize: 12.5, height: 1.35);
  static const label = TextStyle(
    fontSize: 11.5,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.2,
  );

  /// Horário e contagem: tabular, para alinhar em coluna.
  static const numeric = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    fontFeatures: [FontFeature.tabularFigures()],
  );
}

abstract final class OrbitTheme {
  /// O tema claro — o único desta rodada.
  static ThemeData light() {
    const palette = OrbitPalette.light;

    const scheme = ColorScheme.light(
      primary: _Tokens.brand,
      onPrimary: _Tokens.white,
      /// Secundária também azul: roxo é reservado à inteligência.
      secondary: _Tokens.brandHover,
      onSecondary: _Tokens.white,
      surface: _Tokens.white,
      onSurface: _Tokens.ink,
      surfaceContainerHighest: _Tokens.surfaceMuted,
      error: _Tokens.danger,
      onError: _Tokens.white,
      outline: _Tokens.border,
      outlineVariant: _Tokens.borderStrong,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: palette.background,
      fontFamily: 'Roboto',
    );

    return base.copyWith(
      extensions: const [palette],
      appBarTheme: const AppBarTheme(
        backgroundColor: _Tokens.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: _Tokens.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: _Tokens.ink,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
      ),
      /// Borda leve em vez de sombra: elevação empilhada vira ruído numa lista.
      cardTheme: const CardThemeData(
        color: _Tokens.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: OrbitRadius.card,
          side: BorderSide(color: _Tokens.border),
        ),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        filled: true,
        fillColor: _Tokens.white,
        border: OutlineInputBorder(
          borderRadius: OrbitRadius.field,
          borderSide: BorderSide(color: _Tokens.borderStrong),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: OrbitRadius.field,
          borderSide: BorderSide(color: _Tokens.borderStrong),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: OrbitRadius.field,
          borderSide: BorderSide(color: _Tokens.brand, width: 1.6),
        ),
        labelStyle: TextStyle(color: _Tokens.inkMuted),
        contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      ),
      /// 52 e 48: alvos confortáveis para quem trabalha de luva.
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: const RoundedRectangleBorder(borderRadius: OrbitRadius.field),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          foregroundColor: _Tokens.ink,
          side: const BorderSide(color: _Tokens.borderStrong),
          shape: const RoundedRectangleBorder(borderRadius: OrbitRadius.field),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: _Tokens.brand,
          minimumSize: const Size(0, 44),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: _Tokens.white,
        indicatorColor: _Tokens.brandSoft,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        height: 64,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 11.5,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w600
                : FontWeight.w500,
            color: states.contains(WidgetState.selected)
                ? _Tokens.brand
                : _Tokens.inkSubtle,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 22,
            color: states.contains(WidgetState.selected)
                ? _Tokens.brand
                : _Tokens.inkSubtle,
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: _Tokens.border,
        space: 1,
        thickness: 1,
      ),
      chipTheme: const ChipThemeData(
        backgroundColor: _Tokens.surfaceMuted,
        side: BorderSide(color: _Tokens.border),
        shape: RoundedRectangleBorder(borderRadius: OrbitRadius.pill),
        labelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
        padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: _Tokens.inkSubtle,
        textColor: _Tokens.ink,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: _Tokens.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
        ),
      ),
      dialogTheme: const DialogThemeData(
        backgroundColor: _Tokens.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: OrbitRadius.card),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: _Tokens.ink,
        contentTextStyle: TextStyle(color: _Tokens.white),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: _Tokens.brand,
        linearTrackColor: _Tokens.surfaceSunken,
      ),
      textTheme: base.textTheme.apply(
        bodyColor: _Tokens.ink,
        displayColor: _Tokens.ink,
      ),
    );
  }
}
