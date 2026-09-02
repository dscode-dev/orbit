/// Tema do Orbit Operator.
///
/// Inspirado no Design System web: azul céu profundo como base, gradiente
/// azul–roxo nos destaques, branco no conteúdo, superfícies discretamente
/// transparentes e bordas suaves.
///
/// O app de campo é usado sob luz forte e com luvas: o tema escuro é o padrão
/// (melhor contraste ao sol e menor consumo em OLED) e os alvos de toque
/// seguem o mínimo de 48dp do Material 3.
library;

import 'package:flutter/material.dart';

abstract final class OrbitColors {
  /// Azul céu profundo — fundo da marca.
  static const deepSky = Color(0xFF0B162C);
  static const deepSkyElevated = Color(0xFF111F3D);
  static const surface = Color(0xFF16264A);

  /// Gradiente azul–roxo da identidade.
  static const gradientStart = Color(0xFF2F6BFF);
  static const gradientEnd = Color(0xFF8B5CF6);

  /// Azul luminoso do símbolo.
  static const brand = Color(0xFF3B82F6);
  static const brandBright = Color(0xFF38BDF8);

  static const success = Color(0xFF34D399);
  static const warning = Color(0xFFFBBF24);
  static const danger = Color(0xFFF87171);

  static const textPrimary = Color(0xFFF8FAFC);
  static const textSecondary = Color(0xFF94A3B8);
  static const border = Color(0x1FFFFFFF);
}

abstract final class OrbitGradients {
  static const brand = LinearGradient(
    colors: [OrbitColors.gradientStart, OrbitColors.gradientEnd],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

abstract final class OrbitRadius {
  static const card = BorderRadius.all(Radius.circular(18));
  static const field = BorderRadius.all(Radius.circular(14));
  static const pill = BorderRadius.all(Radius.circular(999));
}

abstract final class OrbitSpacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
}

abstract final class OrbitTheme {
  static ThemeData dark() {
    const scheme = ColorScheme.dark(
      primary: OrbitColors.brand,
      onPrimary: Colors.white,
      secondary: OrbitColors.gradientEnd,
      onSecondary: Colors.white,
      surface: OrbitColors.deepSkyElevated,
      onSurface: OrbitColors.textPrimary,
      error: OrbitColors.danger,
      onError: Colors.white,
      outline: OrbitColors.textSecondary,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: OrbitColors.deepSky,
      fontFamily: 'Roboto',
    );

    return base.copyWith(
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: OrbitColors.textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
      ),
      cardTheme: CardThemeData(
        // Superfície discretamente transparente sobre o azul profundo.
        color: OrbitColors.surface.withValues(alpha: 0.55),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: const RoundedRectangleBorder(
          borderRadius: OrbitRadius.card,
          side: BorderSide(color: OrbitColors.border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: OrbitColors.surface.withValues(alpha: 0.5),
        border: const OutlineInputBorder(
          borderRadius: OrbitRadius.field,
          borderSide: BorderSide(color: OrbitColors.border),
        ),
        enabledBorder: const OutlineInputBorder(
          borderRadius: OrbitRadius.field,
          borderSide: BorderSide(color: OrbitColors.border),
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: OrbitRadius.field,
          borderSide: BorderSide(color: OrbitColors.brand, width: 1.6),
        ),
        labelStyle: const TextStyle(color: OrbitColors.textSecondary),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 18,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52), // alvo confortável com luvas
          shape: const RoundedRectangleBorder(borderRadius: OrbitRadius.field),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          side: const BorderSide(color: OrbitColors.border),
          shape: const RoundedRectangleBorder(borderRadius: OrbitRadius.field),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: OrbitColors.deepSkyElevated,
        indicatorColor: OrbitColors.brand.withValues(alpha: 0.22),
        surfaceTintColor: Colors.transparent,
        labelTextStyle: WidgetStatePropertyAll(
          TextStyle(fontSize: 12, color: OrbitColors.textSecondary),
        ),
      ),
      dividerTheme: const DividerThemeData(color: OrbitColors.border, space: 1),
      chipTheme: ChipThemeData(
        backgroundColor: OrbitColors.surface.withValues(alpha: 0.6),
        side: const BorderSide(color: OrbitColors.border),
        shape: const RoundedRectangleBorder(borderRadius: OrbitRadius.pill),
        labelStyle: const TextStyle(fontSize: 12),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: OrbitColors.surface,
        contentTextStyle: TextStyle(color: OrbitColors.textPrimary),
      ),
      textTheme: base.textTheme.apply(
        bodyColor: OrbitColors.textPrimary,
        displayColor: OrbitColors.textPrimary,
      ),
    );
  }
}
