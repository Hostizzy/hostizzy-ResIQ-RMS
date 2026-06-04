import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'supabase_client.dart';

class OfflineCache {
  static const _prefix = 'cache_';
  static const _pendingKey = 'offline_pending_ops';
  static const _ttlMinutes = 10;

  // ─── Read-through cache ───

  static Future<List<Map<String, dynamic>>> getCached(
    String table, {
    bool forceRefresh = false,
    String? orderBy,
    bool ascending = false,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final cacheKey = '$_prefix$table';
    final tsKey = '${cacheKey}_ts';

    // Check cache freshness
    if (!forceRefresh) {
      final cachedTs = prefs.getInt(tsKey) ?? 0;
      final age = DateTime.now().millisecondsSinceEpoch - cachedTs;
      if (age < _ttlMinutes * 60 * 1000) {
        final cached = prefs.getString(cacheKey);
        if (cached != null) {
          try {
            return List<Map<String, dynamic>>.from(
                jsonDecode(cached).map((x) => Map<String, dynamic>.from(x)));
          } catch (_) {}
        }
      }
    }

    // Fetch from Supabase
    try {
      var query = supabase.from(table).select();
      if (orderBy != null) {
        query = query.order(orderBy, ascending: ascending);
      }
      final data = await query;

      // Persist to cache
      await prefs.setString(cacheKey, jsonEncode(data));
      await prefs.setInt(tsKey, DateTime.now().millisecondsSinceEpoch);

      return List<Map<String, dynamic>>.from(
          (data as List).map((x) => Map<String, dynamic>.from(x)));
    } catch (e) {
      // Offline — return stale cache if available
      debugPrint('[OfflineCache] Fetch failed, using stale cache for $table');
      final cached = prefs.getString(cacheKey);
      if (cached != null) {
        return List<Map<String, dynamic>>.from(
            jsonDecode(cached).map((x) => Map<String, dynamic>.from(x)));
      }
      return [];
    }
  }

  static Future<void> invalidate(String table) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('$_prefix$table');
    await prefs.remove('${_prefix}${table}_ts');
  }

  // ─── Offline write queue ───

  static Future<void> queueWrite(String table, String op,
      Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    final pending = prefs.getStringList(_pendingKey) ?? [];
    pending.add(jsonEncode({
      'table': table,
      'op': op, // 'insert', 'update', 'delete'
      'data': data,
      'queued_at': DateTime.now().toIso8601String(),
    }));
    await prefs.setStringList(_pendingKey, pending);
    debugPrint('[OfflineCache] Queued $op on $table (${pending.length} pending)');
  }

  static Future<int> pendingCount() async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_pendingKey) ?? []).length;
  }

  static Future<void> syncPending() async {
    final prefs = await SharedPreferences.getInstance();
    final pending = prefs.getStringList(_pendingKey) ?? [];
    if (pending.isEmpty) return;

    debugPrint('[OfflineCache] Syncing ${pending.length} pending operations');
    final failed = <String>[];

    for (final entry in pending) {
      try {
        final op = jsonDecode(entry);
        final table = op['table'] as String;
        final data = Map<String, dynamic>.from(op['data']);

        switch (op['op']) {
          case 'insert':
            await supabase.from(table).insert(data);
            break;
          case 'update':
            final id = data.remove('id');
            if (id != null) {
              await supabase.from(table).update(data).eq('id', id);
            }
            break;
          case 'delete':
            final id = data['id'];
            if (id != null) {
              await supabase.from(table).delete().eq('id', id);
            }
            break;
        }
      } catch (e) {
        debugPrint('[OfflineCache] Sync failed: $e');
        failed.add(entry);
      }
    }

    await prefs.setStringList(_pendingKey, failed);
    debugPrint(
        '[OfflineCache] Sync done. ${pending.length - failed.length} succeeded, ${failed.length} failed');
  }
}
