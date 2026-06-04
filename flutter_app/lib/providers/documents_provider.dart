import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/supabase_client.dart';
import '../models/guest_document.dart';

final guestDocumentsProvider = FutureProvider<List<GuestDocument>>((ref) async {
  final docs = await supabase
      .from('guest_documents')
      .select()
      .order('submitted_at', ascending: false);

  final bookingIds = (docs as List)
      .map((d) => d['booking_id'])
      .where((id) => id != null)
      .toSet()
      .toList();

  Map<String, Map<String, dynamic>> reservationsMap = {};
  if (bookingIds.isNotEmpty) {
    final res = await supabase
        .from('reservations')
        .select('booking_id, property_name, guest_name, guest_phone')
        .inFilter('booking_id', bookingIds);
    for (final r in (res as List)) {
      reservationsMap[r['booking_id']] = r;
    }
  }

  return docs.map((d) {
    final r = reservationsMap[d['booking_id']];
    return GuestDocument.fromJson({
      ...d,
      'property_name': r?['property_name'],
      'guest_phone': r?['guest_phone'],
      'guest_name': d['guest_name'] ?? r?['guest_name'],
    });
  }).toList();
});

class DocumentService {
  Future<void> updateStatus(int docId, String status) async {
    await supabase
        .from('guest_documents')
        .update({'status': status})
        .eq('id', docId);
  }
}

final documentServiceProvider = Provider((_) => DocumentService());
