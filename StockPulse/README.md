# 🚀 StockPulse — Next-Gen Trading Terminal (Web)

StockPulse is a high-performance, premium glassmorphic trading simulation dashboard for **NSE (Indian)** stocks. It allows users to register, receive virtual E-Tokens (₹10,000 default), and trade equities and options in real-time utilizing live Yahoo Finance data. An administrative console provides full platform management, control over users, transactions, token airdrops, and recharge requests.

---

## ✨ Key Features

### 📊 Professional Dashboard
* **Glassmorphic UI**: Premium visual design featuring real-time `backdrop-blur` and vibrant animated accents.
* **Flexible Theme Support**: Full support for both **Dark Mode** (default) and **Light Mode** through custom HSL color palettes.
* **Interactive Charts**:
  * Real-time Line charts for quick price movements.
  * Professional candlestick charts powered by `lightweight-charts`.
* **Dynamic P&L Tracking**: Real-time calculations of Profit & Loss (P&L) across all active equity and option holdings.
* **Auto-Averaging Engine**: Automatically averages buying prices for multiple buy actions on the same stock.

### 📈 Advanced Trading Simulator
* **Equity Holdings**: Buy and sell NSE/BSE stocks with simulated instant settlement.
* **Automatic Target Controls**: Configure **Stop Loss (SL)** and **Take Profit (TP)** levels directly on holdings which persist across sessions.
* **Synthetic Options Chain**:
  * Simulates a real-time options chain (CE/PE contracts) based on the spot price of the underlying equity.
  * Dynamic strike price generation (25 strikes around ATM, scaled based on price range).
  * Expiry filters focusing on the upcoming Thursday weekly cycle.
  * Calculates CE/PE LTP using intrinsic value + time value bell curve decay.
* **NSE Stock Universe**: Pre-loaded list of 47 major NSE stocks across 8 key sectors (Finance, Tech, Energy, Auto, etc.) with integrated search functionality.

### 🛡️ Admin & Control Panel
* **Live Stats Overview**: Real-time tracking of platform-wide metrics (total users, trade count, volume, tokens in circulation).
* **User Management**: Search, sort, review user portfolios, delete accounts, or perform **Global E-Token Airdrops**.
* **Recharge Request System**: Users can request E-Token top-ups (min. 10,000 VT). Admins can approve or reject requests via the panel with auto-crediting.
* **Global Favorites Broadcast**: Push a default stock favorites watchlist to all platform users.

---

## 🛠️ Tech Stack

| Layer | Technology | Version | Description |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js | `16.2.1` | App Router, Serverless API Routes |
| **UI Library** | React | `19.2.4` | Server & Client Components |
| **Styling** | Tailwind CSS | `^4.2.2` | With `@tailwindcss/postcss` for advanced custom classes |
| **Database** | Supabase | `^2.39.3` | PostgreSQL relational database & auth provider |
| **Animations**| Framer Motion | `^12.38.0` | Fluid micro-animations & transitions |
| **Charts** | Recharts & Lightweight Charts | `^3.8.1` / `^5.1.0` | Professional financial visualizations |
| **Icons** | Lucide React | `^1.8.0` | Clean vector iconography |

---

## 🏛️ Database Schema

StockPulse runs on **PostgreSQL (via Supabase)**. The database is defined by four core tables:

### 1. `users`
| Column | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `email` | `text` | — | Primary Key |
| `name` | `text` | — | Not Null |
| `password` | `text` | — | bcryptjs hashed |
| `branch` | `text` | — | Optional user profile |
| `enrollment` | `text` | — | Optional user profile |
| `etokens` | `numeric` | `10000` | Current virtual wallet balance |
| `e_tokens` | `numeric` | `10000` | Legacy compatibility alias |
| `portfolio`| `jsonb` | `[]` | Array of `PortfolioItem` objects |
| `options` | `jsonb` | `[]` | Array of `OptionPosition` objects |

### 2. `trades`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `_id` | `text` | Primary Key (timestamp-based) |
| `email` | `text` | FK → `users.email` (Cascade on delete) |
| `action` | `text` | `"buy"` or `"sell"` |
| `symbol` | `text` | e.g. `NSE:RELIANCE` |
| `amount` | `numeric` | Quantity of stocks traded |
| `price` | `numeric` | Execution price |
| `total` | `numeric` | Total value (`amount * price`) |
| `timestamp`| `text` | ISO 8601 string |

