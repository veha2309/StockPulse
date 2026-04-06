import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/market_provider.dart';
import 'providers/portfolio_provider.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';

void main() async {
  print("STP: Main initialization started...");
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables
  try {
    await dotenv.load(fileName: ".env");
    print("STP: .env loaded.");
  } catch (e) {
    print("STP ERROR: Could not load .env file: $e");
  }

  // Initialize Hive
  await Hive.initFlutter();
  await Hive.openBox('settings');
  print("STP: Hive initialized.");

  // Initialize Supabase with variables from .env
  try {
    print("STP: Initializing Supabase...");
    await Supabase.initialize(
      url: dotenv.get('SUPABASE_URL', fallback: ''),
      anonKey: dotenv.get('SUPABASE_SERVICE_ROLE_KEY', fallback: dotenv.get('SUPABASE_ANON_KEY', fallback: '')),
    ).timeout(const Duration(seconds: 10), onTimeout: () {
      print("STP: Supabase initialization timed out!");
      throw 'Initialization Timeout';
    });
    print("STP: Supabase initialized.");
  } catch (e) {
    print("STP ERROR: Supabase init failed: $e");
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => MarketProvider()),
        ChangeNotifierProxyProvider<AuthProvider, PortfolioProvider>(
          create: (_) => PortfolioProvider(),
          update: (_, auth, portfolio) => portfolio!..updateAuth(auth),
        ),
      ],
      child: const StockPulseApp(),
    ),
  );
  print("STP: runApp called.");
}

class StockPulseApp extends StatelessWidget {
  const StockPulseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'StockPulse',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          if (auth.isInitializing) {
            return const Scaffold(
              backgroundColor: AppTheme.background,
              body: Center(
                child: CircularProgressIndicator(color: AppTheme.primary),
              ),
            );
          }
          if (auth.isAuthenticated) {
            return const DashboardScreen();
          }
          return const LoginScreen();
        },
      ),
    );
  }
}
