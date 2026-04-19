# StockPulse — Complete Application Reference

---

## 1. Overview

StockPulse is a Next.js 16 glassmorphic trading simulation dashboard for NSE (Indian) stocks. Users register, receive virtual E-Tokens (₹1,00,000 default), and can trade equities and options in real-time using live Yahoo Finance data. An admin panel provides full platform management.

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js | 16.2.1 |
| UI Library | React | 19.2.4 |
| Styling | Tailwind CSS | ^4.2.2 |
| Database / Auth | Supabase (PostgreSQL) | ^2.39.3 |
| Animations | Framer Motion | ^12.38.0 |
| Charts | Recharts | ^3.8.1 |
| Candlestick Charts | lightweight-charts | ^5.1.0 |
| Icons | Lucide React | ^1.8.0 |
| Theme | next-themes | ^0.4.6 |
| Password Hashing | bcryptjs | ^3.0.3 |
| Class Utilities | clsx + tailwind-merge | ^2.1.1 / ^3.5.0 |
| Fonts | Geist Sans + Geist Mono | Google Fonts |
| Language | TypeScript | ^5 |

---

## 3. Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://yswlsbrenmtfixkqkpdl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_jwt_token>
SUPABASE_SERVICE_ROLE_KEY=<service_role_jwt_token>
ADMIN_PASSWORD=admin@stockpulse
```

> The Supabase client uses `SUPABASE_SERVICE_ROLE_KEY` on the server (bypasses RLS) and falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` on the client.

---

## 4. Database Schema (Supabase / PostgreSQL)

### Table: `users`
| Column | Type | Default | Notes |
|---|---|---|---|
| email | text | — | PRIMARY KEY |
| name | text | — | NOT NULL |
| password | text | — | bcrypt hashed |
| branch | text | — | |
| enrollment | text | — | |
| etokens | numeric | 10000 | Virtual wallet balance |
| e_tokens | numeric | 10000 | Legacy alias for etokens |
| portfolio | jsonb | `[]` | Array of PortfolioItem |
| options | jsonb | `[]` | Array of OptionPosition |

### Table: `trades`
| Column | Type | Notes |
|---|---|---|
| _id | text | PRIMARY KEY (timestamp-based) |
| email | text | FK → users(email) ON DELETE CASCADE |
| action | text | `"buy"` or `"sell"` |
| symbol | text | e.g. `NSE:RELIANCE` |
| amount | numeric | Quantity |
| price | numeric | Price per share |
| total | numeric | amount × price |
| timestamp | text | ISO 8601 string |

### Table: `option_trades`
| Column | Type | Notes |
|---|---|---|
| _id | text | PRIMARY KEY |
| email | text | FK → users(email) ON DELETE CASCADE |
| action | text | `"buy"` or `"sell"` |
| contractSymbol | text | e.g. `RELIANCE-12-Jun-2025-2500-CE` |
| underlyingSymbol | text | e.g. `NSE:RELIANCE` |
| optionType | text | `"call"` or `"put"` |
| strike | numeric | Strike price |
| expiration | numeric | Unix timestamp |
| lots | numeric | Number of lots |
| premium | numeric | Premium per lot |
| total | numeric | lots × premium |
| timestamp | text | ISO 8601 string |

### Table: `recharge_requests`
| Column | Type | Default | Notes |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PRIMARY KEY |
| user_email | text | — | NOT NULL |
| user_name | text | — | |
| requested_amount | integer | 10000 | Min: 10,000 VT |
| description | text | — | |
| status | text | `'pending'` | `pending` / `approved` / `rejected` |
| created_at | timestamptz | now() | |
| resolved_at | timestamptz | — | |
| admin_note | text | — | |

### Table: `app_config`
| Column | Type | Notes |
|---|---|---|
| key | text | PRIMARY KEY |
| value | jsonb | Stores global_favorites as string[] |

**Seed:** `INSERT INTO app_config (key, value) VALUES ('global_favorites', '[]'::jsonb)`

---

## 5. API Routes

All routes live under `/app/api/`.

### User-Facing APIs

#### `GET /api/auth?email=`
Fetches fresh user data + global favorites from Supabase.

#### `POST /api/auth`
| action | Payload | Description |
|---|---|---|
| `register` | name, email, password, branch, enrollment | Creates user with 10,000 eTokens |
| `login` | email, password | Validates bcrypt password |
| `update` | email, name, branch, enrollment, currentPassword, newPassword | Updates profile/password |

