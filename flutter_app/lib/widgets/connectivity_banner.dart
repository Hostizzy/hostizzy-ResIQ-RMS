import 'dart:async';
import 'package:flutter/material.dart';
import '../core/offline_cache.dart';

class ConnectivityBanner extends StatefulWidget {
  final Widget child;
  const ConnectivityBanner({super.key, required this.child});

  @override
  State<ConnectivityBanner> createState() => _ConnectivityBannerState();
}

class _ConnectivityBannerState extends State<ConnectivityBanner> {
  bool _wasOffline = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // Periodically try to sync pending operations
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _trySync());
  }

  Future<void> _trySync() async {
    final count = await OfflineCache.pendingCount();
    if (count > 0) {
      try {
        await OfflineCache.syncPending();
        if (mounted && _wasOffline) {
          setState(() => _wasOffline = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Back online — changes synced'),
              backgroundColor: Color(0xFF059669),
              duration: Duration(seconds: 2),
            ),
          );
        }
      } catch (_) {
        if (mounted) setState(() => _wasOffline = true);
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_wasOffline)
          MaterialBanner(
            content: const Text('You are offline. Changes will sync when connection is restored.'),
            backgroundColor: const Color(0xFFFEF3C7),
            leading: const Icon(Icons.wifi_off, color: Color(0xFF92400E)),
            actions: [
              TextButton(
                onPressed: _trySync,
                child: const Text('Retry'),
              ),
            ],
          ),
        Expanded(child: widget.child),
      ],
    );
  }
}
