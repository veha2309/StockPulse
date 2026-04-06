import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _nameController = TextEditingController();
  final _branchController = TextEditingController();
  final _enrollmentController = TextEditingController();
  bool _isEditing = false;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    if (user != null) {
      _nameController.text = user.name;
      _branchController.text = user.branch;
      _enrollmentController.text = user.enrollment;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _branchController.dispose();
    _enrollmentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    if (user == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text("My Profile", style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: Icon(_isEditing ? Icons.close : Icons.edit_rounded, color: AppTheme.primary),
            onPressed: () => setState(() => _isEditing = !_isEditing),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            _buildProfileCard(user),
            const SizedBox(height: 32),
            _buildStatsGrid(user),
            if (_isEditing) ...[
              const SizedBox(height: 32),
              _buildEditForm(auth),
            ],
            const SizedBox(height: 48),
            _buildLogoutButton(context, auth),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileCard(dynamic user) {
    return GlassCard(
      child: Column(
        children: [
          const CircleAvatar(
            radius: 40,
            backgroundColor: AppTheme.surfaceContainer,
            child: Icon(Icons.person, size: 48, color: AppTheme.primary),
          ),
          const SizedBox(height: 16),
          Text(user.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
          Text(user.email, style: const TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 14)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildBadge(user.branch),
              const SizedBox(width: 8),
              _buildBadge(user.enrollment),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBadge(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20), border: Border.all(color: AppTheme.primary.withValues(alpha: 0.2))),
      child: Text(text, style: const TextStyle(color: AppTheme.primary, fontSize: 12, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildStatsGrid(dynamic user) {
    return Row(
      children: [
        _buildStatCard("E-Tokens", "₹${user.eTokens.toStringAsFixed(0)}", Icons.account_balance_wallet_rounded),
        const SizedBox(width: 16),
        _buildStatCard("Holdings", "${user.portfolio.length}", Icons.pie_chart_rounded),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: AppTheme.surfaceContainer.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(20)),
        child: Column(
          children: [
            Icon(icon, color: AppTheme.primary, size: 24),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
            Text(label, style: const TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _buildEditForm(AuthProvider auth) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text("Edit Information", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 24),
          _buildTextField(_nameController, "Full Name", Icons.person_outline),
          const SizedBox(height: 16),
          _buildTextField(_branchController, "Branch", Icons.school_outlined),
          const SizedBox(height: 16),
          _buildTextField(_enrollmentController, "Enrollment Number", Icons.numbers_outlined),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary, foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(vertical: 16)),
              onPressed: auth.isLoading ? null : () async {
                try {
                  await auth.updateProfile(
                    name: _nameController.text,
                    branch: _branchController.text,
                    enrollment: _enrollmentController.text,
                  );
                  setState(() => _isEditing = false);
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Profile Updated!")));
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.secondary));
                }
              },
              child: auth.isLoading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black)) : const Text("SAVE CHANGES", style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField(TextEditingController controller, String label, IconData icon) {
    return TextField(
      controller: controller,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: AppTheme.onSurfaceVariant),
        prefixIcon: Icon(icon, color: AppTheme.primary, size: 20),
        filled: true,
        fillColor: AppTheme.surfaceContainer.withValues(alpha: 0.2),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      ),
    );
  }

  Widget _buildLogoutButton(BuildContext context, AuthProvider auth) {
    return SizedBox(
      width: double.infinity,
      child: TextButton.icon(
        style: TextButton.styleFrom(foregroundColor: AppTheme.secondary, padding: const EdgeInsets.symmetric(vertical: 16)),
        onPressed: () {
          auth.logout();
          Navigator.pop(context);
        },
        icon: const Icon(Icons.logout_rounded),
        label: const Text("LOG OUT", style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1)),
      ),
    );
  }
}