#### `POST /api/trade`
Handles both equity and options trades.
- `tradeType: "equity"` — buy/sell stocks, updates portfolio + eTokens
- `tradeType: "option"` — buy/sell option contracts, updates options + eTokens
- Inserts record into `trades` or `option_trades` table

#### `GET /api/stock?symbol=`
Fetches from Yahoo Finance v8 chart API:
- Quote data (current price, open, high, low, prev close, change, % change)
- Line chart data (5m interval, 1d range, IST timezone)
- Candlestick data (OHLC, 5m interval)
- Cache: `s-maxage=20, stale-while-revalidate=59`

#### `GET /api/quotes?symbols=`
Batch price fetch using Yahoo Finance Spark endpoint (`/v7/finance/spark`).
- Accepts comma-separated symbols
- Returns `{ "NSE:SYMBOL": price }` map

#### `GET /api/options?symbol=`
Generates a dynamic options chain based on live spot price from Yahoo Finance:
- 25 strikes (±12 from ATM), step size based on price range
- Expiry: next Thursday
- Calculates CE/PE LTP using intrinsic value + time value bell curve
- Returns: `{ underlyingPrice, expiryDates, calls[], puts[], marketClosed }`

#### `GET /api/history?email=`
Returns last 100 equity trades + last 100 option trades for a user.

#### `POST /api/targets`
Sets Stop Loss (sl) and Take Profit (tp) on a portfolio holding.
- Payload: `{ email, symbol, sl, tp }`

#### `POST /api/recharge`
Submits a recharge request (min 10,000 VT).
- Payload: `{ email, name, requestedAmount, description }`

#### `GET /api/recharge`
Health check — validates `recharge_requests` table exists.

#### `GET /api/stocks/search?q=`
Yahoo Finance autocomplete search filtered to NSE equities only (`exchange=NSI`, `quoteType=EQUITY`, `.NS` suffix).

---

### Admin APIs (`/api/admin/`)

All admin write operations require `ADMIN_PASSWORD` in the request body.

| Route | Method | Description |
|---|---|---|
| `/api/admin/login` | POST | Validates admin password |
| `/api/admin/stats` | GET | Returns totalUsers, totalTrades, totalOptionTrades, totalVolume, totalETokens |
| `/api/admin/users` | GET | All users with trade/option trade counts |
| `/api/admin/trades` | GET | All equity + option trades (ordered by timestamp desc) |
| `/api/admin/trades` | DELETE | Bulk delete trades by `_id` array |
| `/api/admin/user` | DELETE | Delete single user or bulk delete by email array |
| `/api/admin/user/reset-tokens` | POST | Set a user's eTokens to a specific amount |
| `/api/admin/airdrop` | POST | Add eTokens to ALL users simultaneously |
| `/api/admin/recharge` | GET | List all recharge requests |
| `/api/admin/recharge` | PATCH | Approve/reject a recharge request (credits tokens if approved) |
| `/api/admin/favorites` | GET | Get current global favorites list |
| `/api/admin/favorites` | POST | Push new global favorites list to all users |

---

## 6. Symbol Format

| Format | Exchange | Yahoo Finance Conversion |
|---|---|---|
| `NSE:TICKER` | NSE India | `TICKER.NS` |
| `BSE:TICKER` | BSE India | `TICKER.BO` |

---

## 7. Stock Universe (constants.ts)

47 pre-loaded NSE stocks across 8 sectors:

| Sector | Stocks |
|---|---|
| Finance | HDFCBANK, ICICIBANK, SBIN, KOTAKBANK, AXISBANK, BAJFINANCE, BAJAJFINSV, SHRIRAMFIN, INDUSINDBK |
| Technology | TCS, INFY, WIPRO, HCLTECH, TECHM |
| Energy | RELIANCE, ONGC, POWERGRID, NTPC, ADANIGREEN |
| Infrastructure | ADANIPORTS, ADANIENT, LT, ULTRACEMCO, GRASIM |
| Consumer | HINDUNILVR, ITC, NESTLEIND, TITAN, ASIANPAINT, BRITANNIA, TATACONSUM |
| Automotive | TATAMOTORS, MARUTI, M&M, EICHERMOT, HEROMOTOCO, BAJAJ-AUTO |
| Healthcare | SUNPHARMA, DRREDDY, CIPLA, DIVISLAB, APOLLOHOSP |
| Metals | TATASTEEL, JSWSTEEL, HINDALCO, COALINDIA |
| Telecom | BHARTIARTL |

