import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _branchController = TextEditingController();
  final _enrollmentController = TextEditingController();

  void _submit() async {
    final auth = context.read<AuthProvider>();
    try {
      await auth.register(
        name: _nameController.text,
        email: _emailController.text,
        password: _passwordController.text,
        branch: _branchController.text,
        enrollment: _enrollmentController.text,
      );
      if (!mounted) return;
      Navigator.pop(context); 
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.secondary),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppTheme.onSurface),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Container(
        decoration: const BoxDecoration(color: AppTheme.background),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Icon(Icons.person_add_rounded, size: 64, color: AppTheme.primary),
                const SizedBox(height: 16),
                Text("Join StockPulse", style: Theme.of(context).textTheme.displayLarge),
                Text("Create your trading account", style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 48),
                GlassCard(
                  child: Column(
                    children: [
                      _buildField(_nameController, "Full Name", Icons.person),
                      const SizedBox(height: 16),
                      _buildField(_branchController, "Branch", Icons.school),
                      const SizedBox(height: 16),
                      _buildField(_enrollmentController, "Enrollment Number", Icons.numbers),
                      const SizedBox(height: 16),
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
                              ? const CircularProgressIndicator(color: Colors.white)
                              : const Text("REGISTER"),
                        ),
                      ),
                    ],
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
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppTheme.onSurfaceVariant.withValues(alpha: 0.1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppTheme.primary, width: 1),
        ),
      ),
    );
  }
}
