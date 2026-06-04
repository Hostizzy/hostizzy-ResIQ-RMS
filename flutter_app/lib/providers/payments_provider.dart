import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/supabase_client.dart';
import '../models/payment.dart';

final paymentsProvider = FutureProvider<List<Payment>>((ref) async {
  final res = await supabase
      .from('payments')
      .select()
      .order('payment_date', ascending: false);
  return (res as List).map((p) => Payment.fromJson(p)).toList();
});

final paymentsByBookingProvider =
    FutureProvider.family<List<Payment>, String>((ref, bookingId) async {
  final res = await supabase
      .from('payments')
      .select()
      .eq('booking_id', bookingId)
      .order('payment_date', ascending: false);
  return (res as List).map((p) => Payment.fromJson(p)).toList();
});

class PaymentService {
  Future<void> save(Map<String, dynamic> data) async {
    final id = data.remove('id');
    if (id != null) {
      await supabase.from('payments').update(data).eq('id', id);
    } else {
      await supabase.from('payments').insert(data);
    }
  }

  Future<void> delete(int id) async {
    await supabase.from('payments').delete().eq('id', id);
  }

  Future<void> recalculateStatus(String bookingId) async {
    final payments = await supabase
        .from('payments')
        .select('amount')
        .eq('booking_id', bookingId);
    final totalPaid = (payments as List)
        .fold<double>(0, (sum, p) => sum + ((p['amount'] ?? 0) as num).toDouble());

    final res = await supabase
        .from('reservations')
        .select('total_amount, ota_service_fee, booking_source')
        .eq('booking_id', bookingId)
        .limit(1);

    if ((res as List).isEmpty) return;

    final r = res.first;
    final total = ((r['total_amount'] ?? 0) as num).toDouble();
    final otaFee = ((r['ota_service_fee'] ?? 0) as num).toDouble();
    final isOta = r['booking_source'] != null && r['booking_source'] != 'DIRECT';
    final receivable = isOta ? total - otaFee : total;

    String status = 'pending';
    if (totalPaid >= receivable) {
      status = 'paid';
    } else if (totalPaid > 0) {
      status = 'partial';
    }

    await supabase
        .from('reservations')
        .update({'paid_amount': totalPaid, 'payment_status': status})
        .eq('booking_id', bookingId);
  }
}

final paymentServiceProvider = Provider((_) => PaymentService());
