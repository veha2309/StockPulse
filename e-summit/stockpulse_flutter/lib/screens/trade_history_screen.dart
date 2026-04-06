import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class TradeHistoryScreen extends StatefulWidget {
  const TradeHistoryScreen({super.key});

  @override
  State<TradeHistoryScreen> createState() => _TradeHistoryScreenState();
}

class _TradeHistoryScreenState extends State<TradeHistoryScreen> {
  final _supabase = Supabase.instance.client;
  List<dynamic> _trades = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchTrades();
  }

  Future<void> _fetchTrades() async {
    final auth = context.read<AuthProvider>();
    if (auth.user == null) return;

    setState(() => _isLoading = true);
    try {
      final res = await _supabase
          .from('trades')
          .select()
          .eq('email', auth.user!.email)
          .order('timestamp', ascending: false);
      
      setState(() {
        _trades = res;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text("Trade History", style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: RefreshIndicator(
        onRefresh: _fetchTrades,
        color: AppTheme.primary,
        backgroundColor: AppTheme.background,
        child: _isLoading 
          ? const Center(child: CircularProgressIndicator())
          : _trades.isEmpty 
            ? ListView(
                children: const [
                  SizedBox(height: 100),
                  Center(child: Text("No trades yet", style: TextStyle(color: AppTheme.onSurfaceVariant))),
                ],
              )
            : ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                itemCount: _trades.length,
                itemBuilder: (context, index) {
                  final trade = _trades[index];
                  final isBuy = trade['action'] == 'buy';
                  final date = DateTime.parse(trade['timestamp']).toLocal();

                  return Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceContainer.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: isBuy ? AppTheme.primary.withValues(alpha: 0.1) : AppTheme.secondary.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            isBuy ? Icons.add_rounded : Icons.remove_rounded, 
                            color: isBuy ? AppTheme.primary : AppTheme.secondary,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(trade['symbol'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              Text("${date.day}/${date.month} ${date.hour}:${date.minute}", style: const TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 10)),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              "${isBuy ? '+' : '-'}${trade['amount']} Units", 
                              style: TextStyle(color: isBuy ? AppTheme.primary : AppTheme.secondary, fontWeight: FontWeight.bold, fontSize: 14)
                            ),
                            Text("₹${trade['price'].toStringAsFixed(2)}", style: const TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 12)),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }
}
