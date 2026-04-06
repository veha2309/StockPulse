# 📱 StockPulse - Mobile Trading Terminal (Flutter)

A professional-grade Flutter application for real-time stock and options trading. Features high-precision interactive charting, granular per-holding risk management, and complete synchronization with the StockPulse Web Backend.

---

## 🔥 Key Mobile Features

### 📊 Professional Interactive Charting
- **CandleChart**: Custom-painted candlestick charts with high-precision touch tracking.
- **Crosshair Tracking**: Tap and drag to see exact Open, High, Low, and Close values at any point in time. 
- **Full-Width View**: Optimized for mobile screens to provide maximum data detail.

### 🎯 Granular Risk Management
- **Per-Holding Targets**: Set unique Stop Loss (SL) and Take Profit (TP) levels for *every* individual trade. 
- **FIFO Selling**: Automated "First-In, First-Out" logic for consistent profit/loss calculations. 
- **Sticky State**: Targets and UI preferences persist across app restarts and device reloads. 

### 🔄 Real-time Synchronization
- **Pull-to-Refresh**: Swipe down on any screen to trigger a manual sync with the Supabase database. 
- **Supabase Realtime**: Seamlessly synchronized with the web app—buy on web, sell on mobile.

---

## 🛠️ Mobile Tech Stack
- **Framework**: [Flutter](https://flutter.dev/)
- **State Management**: [Provider](https://pub.dev/packages/provider)
- **Backend Service**: [Supabase Flutter](https://supabase.com/docs/guides/with-flutter)
- **Data Source**: Yahoo Finance API (Market OHLC Data)
- **Local Persistence**: Hive (Secure Session Management)

---

## ⚙️ Mobile App Setup

### 1. Prerequisites
- Flutter SDK (v3.19 or higher)
- Android Studio / VS Code (with Flutter extensions)

### 2. Environment Configuration
Create a `.env` file in `stockpulse_flutter/`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Install Dependencies
```bash
flutter pub get
```

### 4. Launch the App
```bash
flutter run
```

---

## 🏗️ Folder Structure
- `lib/models`: Data structures (`UserData`, `PortfolioItem`, `OptionPosition`).
- `lib/providers`: State management (`AuthProvider`, `MarketProvider`, `PortfolioProvider`).
- `lib/screens`: Interactive UI layers (`Dashboard`, `Portfolio`, `StockDetail`, `OptionsChain`).
- `lib/widgets`: Custom components (`CandleChart`, `GlassCard`).

---

> [!IMPORTANT]
> **Security Note**: This application is configured to use the **Service Role Key** to match the Web App's server-side access model. Ensure this key is protected and the `.env` file is never committed to public version control.

---
© 2026 StockPulse Team. All rights reserved.