---

## 8. Color Palette

### Light Theme
| Token | Value | Usage |
|---|---|---|
| `--background` | `#fafbff` | Page background |
| `--foreground` | `#0a0f1e` | Primary text |
| `--card` | `#ffffff` | Card background |
| `--primary` | `#4f46e5` | Indigo-violet — buttons, accents |
| `--primary-foreground` | `#ffffff` | Text on primary |
| `--secondary` | `#f1f5ff` | Secondary surfaces |
| `--muted` | `#f1f5ff` | Muted backgrounds |
| `--muted-foreground` | `#6b7280` | Muted text |
| `--accent` | `#ede9fe` | Accent background |
| `--accent-foreground` | `#4f46e5` | Accent text |
| `--destructive` | `#ef4444` | Errors, sell actions |
| `--border` | `rgba(79,70,229,0.08)` | Borders |
| `--input` | `#e8eaf6` | Input backgrounds |
| `--glass-bg` | `rgba(255,255,255,0.75)` | Glassmorphism fill |
| `--glass-border` | `rgba(79,70,229,0.1)` | Glass borders |

### Dark Theme (Default)
| Token | Value | Usage |
|---|---|---|
| `--background` | `#060912` | Deep navy-black |
| `--foreground` | `#e8eaff` | Light lavender text |
| `--card` | `#0d1117` | Card background |
| `--primary` | `#6366f1` | Electric indigo |
| `--primary-foreground` | `#ffffff` | |
| `--secondary` | `#111827` | Dark secondary |
| `--muted` | `#111827` | |
| `--muted-foreground` | `#9ca3af` | |
| `--accent` | `#1e1b4b` | Deep indigo accent |
| `--accent-foreground` | `#a5b4fc` | Soft lavender |
| `--destructive` | `#f87171` | Soft red |
| `--border` | `rgba(99,102,241,0.12)` | |
| `--input` | `rgba(99,102,241,0.08)` | |
| `--glass-bg` | `rgba(13,17,23,0.7)` | Dark glass |
| `--glass-border` | `rgba(99,102,241,0.15)` | |

### Semantic Colors (used in UI)
| Color | Hex | Usage |
|---|---|---|
| Profit / Buy / Success | `#10b981` (emerald-500) | Gains, buy badges, live dot |
| Loss / Sell / Error | `#ef4444` / `#f87171` | Losses, sell badges |
| Gradient Text | `#6366f1 → #8b5cf6 → #3b82f6 → #06b6d4` | Premium gradient text |
| Admin Airdrop | `#06b6d4` (cyan-600) | Airdrop panel |
| Admin Favorites | `#f59e0b` (amber-500) | Favorites broadcast |
| Admin Recharge | `#10b981` (emerald) | Recharge tab |

### Shadows
| Token | Value |
|---|---|
| `--shadow-sm` | `0 1px 3px rgba(79,70,229,0.08)` |
| `--shadow-md` | `0 4px 24px rgba(79,70,229,0.1)` |
| `--shadow-lg` | `0 8px 40px rgba(79,70,229,0.14)` |
| `--shadow-glow` | `0 0 40px rgba(79,70,229,0.25)` |
| Dark `--shadow-glow` | `0 0 40px rgba(99,102,241,0.3)` |

---

## 9. CSS Utilities & Animations

### Custom Utilities
| Class | Description |
|---|---|
| `glass-premium` | Glassmorphism: `backdrop-filter: blur(12px) saturate(1.4)`, shimmer on hover |
| `glass-card` | `glass-premium` + `rounded-2xl p-5` |
| `glass-card-hover` | `glass-card` + hover lift + border glow |
| `btn-premium` | Gradient button with hover scale + glow shadow |
| `stat-card` | Glass stat card with hover lift |
| `gradient-text-premium` | Animated 4-color gradient text |
| `live-dot` | Pulsing green dot (live indicator) |

### Easing Curves
| Variable | Value |
|---|---|
| `--ease-premium` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--ease-fluid` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| `--ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

