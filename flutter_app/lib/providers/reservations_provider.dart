import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/supabase_client.dart';
import '../models/reservation.dart';

final reservationsProvider = FutureProvider<List<Reservation>>((ref) async {
  final res = await supabase
      .from('reservations')
      .select()
      .not('status', 'eq', 'cancelled')
      .order('check_in', ascending: false);

  return (res as List).map((r) => Reservation.fromJson(r)).toList();
});

final allReservationsProvider = FutureProvider<List<Reservation>>((ref) async {
  final res = await supabase
      .from('reservations')
      .select()
      .order('check_in', ascending: false);

  return (res as List).map((r) => Reservation.fromJson(r)).toList();
});

final reservationByIdProvider =
    FutureProvider.family<Reservation?, String>((ref, bookingId) async {
  final res = await supabase
      .from('reservations')
      .select()
      .eq('booking_id', bookingId)
      .limit(1);

  if ((res as List).isEmpty) return null;
  return Reservation.fromJson(res.first);
});

class ReservationService {
  Future<void> save(Map<String, dynamic> data) async {
    final id = data.remove('id');
    if (id != null) {
      await supabase.from('reservations').update(data).eq('id', id);
    } else {
      await supabase.from('reservations').insert(data);
    }
  }

  Future<void> delete(String bookingId) async {
    await supabase.from('reservations').delete().eq('booking_id', bookingId);
  }

  Future<void> updateStatus(String bookingId, String status) async {
    await supabase
        .from('reservations')
        .update({'status': status})
        .eq('booking_id', bookingId);
  }
}

final reservationServiceProvider = Provider((_) => ReservationService());
