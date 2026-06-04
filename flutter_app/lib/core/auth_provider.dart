import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;
import 'supabase_client.dart';

final firebaseAuthProvider = Provider<FirebaseAuth>((_) => FirebaseAuth.instance);

final authStateProvider = StreamProvider<User?>((ref) {
  return ref.watch(firebaseAuthProvider).authStateChanges();
});

final currentUserProfileProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return null;

  // Check team_members first
  final teamRes = await supabase
      .from('team_members')
      .select()
      .eq('email', user.email!)
      .limit(1);

  if (teamRes.isNotEmpty) {
    return {...teamRes.first, 'userType': 'staff'};
  }

  // Check property_owners
  final ownerRes = await supabase
      .from('property_owners')
      .select()
      .eq('email', user.email!)
      .limit(1);

  if (ownerRes.isNotEmpty) {
    return {...ownerRes.first, 'userType': 'owner'};
  }

  return null;
});

class AuthService {
  final FirebaseAuth _auth;
  AuthService(this._auth);

  Future<UserCredential> signIn(String email, String password) {
    return _auth.signInWithEmailAndPassword(email: email, password: password);
  }

  Future<void> signOut() => _auth.signOut();

  Future<void> resetPassword(String email) {
    return _auth.sendPasswordResetEmail(email: email);
  }
}

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(ref.watch(firebaseAuthProvider));
});
