import 'dart:math';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user_data.dart';
import 'auth_provider.dart';

class PortfolioProvider extends ChangeNotifier {
  final _supabase = Supabase.instance.client;
  AuthProvider? _auth;
  bool isLoading = false;

  void updateAuth(AuthProvider auth) {
    _auth = auth;
  }

  Future<void> buyStock(String symbol, double amount, double price) async {
    if (_auth?.user == null) return;
    isLoading = true;
    notifyListeners();

    try {
      final user = _auth!.user!;
      final total = double.parse((amount * price).toStringAsFixed(2));
      
      if (user.eTokens < total) throw 'Insufficient E-Tokens';

      double newTokens = double.parse((user.eTokens - total).toStringAsFixed(2));
      List<PortfolioItem> portfolio = List.from(user.portfolio);
      
      // INDIVIDUAL HOLDING FIX: Always add a new item instead of merging
      portfolio.add(PortfolioItem(
        id: "hold_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(100)}",
        symbol: symbol,
        amount: amount,
        avgBuyPrice: price,
        timestamp: DateTime.now().toIso8601String(),
      ));

      await _supabase.from('users').update({
        'etokens': newTokens,
        'e_tokens': newTokens,
        'portfolio': portfolio.map((e) => e.toJson()).toList(),
      }).eq('email', user.email);

      await _supabase.from('trades').insert({
        '_id': DateTime.now().millisecondsSinceEpoch.toString(),
        'email': user.email,
        'action': 'buy',
        'symbol': symbol,
        'amount': amount,
        'price': price,
        'total': total,
        'timestamp': DateTime.now().toIso8601String(),
      });

      await _auth!.refreshUser(user.email);
    } catch (e) {
      rethrow;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> sellStock(String symbol, double amount, double price) async {
    if (_auth?.user == null) return;
    isLoading = true;
    notifyListeners();

    try {
      final user = _auth!.user!;
      final total = double.parse((amount * price).toStringAsFixed(2));

      List<PortfolioItem> portfolio = List.from(user.portfolio);
      
      // FIFO SELLING: Find all holdings of this symbol, sorted by date
      final symbolHoldings = portfolio.where((p) => p.symbol == symbol).toList();
      symbolHoldings.sort((a, b) => a.timestamp.compareTo(b.timestamp));

      double totalOwned = symbolHoldings.fold(0, (sum, item) => sum + item.amount);
      if (totalOwned < amount) throw 'Insufficient units to sell';

      double toSell = amount;
      double newTokens = double.parse((user.eTokens + total).toStringAsFixed(2));

      // Subtract from oldest holdings first
      for (var holding in symbolHoldings) {
        if (toSell <= 0) break;

        final pIndex = portfolio.indexWhere((p) => p.id == holding.id);
        if (holding.amount <= toSell) {
          toSell -= holding.amount;
          portfolio.removeAt(pIndex);
        } else {
          portfolio[pIndex] = PortfolioItem(
            id: holding.id,
            symbol: holding.symbol,
            amount: holding.amount - toSell,
            avgBuyPrice: holding.avgBuyPrice,
            sl: holding.sl,
            tp: holding.tp,
            timestamp: holding.timestamp,
          );
          toSell = 0;
        }
      }

      await _supabase.from('users').update({
        'etokens': newTokens,
        'e_tokens': newTokens,
        'portfolio': portfolio.map((e) => e.toJson()).toList(),
      }).eq('email', user.email);

      await _supabase.from('trades').insert({
        '_id': DateTime.now().millisecondsSinceEpoch.toString(),
        'email': user.email,
        'action': 'sell',
        'symbol': symbol,
        'amount': amount,
        'price': price,
        'total': total,
        'timestamp': DateTime.now().toIso8601String(),
      });

      await _auth!.refreshUser(user.email);
    } catch (e) {
      rethrow;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> tradeOption({
    required String contractSymbol,
    required String underlyingSymbol,
    required String type,
    required double strike,
    required int expiration,
    required int lots,
    required double premium,
    required String action,
  }) async {
    if (_auth?.user == null) return;
    isLoading = true;
    notifyListeners();

    try {
      final user = _auth!.user!;
      final total = double.parse((lots * premium).toStringAsFixed(2));
      final now = DateTime.now().toIso8601String();
      
      double currentTokens = user.eTokens;
      List<OptionPosition> options = List.from(user.options);

      if (action == "buy") {
        if (currentTokens < total) throw 'Insufficient E-Tokens';
        currentTokens = double.parse((currentTokens - total).toStringAsFixed(2));
        options.add(OptionPosition(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          contractSymbol: contractSymbol,
          underlyingSymbol: underlyingSymbol,
          type: type,
          strike: strike,
          expiration: expiration,
          lots: lots,
          premium: premium,
          side: "buy",
          timestamp: now,
        ));
      } else if (action == "sell") {
        final index = options.indexWhere((o) => o.contractSymbol == contractSymbol && o.side == "buy");
        if (index == -1 || options[index].lots < lots) throw 'Insufficient lots to sell';
        
        currentTokens = double.parse((currentTokens + total).toStringAsFixed(2));
        final pos = options[index];
        final remainingLots = pos.lots - lots;
        
        if (remainingLots == 0) {
          options.removeAt(index);
        } else {
          options[index] = OptionPosition(
            id: pos.id,
            contractSymbol: pos.contractSymbol,
            underlyingSymbol: pos.underlyingSymbol,
            type: pos.type,
            strike: pos.strike,
            expiration: pos.expiration,
            lots: remainingLots,
            premium: pos.premium,
            side: "buy",
            timestamp: pos.timestamp,
          );
        }
      }

      await _supabase.from('users').update({
        'etokens': currentTokens,
        'e_tokens': currentTokens,
        'options': options.map((e) => e.toJson()).toList(),
      }).eq('email', user.email);

      await _supabase.from('option_trades').insert({
        '_id': "${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(1000)}",
        'email': user.email,
        'action': action,
        'contractSymbol': contractSymbol,
        'underlyingSymbol': underlyingSymbol,
        'optionType': type,
        'strike': strike,
        'expiration': expiration,
        'lots': lots,
        'premium': premium,
        'total': total,
        'timestamp': now,
      });

      await _auth!.refreshUser(user.email);
    } catch (e) {
      rethrow;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> updateTargets(String holdingId, double? sl, double? tp) async {

    if (_auth?.user == null) return;
    isLoading = true;
    notifyListeners();

    try {
      final user = _auth!.user!;
      List<PortfolioItem> portfolio = List.from(user.portfolio);
      final index = portfolio.indexWhere((p) => p.id == holdingId);
      
      if (index == -1) throw 'Holding not found in portfolio';
      
      final item = portfolio[index];
      portfolio[index] = PortfolioItem(
        id: item.id,
        symbol: item.symbol, 
        amount: item.amount, 
        avgBuyPrice: item.avgBuyPrice,
        sl: sl,
        tp: tp,
        timestamp: item.timestamp,
      );

      await _supabase.from('users').update({
        'portfolio': portfolio.map((e) => e.toJson()).toList(),
      }).eq('email', user.email);

      await _auth!.refreshUser(user.email);
    } catch (e) {
      rethrow;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  // Helper for UI triggers
  Future<void> refresh() async {
    if (_auth?.user?.email != null) {
      await _auth!.refreshUser(_auth!.user!.email);
    }
  }
}
