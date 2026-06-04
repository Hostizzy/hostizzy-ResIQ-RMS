import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

class ShimmerCard extends StatelessWidget {
  final double height;

  const ShimmerCard({super.key, this.height = 80});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Shimmer.fromColors(
      baseColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFE2E8F0),
      highlightColor:
          isDark ? const Color(0xFF334155) : const Color(0xFFF1F5F9),
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}
