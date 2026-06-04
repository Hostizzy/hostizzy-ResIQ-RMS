import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/theme.dart';
import '../models/reservation.dart';
import '../providers/reservations_provider.dart';
import '../widgets/shimmer_card.dart';

final _searchQueryProvider = StateProvider<String>((_) => '');
final _statusFilterProvider = StateProvider<String?>((_) => null);

class ReservationsScreen extends ConsumerWidget {
  const ReservationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reservations = ref.watch(allReservationsProvider);
    final searchQuery = ref.watch(_searchQueryProvider);
    final statusFilter = ref.watch(_statusFilterProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Reservations',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20)),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () => _showFilterSheet(context, ref),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search guests, properties, booking IDs...',
                prefixIcon: const Icon(Icons.search, size: 20),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                      color: Theme.of(context).colorScheme.outline),
                ),
              ),
              onChanged: (v) =>
                  ref.read(_searchQueryProvider.notifier).state = v,
            ),
          ),

          // Status chips
          if (statusFilter != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Chip(
                label: Text(statusFilter),
                deleteIcon: const Icon(Icons.close, size: 16),
                onDeleted: () =>
                    ref.read(_statusFilterProvider.notifier).state = null,
              ),
            ),

          // List
          Expanded(
            child: reservations.when(
              loading: () => ListView(
                padding: const EdgeInsets.all(16),
                children: List.generate(8, (_) => const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: ShimmerCard(height: 100),
                )),
              ),
              error: (e, _) => Center(child: Text('Error: $e')),
              data: (list) {
                var filtered = list;

                if (searchQuery.isNotEmpty) {
                  final q = searchQuery.toLowerCase();
                  filtered = filtered.where((r) {
                    return r.guestName.toLowerCase().contains(q) ||
                        r.bookingId.toLowerCase().contains(q) ||
                        (r.propertyName ?? '').toLowerCase().contains(q) ||
                        r.guestPhone.contains(q);
                  }).toList();
                }

                if (statusFilter != null) {
                  filtered =
                      filtered.where((r) => r.status == statusFilter).toList();
                }

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.calendar_month_outlined,
                            size: 48,
                            color: Theme.of(context)
                                .colorScheme
                                .onSurfaceVariant
                                .withOpacity(0.3)),
                        const SizedBox(height: 12),
                        const Text('No reservations found'),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(allReservationsProvider);
                  },
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                    itemCount: filtered.length,
                    itemBuilder: (context, i) =>
                        _ReservationCard(reservation: filtered[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.go('/reservations/add'),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showFilterSheet(BuildContext context, WidgetRef ref) {
    final statuses = [
      'confirmed',
      'pending',
      'checked-in',
      'checked-out',
      'cancelled'
    ];

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Filter by status',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ActionChip(
                  label: const Text('All'),
                  onPressed: () {
                    ref.read(_statusFilterProvider.notifier).state = null;
                    Navigator.pop(context);
                  },
                ),
                ...statuses.map((s) => ActionChip(
                      label: Text(s.replaceAll('-', ' ')),
                      onPressed: () {
                        ref.read(_statusFilterProvider.notifier).state = s;
                        Navigator.pop(context);
                      },
                    )),
              ],
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}

class _ReservationCard extends StatelessWidget {
  final Reservation reservation;

  const _ReservationCard({required this.reservation});

  Color _statusColor() {
    switch (reservation.status) {
      case 'confirmed':
        return ResIQTheme.primary;
      case 'checked-in':
        return ResIQTheme.success;
      case 'checked-out':
        return const Color(0xFF0891B2);
      case 'pending':
        return ResIQTheme.warning;
      case 'cancelled':
        return ResIQTheme.danger;
      default:
        return Colors.grey;
    }
  }

  Widget _kycBadge() {
    final status = reservation.kycStatus;
    if (status == null || status == 'none') return const SizedBox.shrink();

    Color bg, fg;
    String icon;
    switch (status) {
      case 'verified':
        bg = const Color(0xFFDCFCE7);
        fg = const Color(0xFF166534);
        icon = '✓';
        break;
      case 'pending':
      case 'submitted':
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFF92400E);
        icon = '⏳';
        break;
      case 'rejected':
        bg = const Color(0xFFFEE2E2);
        fg = const Color(0xFF991B1B);
        icon = '✕';
        break;
      default:
        return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text('$icon KYC',
          style: TextStyle(
            color: fg,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          )),
    );
  }

  @override
  Widget build(BuildContext context) {
    final balance = reservation.balance;
    final checkIn = reservation.checkIn.isNotEmpty
        ? DateFormat('d MMM').format(DateTime.parse(reservation.checkIn))
        : '-';
    final checkOut = reservation.checkOut.isNotEmpty
        ? DateFormat('d MMM').format(DateTime.parse(reservation.checkOut))
        : '-';

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () =>
            context.go('/reservations/edit/${reservation.bookingId}'),
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(color: _statusColor(), width: 4),
            ),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top row: guest name + KYC badge + amount
              Row(
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Flexible(
                          child: Text(reservation.guestName,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                              overflow: TextOverflow.ellipsis),
                        ),
                        const SizedBox(width: 6),
                        _kycBadge(),
                      ],
                    ),
                  ),
                  Text(
                    '₹${reservation.totalAmount.round().toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{2})+(\d)(?!\d))'), (m) => '${m[1]},')}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),

              // Property + booking ID
              Row(
                children: [
                  Icon(Icons.villa_outlined,
                      size: 14,
                      color: Theme.of(context).colorScheme.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      reservation.propertyName ?? '-',
                      style: TextStyle(
                        fontSize: 13,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    reservation.bookingId,
                    style: TextStyle(
                      fontSize: 11,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Bottom row: dates + status + balance
              Row(
                children: [
                  _Chip(
                    icon: Icons.calendar_today,
                    text: '$checkIn → $checkOut',
                  ),
                  const SizedBox(width: 8),
                  _Chip(
                    icon: Icons.nightlight_round,
                    text: '${reservation.nights}N',
                  ),
                  const Spacer(),
                  if (balance > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '₹${balance.round()} due',
                        style: const TextStyle(
                          color: Color(0xFF991B1B),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  if (balance <= 0 && !reservation.isCancelled)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'Paid',
                        style: TextStyle(
                          color: Color(0xFF166534),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final IconData icon;
  final String text;

  const _Chip({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
          const SizedBox(width: 4),
          Text(text,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              )),
        ],
      ),
    );
  }
}
