import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app.dart';
import 'core/push_notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp();

  // TODO: Replace with your Supabase project credentials
  await Supabase.initialize(
    url: const String.fromEnvironment('SUPABASE_URL',
        defaultValue: 'https://dxthxsguqrxpurorpokq.supabase.co'),
    anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY',
        defaultValue: 'YOUR_SUPABASE_ANON_KEY'),
  );

  // Initialize push notifications (non-blocking)
  PushNotificationService().init();

  runApp(const ProviderScope(child: ResIQApp()));
}
