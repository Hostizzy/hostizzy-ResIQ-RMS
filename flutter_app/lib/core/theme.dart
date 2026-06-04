import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class ResIQTheme {
  static const _primary = Color(0xFF0891B2);
  static const _primaryDark = Color(0xFF1B3A5C);
  static const _success = Color(0xFF059669);
  static const _warning = Color(0xFFD97706);
  static const _danger = Color(0xFFDC2626);

  static final light = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorSchemeSeed: _primary,
    scaffoldBackgroundColor: const Color(0xFFF8FAFC),
    textTheme: GoogleFonts.interTextTheme(),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: Color(0xFF0F172A),
      elevation: 0,
      scrolledUnderElevation: 1,
    ),
    cardTheme: CardTheme(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      color: Colors.white,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _primary, width: 2),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: _primary,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
        ),
        elevation: 0,
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      indicatorColor: _primary.withOpacity(0.12),
      labelTextStyle: WidgetStatePropertyAll(
        GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: _primary,
      foregroundColor: Colors.white,
      elevation: 4,
    ),
  );

  static final dark = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorSchemeSeed: _primary,
    scaffoldBackgroundColor: const Color(0xFF0F172A),
    textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
    cardTheme: CardTheme(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: Color(0xFF334155)),
      ),
      color: const Color(0xFF1E293B),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFF1E293B),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF334155)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF334155)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _primary, width: 2),
      ),
    ),
  );

  // Shared semantic colors for use outside the theme
  static const success = _success;
  static const warning = _warning;
  static const danger = _danger;
  static const primary = _primary;
  static const primaryDark = _primaryDark;
}
