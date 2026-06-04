import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/auth_provider.dart';
import '../core/theme.dart';
import 'documents_screen.dart';
import 'properties_screen.dart';
import 'settings_screen.dart';

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentUserProfileProvider);
    final userName = profile.valueOrNull?['name'] ?? 'User';
    final userEmail = profile.valueOrNull?['email'] ?? '';

    return Scaffold(
      appBar: AppBar(
        title: const Text('More',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // User card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: ResIQTheme.primary.withOpacity(0.1),
                    child: Text(
                      userName.isNotEmpty ? userName[0].toUpperCase() : '?',
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
                        Text(userName,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 16)),
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
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          _MenuItem(
            icon: Icons.villa_outlined,
            label: 'Properties',
            subtitle: 'Manage your properties',
            onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const PropertiesScreen())),
          ),
          _MenuItem(
            icon: Icons.file_copy_outlined,
            label: 'Guest Documents',
            subtitle: 'Review KYC submissions',
            onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const DocumentsScreen())),
          ),
          _MenuItem(
            icon: Icons.settings_outlined,
            label: 'Settings',
            subtitle: 'Business profile, notifications',
            onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),

          const SizedBox(height: 24),

          _MenuItem(
            icon: Icons.logout,
            label: 'Logout',
            subtitle: 'Sign out of your account',
            color: ResIQTheme.danger,
            onTap: () => ref.read(authServiceProvider).signOut(),
          ),
        ],
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;
  final Color? color;

  const _MenuItem({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.onSurface;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: c),
        title: Text(label,
            style: TextStyle(fontWeight: FontWeight.w600, color: c)),
        subtitle: Text(subtitle,
            style: TextStyle(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            )),
        trailing: const Icon(Icons.chevron_right, size: 20),
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
