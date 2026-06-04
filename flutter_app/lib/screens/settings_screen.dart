import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/auth_provider.dart';
import '../core/supabase_client.dart';
import '../core/theme.dart';

final _prefsProvider = FutureProvider<SharedPreferences>(
    (_) => SharedPreferences.getInstance());

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _businessName = TextEditingController();
  final _businessPhone = TextEditingController();
  final _businessEmail = TextEditingController();
  final _gst = TextEditingController();
  bool _darkMode = false;
  bool _emailNotifications = true;
  bool _whatsappNotifications = true;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _businessName.text = prefs.getString('businessName') ?? '';
      _businessPhone.text = prefs.getString('businessPhone') ?? '';
      _businessEmail.text = prefs.getString('businessEmail') ?? '';
      _gst.text = prefs.getString('businessGST') ?? '';
      _darkMode = prefs.getBool('darkMode') ?? false;
      _emailNotifications = prefs.getBool('emailNotifications') ?? true;
      _whatsappNotifications = prefs.getBool('whatsappNotifications') ?? true;
      _loaded = true;
    });
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('businessName', _businessName.text.trim());
    await prefs.setString('businessPhone', _businessPhone.text.trim());
    await prefs.setString('businessEmail', _businessEmail.text.trim());
    await prefs.setString('businessGST', _gst.text.trim());
    await prefs.setBool('emailNotifications', _emailNotifications);
    await prefs.setBool('whatsappNotifications', _whatsappNotifications);

    // Also persist to Supabase business_settings for cross-device sync
    try {
      final profile = ref.read(currentUserProfileProvider).valueOrNull;
      final ownerId = profile?['id']?.toString();
      if (ownerId != null) {
        final now = DateTime.now().toIso8601String();
        final entries = {
          'businessName': _businessName.text.trim(),
          'businessPhone': _businessPhone.text.trim(),
          'businessEmail': _businessEmail.text.trim(),
          'businessGST': _gst.text.trim(),
          'emailNotifications': _emailNotifications,
          'whatsappNotifications': _whatsappNotifications,
        };
        final rows = entries.entries
            .map((e) => {
                  'owner_id': ownerId,
                  'key': e.key,
                  'value': e.value,
                  'updated_at': now,
                })
            .toList();
        await supabase
            .from('business_settings')
            .upsert(rows, onConflict: 'owner_id,key');
      }
    } catch (_) {}

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Settings saved'),
          backgroundColor: Color(0xFF059669),
        ),
      );
    }
  }

  @override
  void dispose() {
    _businessName.dispose();
    _businessPhone.dispose();
    _businessEmail.dispose();
    _gst.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(currentUserProfileProvider);
    final userEmail = profile.valueOrNull?['email'] ?? '';

    if (!_loaded) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Account
          _SectionTitle('Account'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: ResIQTheme.primary.withOpacity(0.1),
                    child: Text(
                      (userEmail.isNotEmpty ? userEmail[0] : '?').toUpperCase(),
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 20,
                        color: ResIQTheme.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(profile.valueOrNull?['name'] ?? 'User',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 15)),
                        Text(userEmail,
                            style: TextStyle(
                              fontSize: 13,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            )),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => ref.read(authServiceProvider).signOut(),
                    child: const Text('Logout',
                        style: TextStyle(color: ResIQTheme.danger)),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          // Business Profile
          _SectionTitle('Business Profile'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  TextField(
                    controller: _businessName,
                    decoration:
                        const InputDecoration(labelText: 'Business Name'),
                    textCapitalization: TextCapitalization.words,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _businessEmail,
                    decoration:
                        const InputDecoration(labelText: 'Business Email'),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _businessPhone,
                    decoration:
                        const InputDecoration(labelText: 'Business Phone'),
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _gst,
                    decoration: const InputDecoration(labelText: 'GST Number'),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 24),

          // Notifications
          _SectionTitle('Notifications'),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  title: const Text('Email Notifications'),
                  subtitle: const Text('Receive booking confirmations via email'),
                  value: _emailNotifications,
                  onChanged: (v) => setState(() => _emailNotifications = v),
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: const Text('WhatsApp Notifications'),
                  subtitle: const Text('Receive updates via WhatsApp'),
                  value: _whatsappNotifications,
                  onChanged: (v) =>
                      setState(() => _whatsappNotifications = v),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Appearance
          _SectionTitle('Appearance'),
          Card(
            child: SwitchListTile(
              title: const Text('Dark Mode'),
              subtitle: const Text('Use dark theme'),
              value: _darkMode,
              onChanged: (v) async {
                setState(() => _darkMode = v);
                final prefs = await SharedPreferences.getInstance();
                await prefs.setBool('darkMode', v);
              },
            ),
          ),

          const SizedBox(height: 24),

          // Save button
          SizedBox(
            height: 48,
            child: ElevatedButton.icon(
              onPressed: _save,
              icon: const Icon(Icons.save_outlined),
              label: const Text('Save Settings'),
            ),
          ),

          const SizedBox(height: 16),

          // App info
          Center(
            child: Text(
              'ResIQ v2.0.0 · by Hostizzy',
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ),

          const SizedBox(height: 40),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  const _SectionTitle(this.title);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(title,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
    );
  }
}
