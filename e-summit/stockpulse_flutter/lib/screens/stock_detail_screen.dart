import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/market_provider.dart';
import '../providers/portfolio_provider.dart';
import '../providers/auth_provider.dart';
import '../models/user_data.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';
import '../widgets/candle_chart.dart';
import 'options_chain_screen.dart';

class StockDetailScreen extends StatefulWidget {
  const StockDetailScreen({super.key});

  @override
  State<StockDetailScreen> createState() => _StockDetailScreenState();
}

class _StockDetailScreenState extends State<StockDetailScreen> {
  final _amountController = TextEditingController(text: "1");
  final Map<String, TextEditingController> _slControllers = {};
  final Map<String, TextEditingController> _tpControllers = {};
  final Map<String, bool> _showHoldingsTargets = {};

  @override
  void dispose() {
    _amountController.dispose();
    for (var c in _slControllers.values) {
      c.dispose();
    }
    for (var c in _tpControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final market = context.watch<MarketProvider>();
    final portfolio = context.watch<PortfolioProvider>();
    final auth = context.watch<AuthProvider>();
    
    // Find ALL holdings of this stock (Individual Positions)
    final List<PortfolioItem> holdings = (auth.user?.portfolio ?? [])
        .where((p) => p.symbol == market.currentSymbol)
        .toList();

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(market.currentSymbol, style: const TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          TextButton.icon(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OptionsChainScreen())),
            icon: const Icon(Icons.grid_view_rounded, color: AppTheme.primary, size: 20),
            label: const Text("OPTIONS", style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 1)),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: market.isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () => portfolio.refresh(),
              color: AppTheme.primary,
              backgroundColor: AppTheme.background,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildPriceHeader(market),
                    const SizedBox(height: 32),
                    _buildChartSection(market),
                    const SizedBox(height: 32),
                    _buildTradeSection(context, market, portfolio),
                    if (holdings.isNotEmpty) ...[
                      const SizedBox(height: 32),
                      const Text("Active Positions", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 16),
                      ...holdings.map((h) => _buildHoldingTargetCard(context, portfolio, h)),
                    ],
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildPriceHeader(MarketProvider market) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "₹${market.underlyingPrice.toStringAsFixed(2)}",
          style: const TextStyle(fontSize: 40, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: -1),
        ),
        Row(
          children: [
            const Icon(Icons.trending_up, color: AppTheme.primary, size: 16),
            const SizedBox(width: 4),
            const Text("+2.45% Today", style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 14)),
          ],
        ),
      ],
    );
  }

  Widget _buildChartSection(MarketProvider market) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text("Live Performance", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
              child: const Text("1 Month", style: TextStyle(color: AppTheme.primary, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        const SizedBox(height: 16),
        GlassCard(child: CandleChart(data: market.chartData, height: 350)),
      ],
    );
  }

  Widget _buildTradeSection(BuildContext context, MarketProvider market, PortfolioProvider portfolio) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text("Quick Trade", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        _buildTextField(_amountController, "Units to Buy/Sell", Icons.inventory_2_outlined),
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary, foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(vertical: 16)),
                onPressed: () => _executeTrade(context, portfolio, market.currentSymbol, true),
                child: const Text("BUY STOCK", style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.secondary, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16)),
                onPressed: () => _executeTrade(context, portfolio, market.currentSymbol, false),
                child: const Text("SELL STOCK", style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildHoldingTargetCard(BuildContext context, PortfolioProvider portfolio, PortfolioItem holding) {
    // Initialize state if first time
    if (!_slControllers.containsKey(holding.id)) {
      _slControllers[holding.id] = TextEditingController(text: holding.sl?.toString() ?? "");
      _tpControllers[holding.id] = TextEditingController(text: holding.tp?.toString() ?? "");
      _showHoldingsTargets[holding.id] = holding.sl != null || holding.tp != null;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: GlassCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("${holding.amount.toInt()} Units @ ₹${holding.avgBuyPrice.toStringAsFixed(2)}", 
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                    Text("Bought ${DateTime.parse(holding.timestamp).day}/${DateTime.parse(holding.timestamp).month}", 
                      style: const TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 10)),
                  ],
                ),
                Switch(
                  value: _showHoldingsTargets[holding.id] ?? false,
                  onChanged: (val) => setState(() => _showHoldingsTargets[holding.id] = val),
                  activeColor: AppTheme.primary,
                ),
              ],
            ),
            if (_showHoldingsTargets[holding.id] == true) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _buildTextField(_tpControllers[holding.id]!, "Take Profit", Icons.trending_up, fontSize: 12)),
                  const SizedBox(width: 12),
                  Expanded(child: _buildTextField(_slControllers[holding.id]!, "Stop Loss", Icons.trending_down, fontSize: 12)),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(foregroundColor: AppTheme.primary, side: const BorderSide(color: AppTheme.primary)),
                  onPressed: portfolio.isLoading ? null : () async {
                    final sl = double.tryParse(_slControllers[holding.id]!.text);
                    final tp = double.tryParse(_tpControllers[holding.id]!.text);
                    try {
                      await portfolio.updateTargets(holding.id, sl, tp);
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Targets Updated for Holding!")));
                    } catch (e) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.secondary));
                    }
                  },
                  child: portfolio.isLoading ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text("SET TARGETS"),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTextField(TextEditingController controller, String label, IconData icon, {double fontSize = 14}) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      style: TextStyle(color: Colors.white, fontSize: fontSize),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: AppTheme.onSurfaceVariant, fontSize: fontSize * 0.8),
        prefixIcon: Icon(icon, color: AppTheme.primary, size: fontSize + 4),
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.05),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
    );
  }

  void _executeTrade(BuildContext context, PortfolioProvider portfolio, String symbol, bool isBuy) async {
    final amount = double.tryParse(_amountController.text) ?? 0;
    if (amount <= 0) return;

    try {
      if (isBuy) {
        await portfolio.buyStock(symbol, amount, context.read<MarketProvider>().underlyingPrice);
      } else {
        await portfolio.sellStock(symbol, amount, context.read<MarketProvider>().underlyingPrice);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("${isBuy ? 'Bought' : 'Sold'} $amount units of $symbol"), backgroundColor: AppTheme.primary),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppTheme.secondary));
    }
  }
}
