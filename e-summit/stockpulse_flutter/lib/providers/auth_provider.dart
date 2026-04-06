import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:bcrypt/bcrypt.dart';
import 'package:hive/hive.dart';
import '../models/user_data.dart';

class AuthProvider extends ChangeNotifier {
  final _supabase = Supabase.instance.client;
  UserData? _user;
  bool _isInitializing = true;
  bool _isLoading = false;

  UserData? get user => _user;
  bool get isInitializing => _isInitializing;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;

  AuthProvider() {
    print("STP: AuthProvider constructor called.");
    _init();
  }

  Future<void> _init() async {
    print("STP: AuthProvider._init() started...");
    try {
      final box = Hive.box('settings');
      final cachedEmail = box.get('session_email');
      print("STP: Cached email from Hive: $cachedEmail");
      
      if (cachedEmail != null && cachedEmail.toString().isNotEmpty) {
        await refreshUser(cachedEmail.toString());
        print("STP: Session restored for ${_user?.email}");
      }
    } catch (e) {
      print("STP ERROR: AuthProvider initialization failed: $e");
    } finally {
      _isInitializing = false;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _supabase
          .from('users')
          .select('email, name, password, branch, enrollment, etokens, e_tokens, portfolio, options')
          .eq('email', email.trim())
          .maybeSingle();

      if (res == null) {
        throw 'User not found';
      }

      final hashedPassword = res['password'] as String;
      if (BCrypt.checkpw(password, hashedPassword)) {
        _user = UserData.fromJson(res);
        final box = Hive.box('settings');
        await box.put('session_email', email.trim());
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        throw 'Invalid password';
      }
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<bool> register({
    required String name,
    required String email,
    required String password,
    required String branch,
    required String enrollment,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final emailTrimmed = email.trim();
      final existing = await _supabase
          .from('users')
          .select('email')
          .eq('email', emailTrimmed)
          .maybeSingle();

      if (existing != null) {
        throw 'Email already registered';
      }

      final hashedPassword = BCrypt.hashpw(password, BCrypt.gensalt());
      
      final newUser = {
        'name': name,
        'email': emailTrimmed,
        'password': hashedPassword,
        'branch': branch,
        'enrollment': enrollment,
        'etokens': 10000.0,
        'e_tokens': 10000.0,
        'portfolio': [],
        'options': [],
      };

      final res = await _supabase
          .from('users')
          .insert(newUser)
          .select('email, name, branch, enrollment, etokens, e_tokens, portfolio, options')
          .single();

      _user = UserData.fromJson(res);
      final box = Hive.box('settings');
      await box.put('session_email', emailTrimmed);
      
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> refreshUser(String email) async {
    try {
      final res = await _supabase
          .from('users')
          .select('email, name, branch, enrollment, etokens, e_tokens, portfolio, options')
          .eq('email', email.trim())
          .single();
      _user = UserData.fromJson(res);
      notifyListeners();
    } catch (e) {
      print("STP ERROR: refreshUser failed for $email: $e");
      logout();
    }
  }

  Future<void> updateProfile({String? name, String? branch, String? enrollment}) async {
    if (_user == null) return;
    _isLoading = true;
    notifyListeners();

    try {
      final updates = <String, dynamic>{};
      if (name != null) updates['name'] = name;
      if (branch != null) updates['branch'] = branch;
      if (enrollment != null) updates['enrollment'] = enrollment;

      await _supabase.from('users').update(updates).eq('email', _user!.email);
      await refreshUser(_user!.email);
    } catch (e) {
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _user = null;
    final box = Hive.box('settings');
    await box.delete('session_email');
    notifyListeners();
  }
}