### 3. `option_trades`
| Column | Type | Notes |
| :--- | :--- | :--- |
| `_id` | `text` | Primary Key |
| `email` | `text` | FK → `users.email` (Cascade on delete) |
| `action` | `text` | `"buy"` or `"sell"` |
| `contractSymbol` | `text` | e.g., `RELIANCE-12-Jun-2025-2500-CE` |
| `underlyingSymbol` | `text` | e.g., `NSE:RELIANCE` |
| `optionType` | `text` | `"call"` or `"put"` |
| `strike` | `numeric` | Strike price |
| `expiration` | `numeric` | Unix timestamp |
| `lots` | `numeric` | Number of lots traded |
| `premium` | `numeric` | Premium price per lot |
| `total` | `numeric` | Total premium paid (`lots * premium`) |
| `timestamp` | `text` | ISO 8601 string |

### 4. `recharge_requests`
| Column | Type | Default | Notes |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | `gen_random_uuid()` | Primary Key |
| `user_email` | `text` | — | Not Null |
| `user_name` | `text` | — | Display purposes |
| `requested_amount`| `integer` | `10000` | Min recharge: 10,000 VT |
| `description` | `text` | — | Reason / notes |
| `status` | `text` | `'pending'` | `pending` \| `approved` \| `rejected` |
| `created_at` | `timestamptz` | `now()` | Request creation time |
| `resolved_at` | `timestamptz` | — | Resolution timestamp |
| `admin_note` | `text` | — | Review notes left by admin |

---

## 🔌 API Reference

### 🧑 User APIs
* **Authentication**:
  * `GET /api/auth?email=<email>` - Fetch fresh user data + global favorites.
  * `POST /api/auth` - Register new accounts, authenticate users, or update user profiles.
* **Market Data**:
  * `GET /api/stock?symbol=<symbol>` - Live quote, Sparkline history, and Candlestick OHLC points (via Yahoo Finance).
  * `GET /api/quotes?symbols=<csv_list>` - Batch price retrieval for portfolio updates.
  * `GET /api/options?symbol=<symbol>` - Dynamic synthetic options chain generator.
  * `GET /api/stocks/search?q=<query>` - Autocomplete search engine filtered specifically to NSE equities.
* **Trading & Targets**:
  * `POST /api/trade` - Execute an equity or option trade (updates wallet balances, portfolios, and logs).
  * `POST /api/targets` - Set, update, or remove Stop Loss (SL) & Take Profit (TP) bounds.
  * `GET /api/history?email=<email>` - Fetch the history of trades (equity and options combined).
* **Recharges**:
  * `POST /api/recharge` - Submit a new recharge request.

### 👑 Admin APIs (`/api/admin/*`)
*Requires `ADMIN_PASSWORD` validation in headers/body.*
* `POST /api/admin/login` - Validate the admin password.
* `GET /api/admin/stats` - Fetch aggregate system metrics (volume, users, cash, trades).
* `GET /api/admin/users` - Fetch list of all registered users + trade counts.
* `POST /api/admin/user/reset-tokens` - Set a specific user's token balance.
* `POST /api/admin/airdrop` - Airdrop a specific amount of virtual tokens to **all** users simultaneously.
* `GET/PATCH /api/admin/recharge` - Review pending recharge requests and toggle state to approved/rejected.
* `GET/POST /api/admin/favorites` - Get or broadcast a updated list of default watchlist favorites.

---

## ⚙️ Setup & Installation

### 1. Configure Environment Variables
Create a `.env.local` file in the root folder with the following keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
ADMIN_PASSWORD=admin@stockpulse
```

### 2. Apply Database Schema
Log in to your **Supabase dashboard**, navigate to the **SQL Editor**, and run the commands located in:
1. `schema.sql` (Creates users, trades, option trades, and basic app configurations).
2. `schema_recharge.sql` (Creates recharge tables and RLS configurations).

### 3. Install and Run
```bash
# Install dependencies
npm install

# Run the local development server
npm run dev
```

Visit the app at `http://localhost:3000`. Access the administrative dashboard directly at `http://localhost:3000/admin`.

---

## 📐 Formatting Rules
* **Symbol Format**:
  * `NSE:TICKER` resolves to `TICKER.NS` (e.g., `NSE:RELIANCE` → `RELIANCE.NS`)
  * `BSE:TICKER` resolves to `TICKER.BO` (e.g., `BSE:TATASTEEL` → `TATASTEEL.BO`)
* **Currency Representation**: Formatted dynamically matching the Indian Numbering System:
  * `>= 1 Crore` (10M): `₹X.XX Cr`
  * `>= 1 Lakh` (100K): `₹X.XX L`
  * `>= 10,000`: `₹X.XK`
  * `< 10,000`: `₹X,XXX.XX`

---

> [!NOTE]
> All external data fetches use a customized `User-Agent: Mozilla/5.0` header to avoid bot blocking. No API keys are required for market quotes.

© 2026 StockPulse Team. All rights reserved.
