import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;
import 'supabase_client.dart';

class PushNotificationService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;

  Future<void> init() async {
    // Request permission (iOS + Android 13+)
    final settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional) {
      debugPrint('[Push] Permission granted');
      await _saveToken();
      _fcm.onTokenRefresh.listen((_) => _saveToken());
    } else {
      debugPrint('[Push] Permission denied');
    }

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('[Push] Foreground message: ${message.notification?.title}');
      // TODO: show an in-app snackbar or local notification
    });

    // Handle background/terminated tap
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('[Push] Opened from background: ${message.data}');
      // TODO: navigate to the relevant screen based on message.data
    });
  }

  Future<void> _saveToken() async {
    try {
      final token = await _fcm.getToken();
      if (token == null) return;

      debugPrint('[Push] FCM token: ${token.substring(0, 20)}...');

      // Store in Supabase push_subscriptions table (same as the web PWA)
      await supabase.from('push_subscriptions').upsert({
        'endpoint': token,
        'platform': 'android',
        'created_at': DateTime.now().toIso8601String(),
      }, onConflict: 'endpoint').catchError((e) {
        // Table might not exist yet — non-critical
        debugPrint('[Push] Failed to save token: $e');
      });
    } catch (e) {
      debugPrint('[Push] Token save error: $e');
    }
  }

  Future<String?> getToken() => _fcm.getToken();
}
