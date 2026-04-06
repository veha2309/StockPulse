import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/market_provider.dart';


import '../providers/portfolio_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/glass_card.dart';
import 'stock_detail_screen.dart';
import 'profile_screen.dart';
import 'trade_history_screen.dart';
import 'portfolio_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 0;



  @override
  Widget build(BuildContext context) {
    final List<Widget> screens = [
      DashboardHome(onNavigate: (index) => setState(() => _selectedIndex = index)),
      const PortfolioScreen(),
      const TradeHistoryScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: IndexedStack(
        index: _selectedIndex,
        children: screens,
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppTheme.background,
        border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.05))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _navItem(0, Icons.grid_view_rounded, "Home"),
          _navItem(1, Icons.pie_chart_rounded, "Portfolio"),
          _navItem(2, Icons.history_rounded, "History"),
          _navItem(3, Icons.person_rounded, "Profile"),
        ],
      ),
    );
  }

  Widget _navItem(int index, IconData icon, String label) {
    final bool isActive = _selectedIndex == index;
    return InkWell(
      onTap: () => setState(() => _selectedIndex = index),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: isActive ? AppTheme.primary : AppTheme.onSurfaceVariant, size: 24),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(color: isActive ? AppTheme.primary : AppTheme.onSurfaceVariant, fontSize: 10, fontWeight: isActive ? FontWeight.bold : FontWeight.normal)),
        ],
      ),
    );
  }
}

class DashboardHome extends StatelessWidget {
  final Function(int)? onNavigate;
  const DashboardHome({super.key, this.onNavigate});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final market = context.watch<MarketProvider>();
    final portfolio = context.watch<PortfolioProvider>();
    final user = auth.user;

    if (user == null) return const Center(child: CircularProgressIndicator());

    double totalCurrentValue = 0;
    double totalInvested = 0;
    for (var item in user.portfolio) {
      totalInvested += item.amount * item.avgBuyPrice;
      totalCurrentValue += item.amount * (market.currentSymbol == item.symbol ? market.underlyingPrice : item.avgBuyPrice);
    }
    double totalPnL = totalCurrentValue - totalInvested;

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async {
          await portfolio.refresh();
          if (market.currentSymbol.isNotEmpty) {
            await market.fetchMarketData(market.currentSymbol);
          }
        },
        color: AppTheme.primary,
        backgroundColor: AppTheme.background,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(context, user),
              const SizedBox(height: 32),
              _buildBalanceCard(context, user, totalCurrentValue, totalPnL),
              const SizedBox(height: 32),
              _buildSearchSection(context, market),
              const SizedBox(height: 32),
              _buildWatchlist(context, market),
              const SizedBox(height: 32),
              _buildPortfolioPreview(context, market, user),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, dynamic user) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Welcome back,", style: Theme.of(context).textTheme.bodyMedium),
            Text(user.name, style: Theme.of(context).textTheme.headlineMedium),
          ],
        ),
        const CircleAvatar(
          radius: 24,
          backgroundColor: AppTheme.surfaceContainer,
          child: Icon(Icons.person, color: AppTheme.primary),
        ),
      ],
    );
  }

  Widget _buildBalanceCard(BuildContext context, dynamic user, double currentVal, double pnl) {
    final bool isPositive = pnl >= 0;
    return GestureDetector(
      onTap: () => onNavigate?.call(1),
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("Wallet Balance", style: TextStyle(color: AppTheme.onSurfaceVariant.withValues(alpha: 0.7), fontSize: 13)),
                const Icon(Icons.arrow_forward_ios_rounded, color: AppTheme.onSurfaceVariant, size: 12),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              "₹${user.eTokens.toStringAsFixed(2)}",
              style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold, letterSpacing: -1),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                _buildStat("Holdings", "₹${currentVal.toStringAsFixed(0)}", Icons.account_balance_wallet_rounded),
                const Spacer(),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                     const Text("Overall P&L", style: TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 10)),
                     Text(
                       "${isPositive ? '+' : ''}₹${pnl.toStringAsFixed(2)}", 
                       style: TextStyle(color: pnl == 0 ? Colors.white : (isPositive ? AppTheme.primary : AppTheme.secondary), fontSize: 14, fontWeight: FontWeight.bold)
                     ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStat(String label, String value, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: AppTheme.primary, size: 16),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 10)),
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
          ],
        ),
      ],
    );
  }

  Widget _buildSearchSection(BuildContext context, MarketProvider market) {
    final searchController = TextEditingController();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text("Market Explorer", style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 16),
        Container(
          decoration: BoxDecoration(
            color: AppTheme.surfaceContainer.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(16),
          ),
          child: TextField(
            controller: searchController,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: "NSE:SYMBOL (e.g. NSE:TCS)",
              hintStyle: const TextStyle(color: AppTheme.onSurfaceVariant),
              prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.primary),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              suffixIcon: IconButton(
                icon: const Icon(Icons.arrow_forward_rounded, color: AppTheme.primary),
                onPressed: () {
                  if (searchController.text.isNotEmpty) {
                    market.fetchMarketData(searchController.text.toUpperCase());
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const StockDetailScreen()));
                  }
                },
              ),
            ),
            onSubmitted: (val) {
              if (val.isNotEmpty) {
                market.fetchMarketData(val.toUpperCase());
                Navigator.push(context, MaterialPageRoute(builder: (_) => const StockDetailScreen()));
              }
            },
          ),
        ),
      ],
    );
  }

  Widget _buildWatchlist(BuildContext context, MarketProvider market) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text("Top Stocks", style: Theme.of(context).textTheme.titleLarge),
            const Text("Favorites", style: TextStyle(color: AppTheme.primary, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 100,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: market.watchlist.length,
            itemBuilder: (context, index) {
              final symbol = market.watchlist[index];
              return GestureDetector(
                onTap: () {
                  market.fetchMarketData(symbol);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const StockDetailScreen()));
                },
                child: Container(
                  width: 140,
                  margin: const EdgeInsets.only(right: 16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceContainer.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(symbol.split(':').last, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                      const Text("Equity", style: TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 10)),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildPortfolioPreview(BuildContext context, MarketProvider market, dynamic user) {
    if (user.portfolio.isEmpty) return const SizedBox();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
             Text("Recent Holdings", style: Theme.of(context).textTheme.titleLarge),
             IconButton(
               icon: const Icon(Icons.arrow_forward_rounded, color: AppTheme.primary, size: 20),
               onPressed: () => onNavigate?.call(1),
             ),
          ],
        ),
        const SizedBox(height: 12),
        ...user.portfolio.take(3).map((item) {
          final currentPrice = (market.currentSymbol == item.symbol ? market.underlyingPrice : item.avgBuyPrice);
          final pnl = (currentPrice - item.avgBuyPrice) * item.amount;
          final isPos = pnl >= 0;

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.surfaceContainer.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.symbol, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    Text("${item.amount.toInt()} shares @ ₹${item.avgBuyPrice.toStringAsFixed(0)}", style: const TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 10)),
                  ],
                ),
                const Spacer(),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text("₹${(item.amount * currentPrice).toStringAsFixed(2)}", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    Text(
                      "${isPos ? '+' : ''}₹${pnl.toStringAsFixed(2)}", 
                      style: TextStyle(color: pnl == 0 ? Colors.white : (isPos ? AppTheme.primary : AppTheme.secondary), fontSize: 10, fontWeight: FontWeight.bold)
                    ),
                  ],
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}
