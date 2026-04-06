import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'register_screen.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _branchController = TextEditingController();
  final _enrollmentController = TextEditingController();
  bool _isRegister = false;

  void _submit() async {
    final auth = context.read<AuthProvider>();
    try {
      if (_isRegister) {
        await auth.register(
          name: _nameController.text,
          email: _emailController.text,
          password: _passwordController.text,
          branch: _branchController.text,
          enrollment: _enrollmentController.text,
        );
      } else {
        await auth.login(_emailController.text, _passwordController.text);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.secondary),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    print("STP: LoginScreen rendering...");
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          color: AppTheme.background,
          gradient: RadialGradient(
            center: Alignment.topRight,
            radius: 1.5,
            colors: [
              Color(0xFF0F1930),
              AppTheme.background,
            ],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.account_balance_wallet_rounded, size: 64, color: AppTheme.primary),
                const SizedBox(height: 16),
                Text(
                  _isRegister ? "Join StockPulse" : "Welcome Back",
                  style: textTheme.displayLarge,
                ),
                Text(
                  _isRegister ? "Create your trading account" : "Sign in to continue trading",
                  style: textTheme.bodyMedium,
                ),
                const SizedBox(height: 48),
                GlassCard(
                  child: Column(
                    children: [
                      if (_isRegister) ...[
                        _buildField(_nameController, "Full Name", Icons.person),
                        const SizedBox(height: 16),
                        _buildField(_branchController, "Branch", Icons.school),
                        const SizedBox(height: 16),
                        _buildField(_enrollmentController, "Enrollment Number", Icons.numbers),
                        const SizedBox(height: 16),
                      ],
                      _buildField(_emailController, "Email Address", Icons.email),
                      const SizedBox(height: 16),
                      _buildField(_passwordController, "Password", Icons.lock, obscure: true),
                      const SizedBox(height: 32),
                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton(
                          onPressed: context.watch<AuthProvider>().isLoading ? null : _submit,
                          child: context.watch<AuthProvider>().isLoading
                              ? const CircularProgressIndicator()
                              : Text(_isRegister ? "REGISTER" : "LOGIN"),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                TextButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const RegisterScreen()),
                  ),
                  child: Text(
                    "Don't have an account? Register",
                    style: const TextStyle(color: AppTheme.onSurfaceVariant),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField(TextEditingController controller, String label, IconData icon, {bool obscure = false}) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      style: const TextStyle(color: AppTheme.onSurface),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: AppTheme.onSurfaceVariant),
        prefixIcon: Icon(icon, color: AppTheme.primary, size: 20),
        filled: true,
        fillColor: Colors.black.withValues(alpha: 0.2),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppTheme.primary, width: 1),
        ),
      ),
    );
  }
}
