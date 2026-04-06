class UserData {
  final String name;
  final String email;
  final String branch;
  final String enrollment;
  final double eTokens;
  final List<PortfolioItem> portfolio;
  final List<OptionPosition> options;

  UserData({
    required this.name,
    required this.email,
    required this.branch,
    required this.enrollment,
    required this.eTokens,
    required this.portfolio,
    required this.options,
  });

  factory UserData.fromJson(Map<String, dynamic> json) {
    return UserData(
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      branch: json['branch'] ?? '',
      enrollment: json['enrollment'] ?? '',
      eTokens: (json['e_tokens'] ?? json['etokens'] ?? json['eTokens'] ?? 0).toDouble(),
      portfolio: (json['portfolio'] as List<dynamic>?)
              ?.map((e) => PortfolioItem.fromJson(e))
              .toList() ??
          [],
      options: (json['options'] as List<dynamic>?)
              ?.map((e) => OptionPosition.fromJson(e))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'email': email,
      'branch': branch,
      'enrollment': enrollment,
      'etokens': eTokens,
      'e_tokens': eTokens,
      'portfolio': portfolio.map((e) => e.toJson()).toList(),
      'options': options.map((e) => e.toJson()).toList(),
    };
  }
}

class PortfolioItem {
  final String id; // Required unique id for per-holding targets
  final String symbol;
  final double amount;
  final double avgBuyPrice;
  final double? sl;
  final double? tp;
  final String timestamp; // Track when the holding was created for FIFO

  PortfolioItem({
    required this.id,
    required this.symbol,
    required this.amount,
    required this.avgBuyPrice,
    this.sl,
    this.tp,
    required this.timestamp,
  });

  factory PortfolioItem.fromJson(Map<String, dynamic> json) {
    return PortfolioItem(
      id: json['id']?.toString() ?? DateTime.now().millisecondsSinceEpoch.toString(),
      symbol: json['symbol'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      avgBuyPrice: (json['avgBuyPrice'] ?? 0).toDouble(),
      sl: json['sl'] != null ? (json['sl'] as num).toDouble() : null,
      tp: json['tp'] != null ? (json['tp'] as num).toDouble() : null,
      timestamp: json['timestamp'] ?? DateTime.now().toIso8601String(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'symbol': symbol,
      'amount': amount,
      'avgBuyPrice': avgBuyPrice,
      'sl': sl,
      'tp': tp,
      'timestamp': timestamp,
    };
  }
}

class OptionPosition {
  final String id;
  final String contractSymbol;
  final String underlyingSymbol;
  final String type;
  final double strike;
  final int expiration;
  final int lots;
  final double premium;
  final String side;
  final String timestamp;

  OptionPosition({
    required this.id,
    required this.contractSymbol,
    required this.underlyingSymbol,
    required this.type,
    required this.strike,
    required this.expiration,
    required this.lots,
    required this.premium,
    required this.side,
    required this.timestamp,
  });

  factory OptionPosition.fromJson(Map<String, dynamic> json) {
    return OptionPosition(
      id: json['id'] ?? '',
      contractSymbol: json['contractSymbol'] ?? '',
      underlyingSymbol: json['underlyingSymbol'] ?? '',
      type: json['type'] ?? '',
      strike: (json['strike'] ?? 0).toDouble(),
      expiration: (json['expiration'] ?? 0).toInt(),
      lots: (json['lots'] ?? 0).toInt(),
      premium: (json['premium'] ?? 0).toDouble(),
      side: json['side'] ?? 'buy',
      timestamp: json['timestamp'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'contractSymbol': contractSymbol,
      'underlyingSymbol': underlyingSymbol,
      'type': type,
      'strike': strike,
      'expiration': expiration,
      'lots': lots,
      'premium': premium,
      'side': side,
      'timestamp': timestamp,
    };
  }
}
