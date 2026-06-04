import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/supabase_client.dart';
import '../models/property.dart';

final propertiesProvider = FutureProvider<List<Property>>((ref) async {
  final res = await supabase
      .from('properties')
      .select()
      .order('name');

  return (res as List).map((p) => Property.fromJson(p)).toList();
});
