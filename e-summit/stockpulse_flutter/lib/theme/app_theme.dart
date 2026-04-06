import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Colors from Obsidian Flux Design System
  static const Color background = Color(0xFF060E20);
  static const Color surface = Color(0xFF0F1930);
  static const Color surfaceContainer = Color(0xFF141F38);
  static const Color primary = Color(0xFF69F6B8);
  static const Color primaryContainer = Color(0xFF06B77F);
  static const Color secondary = Color(0xFFFF6F7E);
  static const Color tertiary = Color(0xFF47C4FF);
  
  static const Color onBackground = Color(0xFFDEE5FF);
  static const Color onSurface = Color(0xFFDEE5FF);
  static const Color onSurfaceVariant = Color(0xFFA3AAC4);

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: background,
      primaryColor: primary,
      colorScheme: const ColorScheme.dark(
        primary: primary,
        secondary: secondary,
        tertiary: tertiary,
        surface: surface,
        background: background,
        onPrimary: Color(0xFF005A3C),
        onSecondary: Color(0xFF490010),
        onSurface: onSurface,
        onBackground: onBackground,
      ),
      textTheme: TextTheme(
        displayLarge: GoogleFonts.spaceGrotesk(
          fontSize: 32,
          fontWeight: FontWeight.bold,
          color: onSurface,
        ),
        headlineMedium: GoogleFonts.spaceGrotesk(
          fontSize: 24,
          fontWeight: FontWeight.w600,
          color: onSurface,
        ),
        titleLarge: GoogleFonts.manrope(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: onSurface,
        ),
        bodyLarge: GoogleFonts.manrope(
          fontSize: 16,
          fontWeight: FontWeight.normal,
          color: onSurface,
        ),
        bodyMedium: GoogleFonts.manrope(
          fontSize: 14,
          fontWeight: FontWeight.normal,
          color: onSurfaceVariant,
        ),
        labelLarge: GoogleFonts.inter(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.5,
          color: onSurfaceVariant,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: const Color(0xFF005A3C),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.inter(
            fontWeight: FontWeight.w600,
            fontSize: 16,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }

  // Glassmorphic Style Helper
  static BoxDecoration glassDecoration({double blur = 12.0, double opacity = 0.4}) {
    return BoxDecoration(
      color: surfaceVariant().withValues(alpha: opacity),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(
        color: onSurfaceVariant.withValues(alpha: 0.1),
        width: 1,
      ),
    );
  }

  static Color surfaceVariant() => const Color(0xFF192540);
}
