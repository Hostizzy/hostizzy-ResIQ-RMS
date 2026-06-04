import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/auth_provider.dart';
import '../core/theme.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  bool _obscurePassword = true;
  String? _error;

  Future<void> _login() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Please enter email and password');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await ref.read(authServiceProvider).signIn(email, password);
    } catch (e) {
      setState(() => _error = _parseAuthError(e.toString()));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _parseAuthError(String error) {
    if (error.contains('user-not-found')) return 'No account found with this email';
    if (error.contains('wrong-password')) return 'Incorrect password';
    if (error.contains('invalid-email')) return 'Invalid email address';
    if (error.contains('too-many-requests')) return 'Too many attempts. Try again later.';
    if (error.contains('invalid-credential')) return 'Invalid email or password';
    return 'Login failed. Please try again.';
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo area
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [ResIQTheme.primary, ResIQTheme.primaryDark],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Center(
                    child: Text('R',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 36,
                          fontWeight: FontWeight.w800,
                        )),
                  ),
                ),
                const SizedBox(height: 20),
                Text('ResIQ',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.5,
                        )),
                const SizedBox(height: 6),
                Text('Property Management System',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        )),
                const SizedBox(height: 40),

                // Email
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.mail_outline, size: 20),
                  ),
                ),
                const SizedBox(height: 16),

                // Password
                TextField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _login(),
                  decoration: InputDecoration(
                    labelText: 'Password',
                    prefixIcon: const Icon(Icons.lock_outline, size: 20),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        size: 20,
                      ),
                      onPressed: () =>
                          setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                ),
                const SizedBox(height: 8),

                // Error
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(_error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                          fontSize: 13,
                        )),
                  ),

                const SizedBox(height: 12),

                // Login button
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _login,
                    child: _loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Login'),
                  ),
                ),
                const SizedBox(height: 16),

                TextButton(
                  onPressed: () {
                    final email = _emailController.text.trim();
                    if (email.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Enter your email first')),
                      );
                      return;
                    }
                    ref.read(authServiceProvider).resetPassword(email);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text('Password reset link sent to your email')),
                    );
                  },
                  child: const Text('Forgot password?'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
