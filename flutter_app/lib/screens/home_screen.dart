import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/auth_provider.dart';
import '../core/theme.dart';
import '../providers/home_stats_provider.dart';
import '../widgets/stat_card.dart';
import '../widgets/shimmer_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  String _formatCurrency(double amount) {
    if (amount >= 10000000) return '₹${(amount / 10000000).toStringAsFixed(2)}Cr';
    if (amount >= 100000) return '₹${(amount / 100000).toStringAsFixed(1)}L';
    if (amount >= 1000) return '₹${(amount / 1000).toStringAsFixed(1)}K';
    return '₹${amount.round()}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentUserProfileProvider);
    final stats = ref.watch(homeStatsProvider);
    final userName = profile.valueOrNull?['name'] ?? 'there';
    final today = DateFormat('EEE, d MMM').format(DateTime.now());

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_greeting(),
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
            Text('Hi, $userName',
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(today,
                  style: TextStyle(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w500,
                  )),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout_outlined, size: 22),
            onPressed: () => ref.read(authServiceProvider).signOut(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(homeStatsProvider);
        },
        child: stats.when(
          loading: () => _buildShimmer(),
          error: (e, _) => Center(child: Text('Error: $e')),
          data: (s) => _buildContent(context, s),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.go('/reservations/add'),
        icon: const Icon(Icons.add),
        label: const Text('New Booking'),
      ),
    );
  }

  Widget _buildShimmer() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: List.generate(6, (_) => const Padding(
        padding: EdgeInsets.only(bottom: 12),
        child: ShimmerCard(height: 80),
      )),
    );
  }

  Widget _buildContent(BuildContext context, HomeStats s) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Today section
        Text('Today',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: StatCard(
                label: 'Arrivals',
                value: '${s.arrivalsToday}',
                color: ResIQTheme.primary,
                icon: Icons.login,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: StatCard(
                label: 'Departures',
                value: '${s.departuresToday}',
                color: ResIQTheme.warning,
                icon: Icons.logout,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: StatCard(
                label: 'Payments Due',
                value: '${s.pendingPayments}',
                color: s.pendingPayments > 0 ? ResIQTheme.danger : ResIQTheme.success,
                icon: Icons.payments_outlined,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: StatCard(
                label: 'Active Bookings',
                value: '${s.activeBookings}',
                color: ResIQTheme.primary,
                icon: Icons.calendar_today,
              ),
            ),
          ],
        ),

        const SizedBox(height: 24),

        // Overview section
        Text('This Month',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: StatCard(
                label: 'Revenue',
                value: _formatCurrency(s.monthRevenue),
                color: ResIQTheme.success,
                icon: Icons.trending_up,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: StatCard(
                label: 'Properties',
                value: '${s.totalProperties}',
                color: ResIQTheme.primaryDark,
                icon: Icons.villa_outlined,
              ),
            ),
          ],
        ),

        const SizedBox(height: 100), // FAB clearance
      ],
    );
  }
}