### Keyframe Animations
| Animation | Duration | Description |
|---|---|---|
| `shimmer-premium` | 6s infinite | Glass card shimmer sweep |
| `text-shine` | 5s infinite | Gradient text color shift |
| `float` | 6s infinite | Vertical float (-8px) |
| `glow-pulse` | 3s infinite | Box-shadow glow pulse |
| `live-ping` | 2s infinite | Live dot ring expansion |
| `slide-up-fade-in` | 0.4s | Entry animation |
| `counter-up` | 0.3s | Number tick animation |

### Scrollbar
- Width: 3px, transparent track
- Thumb: `rgba(99,102,241,0.2)` → `rgba(99,102,241,0.45)` on hover

---

## 10. Application Pages & Components

### Pages
| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Entry — routes to Login / Register / Dashboard |
| `/admin` | `app/admin/page.tsx` | Admin panel (password protected) |

### Session Management
- `localStorage.session_email` — persists logged-in email
- `localStorage.session_user` — cached UserData JSON
- Background re-validation on every page load via `GET /api/auth`
- `sessionStorage.admin_authed` — admin session flag

### Auth Components
| Component | Description |
|---|---|
| `LoginScreen.tsx` | Email + password login form |
| `RegisterScreen.tsx` | Registration form (name, email, password, branch, enrollment) |
| `AuthCard.tsx` | Shared glassmorphic card wrapper for auth screens |

### Dashboard Components
| Component | Description |
|---|---|
| `Dashboard.tsx` | Main layout — sidebar, chart area, trade panel, portfolio |
| `ChartArea.tsx` | Stock selector, quote display, chart toggle (line/candle) |
| `CandlestickChart.tsx` | lightweight-charts candlestick renderer |
| `TradePanel.tsx` | Buy/sell form for equity and options |
| `PortfolioPanel.tsx` | Holdings list with P&L, SL/TP controls |
| `OptionsChain.tsx` | CE/PE options table with strike/expiry filter |
| `ProfileDropdown.tsx` | User menu — profile, recharge, logout |
| `EditProfileModal.tsx` | Edit name, branch, enrollment, change password |
| `RechargeModal.tsx` | Submit E-Token recharge request |

### UI Components
| Component | Description |
|---|---|
| `NeuralBackground.tsx` | Animated background canvas/SVG |
| `Orbs.tsx` | Floating gradient orb decorations |
| `ThemeToggle.tsx` | Light/dark mode toggle button |
| `Tilt.tsx` | 3D tilt effect wrapper (perspective-1000) |
| `Toast.tsx` | Success/error notification toast |
| `Field.tsx` | Reusable form field component |
| `ThemeProvider.tsx` | next-themes wrapper (default: dark) |

---

## 11. Data Types (lib/types.ts)

```typescript
UserData       { name, email, branch, enrollment, eTokens, portfolio[], options[] }
PortfolioItem  { symbol, amount, avgBuyPrice, sl?, tp? }
OptionPosition { id, contractSymbol, underlyingSymbol, type, strike, expiration, lots, premium, side, timestamp }
TradeRecord    { _id, action, symbol, amount, price, total, timestamp }
OptionTradeRecord { _id, action, contractSymbol, underlyingSymbol, optionType, strike, expiration, lots, premium, total, timestamp }
OptionContract { contractSymbol, strike, expiration, lastPrice, bid, ask, change, percentChange, volume, openInterest, impliedVolatility, inTheMoney }
Quote          { c, d, dp, h, l, o, pc }   // current, delta, delta%, high, low, open, prevClose
ChartPoint     { time: string, price: number }
CandlePoint    { time: number, open, high, low, close }
Company        { name, symbol, sector }
Screen         "login" | "register" | "dashboard"
ToastData      { message, type: "success" | "error" }
```

---

## 12. Currency Formatter (lib/format.ts)

Indian Numbering System with 4-tier compact notation:

| Range | Format | Example |
|---|---|---|
| ≥ 1 Crore (10M) | `₹X.XX Cr` | ₹1.25 Cr |
| ≥ 1 Lakh (100K) | `₹X.XX L` | ₹2.50 L |
| ≥ 10,000 | `₹X.XK` | ₹15.3K |
| < 10,000 | `₹X,XXX.XX` | ₹9,500.00 |

Functions: `formatAmount(n, { compact, symbol })`, `formatCompact(n)`

---

## 13. Admin Panel Features

Accessible at `/admin`, protected by `ADMIN_PASSWORD`.

