import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class CandleData {
  final DateTime date;
  final double open;
  final double high;
  final double low;
  final double close;

  CandleData({
    required this.date,
    required this.open,
    required this.high,
    required this.low,
    required this.close,
  });
}

class OptionContract {
  final String contractSymbol;
  final double strike;
  final int expiration;
  final double lastPrice;
  final double bid;
  final double ask;
  final double change;
  final bool inTheMoney;

  OptionContract({
    required this.contractSymbol,
    required this.strike,
    required this.expiration,
    required this.lastPrice,
    required this.bid,
    required this.ask,
    required this.change,
    required this.inTheMoney,
  });
}

class MarketProvider extends ChangeNotifier {
  final _supabase = Supabase.instance.client;
  double underlyingPrice = 0;
  List<OptionContract> calls = [];
  List<OptionContract> puts = [];
  List<CandleData> chartData = [];
  bool isLoading = false;
  String currentSymbol = "NSE:NIFTY50";
  List<String> watchlist = ["NSE:RELIANCE", "NSE:TCS", "NSE:HDFCBANK", "NSE:INFY"];

  MarketProvider() {
    _init();
  }

  Future<void> _init() async {
    print("STP: MarketProvider initializing watchlist...");
    try {
      final res = await _supabase
          .from('app_config')
          .select('value')
          .eq('key', 'global_favorites')
          .maybeSingle();

      if (res != null && res['value'] != null) {
        final dynamic value = res['value'];
        print("STP: Global favorites raw value: $value");
        
        List<String> fetchedWatchlist = [];
        if (value is List) {
          fetchedWatchlist = value.map((e) => e.toString()).toList();
        } else if (value is String) {
          final decoded = jsonDecode(value);
          if (decoded is List) {
            fetchedWatchlist = decoded.map((e) => e.toString()).toList();
          }
        }
        
        if (fetchedWatchlist.isNotEmpty) {
           watchlist = fetchedWatchlist;
           print("STP: Watchlist updated with ${watchlist.length} items.");
        }
        notifyListeners();
      }
    } catch (e) {
      print("STP ERROR: Failed to load global favorites: $e");
    } finally {
      print("STP: Final watchlist: $watchlist");
    }
  }

  Future<void> fetchMarketData(String symbol) async {
    currentSymbol = symbol;
    isLoading = true;
    notifyListeners();

    try {
      final yfSymbol = _toYahooSymbol(symbol);
      // Fetch 1 month of daily data for candlesticks
      final url = Uri.parse('https://query1.finance.yahoo.com/v8/finance/chart/$yfSymbol?interval=1d&range=1mo');
      final response = await http.get(url, headers: {"User-Agent": "Mozilla/5.0"});

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final result = data['chart']['result'];
        if (result != null && result.isNotEmpty) {
          final quote = result[0]['indicators']['quote'][0];
          final timestamps = result[0]['timestamp'] as List<dynamic>;
          
          underlyingPrice = (result[0]['meta']['regularMarketPrice'] ?? 0).toDouble();
          
          chartData.clear();
          for (int i = 0; i < timestamps.length; i++) {
            if (quote['open'][i] != null && quote['high'][i] != null && quote['low'][i] != null && quote['close'][i] != null) {
              chartData.add(CandleData(
                date: DateTime.fromMillisecondsSinceEpoch(timestamps[i] * 1000),
                open: (quote['open'][i]).toDouble(),
                high: (quote['high'][i]).toDouble(),
                low: (quote['low'][i]).toDouble(),
                close: (quote['close'][i]).toDouble(),
              ));
            }
          }

          if (underlyingPrice > 0) {
            _generateOptionsChain(symbol);
          }
        }
      }
    } catch (e) {
      debugPrint("Error fetching market data: $e");
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  String _toYahooSymbol(String symbol) {
    if (symbol.startsWith("NSE:")) return "${symbol.substring(4)}.NS";
    if (symbol.startsWith("BSE:")) return "${symbol.substring(4)}.BO";
    return symbol;
  }

  void _generateOptionsChain(String symbol) {
    final nseSymbol = symbol.replaceAll("NSE:", "").replaceAll("BSE:", "");
    final step = underlyingPrice > 3000 ? 50 : underlyingPrice > 1000 ? 20 : underlyingPrice < 200 ? 5 : 10;
    final baseStrike = (underlyingPrice / step).round() * step;

    final today = DateTime.now();
    final nextThursday = today.add(Duration(days: (DateTime.thursday - today.weekday + 7) % 7));
    final expiryStr = DateFormat('dd-MMM-yyyy').format(nextThursday).toUpperCase();
    final expTs = nextThursday.millisecondsSinceEpoch ~/ 1000;

    calls.clear();
    puts.clear();

    for (int i = -12; i <= 12; i++) {
      final strike = (baseStrike + i * step).toDouble();
      if (strike <= 0) continue;

      final callLTP = _calculateTheoreticalPrice(strike, true);
      final putLTP = _calculateTheoreticalPrice(strike, false);

      calls.add(OptionContract(
        contractSymbol: "$nseSymbol-$expiryStr-$strike-CE",
        strike: strike,
        expiration: expTs,
        lastPrice: callLTP,
        bid: (callLTP * 0.98),
        ask: (callLTP * 1.02),
        change: 0,
        inTheMoney: underlyingPrice > strike,
      ));

      puts.add(OptionContract(
        contractSymbol: "$nseSymbol-$expiryStr-$strike-PE",
        strike: strike,
        expiration: expTs,
        lastPrice: putLTP,
        bid: (putLTP * 0.98),
        ask: (putLTP * 1.02),
        change: 0,
        inTheMoney: strike > underlyingPrice,
      ));
    }
  }

  double _calculateTheoreticalPrice(double strike, bool isCall) {
    final intrinsic = isCall ? max(0.0, underlyingPrice - strike) : max(0.0, strike - underlyingPrice);
    final distance = (underlyingPrice - strike).abs() / underlyingPrice;
    final timeValue = underlyingPrice * 0.02 * exp(-distance * 20);
    final randomFactor = 0.8 + (Random(strike.toInt()).nextDouble() * 0.4);
    return double.parse((intrinsic + timeValue * randomFactor).toStringAsFixed(2));
  }
}
