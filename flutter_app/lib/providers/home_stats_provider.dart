import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../models/reservation.dart';
import 'reservations_provider.dart';
import 'properties_provider.dart';

class HomeStats {
  final int arrivalsToday;
  final int departuresToday;
  final int pendingPayments;
  final int activeBookings;
  final double monthRevenue;
  final int totalProperties;

  const HomeStats({
    this.arrivalsToday = 0,
    this.departuresToday = 0,
    this.pendingPayments = 0,
    this.activeBookings = 0,
    this.monthRevenue = 0,
    this.totalProperties = 0,
  });
}

final homeStatsProvider = FutureProvider<HomeStats>((ref) async {
  final reservations = await ref.watch(allReservationsProvider.future);
  final properties = await ref.watch(propertiesProvider.future);

  // IST today key
  final istNow = DateTime.now().toUtc().add(const Duration(hours: 5, minutes: 30));
  final todayKey = DateFormat('yyyy-MM-dd').format(istNow);
  final monthStart = DateTime(istNow.year, istNow.month, 1);

  int arrivals = 0, departures = 0, pending = 0, active = 0;
  double monthRevenue = 0;

  for (final r in reservations) {
    if (r.status == 'confirmed' || r.status == 'checked_in') active++;
    if (r.paymentStatus == 'pending' || r.paymentStatus == 'partial') pending++;
    if (r.status != 'cancelled') {
      if (r.checkIn == todayKey) arrivals++;
      if (r.checkOut == todayKey) departures++;
    }
    if (r.createdAt != null && r.createdAt!.isAfter(monthStart)) {
      monthRevenue += r.paidAmount;
    }
  }

  return HomeStats(
    arrivalsToday: arrivals,
    departuresToday: departures,
    pendingPayments: pending,
    activeBookings: active,
    monthRevenue: monthRevenue,
    totalProperties: properties.length,
  );
});