| Tab | Features |
|---|---|
| **Users** | View all users, search, sort by eTokens, view portfolio/options, reset tokens, delete user, bulk delete, Global E-Token Airdrop |
| **Trades** | View all equity trades, search by email/symbol, bulk delete |
| **Option Trades** | View all option trades, search, bulk delete |
| **Recharge** | View/approve/reject recharge requests, auto-credits tokens on approval |
| **Favorites** | Search NSE stocks, build global favorites list, push to all users |

### Stats Dashboard
- Total Users
- Total Equity Trades
- Total Option Trades
- Total Trading Volume (₹)
- Total E-Tokens in circulation

Auto-refreshes every 5 seconds.

---

## 14. Options Chain Logic

Since NSE API blocks direct server-side requests, the options chain is synthetically generated:

1. Fetch live spot price from Yahoo Finance
2. Calculate ATM strike (rounded to step: ₹5/₹10/₹20/₹50 based on price)
3. Generate 25 strikes (±12 from ATM)
4. Expiry = next Thursday (weekly expiry)
5. CE/PE LTP = intrinsic value + time value (bell curve decay by distance from ATM)
6. Deterministic pseudo-random for volume/OI/IV using `Math.sin(seed)` seeding

---

## 15. Project File Structure

```
StockPulse/
├── app/
│   ├── api/
│   │   ├── auth/route.ts          # Login, register, update profile
│   │   ├── trade/route.ts         # Equity + options trading
│   │   ├── stock/route.ts         # Single stock quote + chart data
│   │   ├── quotes/route.ts        # Batch price fetch
│   │   ├── options/route.ts       # Options chain generator
│   │   ├── history/route.ts       # Trade history
│   │   ├── targets/route.ts       # SL/TP management
│   │   ├── recharge/route.ts      # Recharge requests
│   │   ├── stocks/search/route.ts # NSE stock search
│   │   └── admin/
│   │       ├── login/             # Admin auth
│   │       ├── stats/             # Platform stats
│   │       ├── users/             # User management
│   │       ├── trades/            # Trade management
│   │       ├── user/              # Delete user
│   │       ├── user/reset-tokens/ # Reset eTokens
│   │       ├── airdrop/           # Global token airdrop
│   │       ├── recharge/          # Recharge approval
│   │       └── favorites/         # Global favorites
│   ├── admin/page.tsx             # Admin dashboard UI
│   ├── page.tsx                   # Main app entry
│   ├── layout.tsx                 # Root layout + ThemeProvider
│   └── globals.css                # All CSS variables, utilities, animations
├── components/
│   ├── auth/                      # LoginScreen, RegisterScreen, AuthCard
│   ├── dashboard/                 # Dashboard, ChartArea, TradePanel, etc.
│   ├── providers/ThemeProvider.tsx
│   └── ui/                        # NeuralBackground, Orbs, Toast, Tilt, etc.
├── lib/
│   ├── types.ts                   # All TypeScript types
│   ├── constants.ts               # COMPANIES array (47 NSE stocks)
│   ├── supabase.ts                # Supabase client + safeUser()
│   ├── format.ts                  # Indian currency formatter
│   └── utils.ts                   # cn() class merger
├── schema.sql                     # users, trades, option_trades, app_config
├── schema_recharge.sql            # recharge_requests table + RLS policy
├── .env                           # Environment variables
└── package.json
```

---

## 16. External Data Sources

| Source | Endpoint | Used For |
|---|---|---|
| Yahoo Finance v8 Chart | `query1.finance.yahoo.com/v8/finance/chart/{symbol}` | Quote data, OHLC chart |
| Yahoo Finance v7 Spark | `query1.finance.yahoo.com/v7/finance/spark?symbols=` | Batch portfolio prices |
| Yahoo Finance Search | `query1.finance.yahoo.com/v1/finance/search?q=` | NSE stock autocomplete |

All external fetches use `User-Agent: Mozilla/5.0` header to avoid bot blocking. No API keys required.

---

## 17. Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env with Supabase credentials (see Section 3)

# 3. Run schema.sql in Supabase SQL Editor
# 4. Run schema_recharge.sql in Supabase SQL Editor

# 5. Start dev server
npm run dev
# → http://localhost:3000
# → http://localhost:3000/admin
```

---

*© 2026 StockPulse Team. All rights reserved.*
