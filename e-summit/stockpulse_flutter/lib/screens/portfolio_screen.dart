import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/market_provider.dart';
import '../providers/portfolio_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';
import 'stock_detail_screen.dart';

class PortfolioScreen extends StatefulWidget {
  const PortfolioScreen({super.key});

  @override
  State<PortfolioScreen> createState() => _PortfolioScreenState();
}

class _PortfolioScreenState extends State<PortfolioScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final market = context.watch<MarketProvider>();
    final portfolio = context.watch<PortfolioProvider>();
    final user = auth.user;

    if (user == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    // Total Portfolio Valuations
    double totalInvested = 0;
    double totalCurrentValue = 0;
    for (var item in user.portfolio) {
      totalInvested += item.amount * item.avgBuyPrice;
      totalCurrentValue += item.amount * (market.currentSymbol == item.symbol ? market.underlyingPrice : item.avgBuyPrice);
    }
    double totalPnL = totalCurrentValue - totalInvested;
    bool isPnLPositive = totalPnL >= 0;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text("My Portfolio", style: TextStyle(fontWeight: FontWeight.bold)),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.primary,
          labelColor: AppTheme.primary,
          unselectedLabelColor: AppTheme.onSurfaceVariant,
          tabs: const [
            Tab(text: "EQUITY"),
            Tab(text: "OPTIONS"),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => portfolio.refresh(),
        color: AppTheme.primary,
        backgroundColor: AppTheme.background,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(24),
              child: _buildSummaryCard(totalCurrentValue, totalInvested, totalPnL, isPnLPositive),
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildEquityList(context, market, user.portfolio),
                  _buildOptionsList(context, user.options),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCard(double current, double invested, double pnl, bool isPos) {
    return GlassCard(
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   const Text("Current Value", style: TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 12)),
                   Text("₹${current.toStringAsFixed(2)}", style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                   const Text("Total P&L", style: TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 12)),
                   Text(
                     "${isPos ? '+' : ''}₹${pnl.toStringAsFixed(2)}", 
                     style: TextStyle(color: pnl == 0 ? Colors.white : (isPos ? AppTheme.primary : AppTheme.secondary), fontSize: 18, fontWeight: FontWeight.bold)
                   ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: Colors.white10),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _summaryItem("Invested", "₹${invested.toStringAsFixed(0)}"),
              _summaryItem("Individual Holdings", "${Provider.of<AuthProvider>(context).user?.portfolio.length}"), 
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 10)),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildEquityList(BuildContext context, MarketProvider market, List<dynamic> portfolio) {
    if (portfolio.isEmpty) return const Center(child: Text("No equity holdings", style: TextStyle(color: AppTheme.onSurfaceVariant)));

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 24),
      itemCount: portfolio.length,
      itemBuilder: (context, index) {
        final item = portfolio[index];
        final currentPrice = (market.currentSymbol == item.symbol ? market.underlyingPrice : item.avgBuyPrice);
        final pnl = (currentPrice - item.avgBuyPrice) * item.amount;
        final isPos = pnl >= 0;

        return GestureDetector(
          onTap: () {
            market.fetchMarketData(item.symbol);
            Navigator.push(context, MaterialPageRoute(builder: (_) => const StockDetailScreen()));
          },
          child: Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.surfaceContainer.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(16),
              border: (item.sl != null || item.tp != null) 
                  ? Border.all(color: AppTheme.primary.withValues(alpha: 0.2), width: 1)
                  : null,
            ),
            child: Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(item.symbol, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        const SizedBox(width: 8),
                        if (item.sl != null || item.tp != null)
                          const Icon(Icons.track_changes_rounded, color: AppTheme.primary, size: 12),
                      ],
                    ),
                    Text("${item.amount.toInt()} Qty @ ₹${item.avgBuyPrice.toStringAsFixed(0)}", style: const TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 12)),
                  ],
                ),
                const Spacer(),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text("₹${(item.amount * currentPrice).toStringAsFixed(2)}", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    Text("${isPos ? '+' : ''}₹${pnl.toStringAsFixed(2)}", style: TextStyle(color: isPos ? AppTheme.primary : AppTheme.secondary, fontSize: 12, fontWeight: FontWeight.bold)),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildOptionsList(BuildContext context, List<dynamic> options) {
    if (options.isEmpty) return const Center(child: Text("No open option positions", style: TextStyle(color: AppTheme.onSurfaceVariant)));

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 24),
      itemCount: options.length,
      itemBuilder: (context, index) {
        final pos = options[index];
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.surfaceContainer.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: pos.type == "call" ? AppTheme.primary.withValues(alpha: 0.2) : AppTheme.secondary.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(pos.type.toUpperCase(), style: TextStyle(color: pos.type == "call" ? AppTheme.primary : AppTheme.secondary, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                  Text("${pos.lots} Lots", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("${pos.underlyingSymbol} ₹${pos.strike.toStringAsFixed(0)}", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                      Text("Premium: ₹${pos.premium.toStringAsFixed(2)}", style: const TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 12)),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text("Invested", style: TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 10)),
                      Text("₹${(pos.lots * 75 * pos.premium).toStringAsFixed(0)}", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
