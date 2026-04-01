const express = require("express");
const cors    = require("cors");
const bcrypt  = require("bcryptjs");
const fs      = require("fs");
const path    = require("path");
const https   = require("https");
const http    = require("http");

const app      = express();
const DATA_DIR = path.join(__dirname, "data");
const PORT     = 4000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} (${Date.now() - start}ms)`));
  next();
});

// ── JSON helpers ──────────────────────────────────────────────────────────────
function readJSON(file) {
  const fp = path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, "[]", "utf-8");
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), "utf-8");
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function safeUser(u) {
  return { name: u.name, email: u.email, branch: u.branch, enrollment: u.enrollment, eTokens: u.eTokens, portfolio: u.portfolio, options: u.options ?? [] };
}

app.get("/api/auth", (req, res) => {
  const users = readJSON("users.json");
  const user  = users.find(u => u.email === req.query.email);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ eTokens: user.eTokens, portfolio: user.portfolio, options: user.options ?? [] });
});

app.post("/api/auth", async (req, res) => {
  const { action } = req.body;
  try {
    if (action === "register") {
      const { name, email, password, branch, enrollment } = req.body;
      const users = readJSON("users.json");
      if (users.find(u => u.email === email))
        return res.status(400).json({ error: "Email already registered" });
      const hashed = await bcrypt.hash(password, 10);
      const user   = { name, email, password: hashed, branch, enrollment, eTokens: 10000, portfolio: [], options: [] };
      users.push(user);
      writeJSON("users.json", users);
      console.log(`[REGISTER] ${email} (${name})`);
      return res.json({ success: true, user: safeUser(user) });
    }

    if (action === "login") {
      const { email, password } = req.body;
      const users = readJSON("users.json");
      const user  = users.find(u => u.email === email);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        console.log(`[LOGIN FAILED] ${email}`);
        return res.status(401).json({ error: "Invalid email or password" });
      }
      console.log(`[LOGIN] ${email}`);
      return res.json({ success: true, user: safeUser(user) });
    }

    if (action === "update") {
      const { email, name, branch, enrollment, currentPassword, newPassword } = req.body;
      const users = readJSON("users.json");
      const user  = users.find(u => u.email === email);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (!(await bcrypt.compare(currentPassword, user.password)))
        return res.status(401).json({ error: "Current password is incorrect" });
      if (name)        user.name       = name;
      if (branch)      user.branch     = branch;
      if (enrollment)  user.enrollment = enrollment;
      if (newPassword) user.password   = await bcrypt.hash(newPassword, 10);
      writeJSON("users.json", users);
      return res.json({ success: true, user: safeUser(user) });
    }

    res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    console.error("[auth]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Trade ─────────────────────────────────────────────────────────────────────
app.post("/api/trade", async (req, res) => {
  try {
    const body  = req.body;
    const users = readJSON("users.json");
    const user  = users.find(u => u.email === body.email);
    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date().toISOString();

    if (body.tradeType === "equity" || !body.tradeType) {
      const { action, symbol, amount, price } = body;
      if (!action || !symbol || !amount || amount <= 0 || !price)
        return res.status(400).json({ error: "Missing or invalid fields" });

      const total = parseFloat((amount * price).toFixed(2));

      if (action === "buy") {
        if (user.eTokens < total)
          return res.status(400).json({ error: "Insufficient E-Tokens" });
        user.eTokens = parseFloat((user.eTokens - total).toFixed(2));
        const holding = user.portfolio.find(p => p.symbol === symbol);
        if (holding) {
          const prevTotal = holding.avgBuyPrice * holding.amount;
          holding.amount      += amount;
          holding.avgBuyPrice  = parseFloat(((prevTotal + price * amount) / holding.amount).toFixed(4));
        } else {
          user.portfolio.push({ symbol, amount, avgBuyPrice: price });
        }
      } else if (action === "sell") {
        const holding = user.portfolio.find(p => p.symbol === symbol);
        if (!holding || holding.amount < amount)
          return res.status(400).json({ error: "Insufficient shares to sell" });
        user.eTokens = parseFloat((user.eTokens + total).toFixed(2));
        holding.amount -= amount;
        if (holding.amount === 0)
          user.portfolio = user.portfolio.filter(p => p.symbol !== symbol);
      } else {
        return res.status(400).json({ error: "Invalid action" });
      }

      writeJSON("users.json", users);
      const trades = readJSON("trades.json");
      trades.push({ _id: Date.now().toString(), email: body.email, action, symbol, amount, price, total, timestamp: now });
      writeJSON("trades.json", trades);
      return res.json({ user: safeUser(user) });
    }

    if (body.tradeType === "option") {
      const { action, contractSymbol, underlyingSymbol, optionType, strike, expiration, lots, premium } = body;
      if (!action || !contractSymbol || !lots || lots <= 0 || !premium)
        return res.status(400).json({ error: "Missing or invalid option fields" });

      const total = parseFloat((lots * premium).toFixed(2));

      if (action === "buy") {
        if (user.eTokens < total)
          return res.status(400).json({ error: "Insufficient E-Tokens" });
        user.eTokens = parseFloat((user.eTokens - total).toFixed(2));
        user.options = user.options ?? [];
        user.options.push({ id: Date.now().toString(), contractSymbol, underlyingSymbol, type: optionType, strike, expiration, lots, premium, side: "buy", timestamp: now });
      } else if (action === "sell") {
        const pos = (user.options ?? []).find(o => o.contractSymbol === contractSymbol && o.side === "buy");
        if (!pos || pos.lots < lots)
          return res.status(400).json({ error: "Insufficient option lots to sell" });
        user.eTokens = parseFloat((user.eTokens + total).toFixed(2));
        pos.lots -= lots;
        if (pos.lots === 0)
          user.options = user.options.filter(o => o.id !== pos.id);
      } else {
        return res.status(400).json({ error: "Invalid action" });
      }

      writeJSON("users.json", users);
      const optTrades = readJSON("option_trades.json");
      optTrades.push({ _id: Date.now().toString(), email: body.email, action, contractSymbol, underlyingSymbol, optionType, strike, expiration, lots, premium, total, timestamp: now });
      writeJSON("option_trades.json", optTrades);
      return res.json({ user: safeUser(user) });
    }

    res.status(400).json({ error: "Invalid tradeType" });
  } catch (err) {
    console.error("[trade]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── History ───────────────────────────────────────────────────────────────────
app.get("/api/history", (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "No email" });
  const trades = readJSON("trades.json")
    .filter(t => t.email === email)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100);
  const optionTrades = readJSON("option_trades.json")
    .filter(t => t.email === email)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100);
  res.json({ trades, optionTrades });
});

// ── Admin ─────────────────────────────────────────────────────────────────────
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    console.log("[ADMIN LOGIN FAILED]");
    return res.status(401).json({ error: "Invalid admin password" });
  }
  console.log("[ADMIN LOGIN]");
  res.json({ success: true });
});

app.get("/api/admin/stats", (req, res) => {
  const users  = readJSON("users.json");
  const trades = readJSON("trades.json");
  const opts   = readJSON("option_trades.json");
  const totalVolume = trades.reduce((s, t) => s + t.total, 0) + opts.reduce((s, t) => s + t.total, 0);
  res.json({
    totalUsers:        users.length,
    totalTrades:       trades.length,
    totalOptionTrades: opts.length,
    totalVolume:       parseFloat(totalVolume.toFixed(2)),
    totalETokens:      users.reduce((s, u) => s + u.eTokens, 0),
  });
});

app.get("/api/admin/users", (req, res) => {
  const users  = readJSON("users.json");
  const trades = readJSON("trades.json");
  const opts   = readJSON("option_trades.json");
  const result = users.map(u => ({
    ...safeUser(u),
    tradeCount:       trades.filter(t => t.email === u.email).length,
    optionTradeCount: opts.filter(t => t.email === u.email).length,
  }));
  res.json(result);
});

app.get("/api/admin/trades", (req, res) => {
  const trades = readJSON("trades.json").sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const opts   = readJSON("option_trades.json").sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json({ trades, optionTrades: opts });
});

app.post("/api/admin/user/reset-tokens", (req, res) => {
  const { email, amount } = req.body;
  const users = readJSON("users.json");
  const user  = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.eTokens = typeof amount === "number" ? amount : 10000;
  writeJSON("users.json", users);
  console.log(`[ADMIN] Reset tokens for ${email} to ${user.eTokens}`);
  res.json({ success: true, eTokens: user.eTokens });
});

app.delete("/api/admin/user", (req, res) => {
  const { email } = req.body;
  const users = readJSON("users.json");
  const idx   = users.findIndex(u => u.email === email);
  if (idx === -1) return res.status(404).json({ error: "User not found" });
  users.splice(idx, 1);
  writeJSON("users.json", users);
  console.log(`[ADMIN] Deleted user ${email}`);
  res.json({ success: true });
});

// ── Stock proxy (Yahoo Finance) ───────────────────────────────────────────────
const SYMBOL_MAP = {
  "NSE:RELIANCE":   "RELIANCE.NS",
  "NSE:TCS":        "TCS.NS",
  "NSE:INFY":       "INFY.NS",
  "NSE:HDFCBANK":   "HDFCBANK.NS",
  "NSE:ICICIBANK":  "ICICIBANK.NS",
  "NSE:WIPRO":      "WIPRO.NS",
  "NSE:SBIN":       "SBIN.NS",
  "NSE:BAJFINANCE": "BAJFINANCE.NS",
  "NSE:HINDUNILVR": "HINDUNILVR.NS",
  "NSE:TATAMOTORS": "TATAMOTORS.NS",
};

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

app.get("/api/stock", async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "No symbol" });
  const yfSymbol = SYMBOL_MAP[symbol] ?? symbol;
  try {
    const [quoteJson, chartJson] = await Promise.all([
      fetchURL(`https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?interval=1d&range=1d`),
      fetchURL(`https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?interval=5m&range=1d`),
    ]);

    const meta  = quoteJson?.chart?.result?.[0]?.meta ?? {};
    const quote = {
      c:  meta.regularMarketPrice ?? 0,
      pc: meta.previousClose ?? meta.chartPreviousClose ?? 0,
      o:  meta.regularMarketOpen ?? 0,
      h:  meta.regularMarketDayHigh ?? 0,
      l:  meta.regularMarketDayLow ?? 0,
      d:  (meta.regularMarketPrice ?? 0) - (meta.previousClose ?? meta.chartPreviousClose ?? 0),
      dp: meta.previousClose ? (((meta.regularMarketPrice ?? 0) - meta.previousClose) / meta.previousClose) * 100 : 0,
    };

    const result     = chartJson?.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const ohlc       = result?.indicators?.quote?.[0] ?? {};

    const chartData = timestamps
      .map((t, i) => ({ time: new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }), price: ohlc.close?.[i] }))
      .filter(p => p.price != null);

    const candleData = timestamps
      .map((t, i) => ({ time: t, open: ohlc.open?.[i], high: ohlc.high?.[i], low: ohlc.low?.[i], close: ohlc.close?.[i] }))
      .filter(c => c.open != null && c.close != null);

    res.json({ quote, chartData, candleData });
  } catch (err) {
    console.error("[stock]", err);
    res.status(500).json({ error: "Failed to fetch stock data" });
  }
});

// ── Options proxy (NSE) ───────────────────────────────────────────────────────
const NSE_SYMBOL_MAP = {
  "NSE:RELIANCE":   "RELIANCE",
  "NSE:TCS":        "TCS",
  "NSE:INFY":       "INFY",
  "NSE:HDFCBANK":   "HDFCBANK",
  "NSE:ICICIBANK":  "ICICIBANK",
  "NSE:WIPRO":      "WIPRO",
  "NSE:SBIN":       "SBIN",
  "NSE:BAJFINANCE": "BAJFINANCE",
  "NSE:HINDUNILVR": "HINDUNILVR",
  "NSE:TATAMOTORS": "TATAMOTORS",
};

const BROWSER_HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.5",
  "Connection":      "keep-alive",
};

let cachedCookies = "";
let cookieExpiry  = 0;
const dataCache   = {};

function fetchNSE(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function getNSECookies() {
  if (cachedCookies && Date.now() < cookieExpiry) return cachedCookies;
  const r = await fetchNSE("https://www.nseindia.com", { ...BROWSER_HEADERS, "Accept": "text/html,application/xhtml+xml,*/*", "Upgrade-Insecure-Requests": "1" });
  const setCookie = r.headers["set-cookie"] ?? [];
  cachedCookies = setCookie.map(c => c.split(";")[0]).filter(Boolean).join("; ");
  cookieExpiry  = Date.now() + 5 * 60 * 1000;
  return cachedCookies;
}

function mapRow(r) {
  const strike = r.strikePrice;
  const expiry = r.expiryDate;
  const expTs  = Math.floor(new Date(expiry).getTime() / 1000);
  function mapSide(c, type) {
    if (!c) return null;
    return {
      contractSymbol:    `${c.underlying ?? ""}-${expiry}-${strike}-${type}`,
      strike, expiration: expTs,
      lastPrice:         c.lastPrice         ?? 0,
      bid:               c.bidprice          ?? 0,
      ask:               c.askPrice          ?? 0,
      change:            c.change            ?? 0,
      percentChange:     c.pChange           ?? 0,
      volume:            c.totalTradedVolume ?? 0,
      openInterest:      c.openInterest      ?? 0,
      impliedVolatility: c.impliedVolatility ? c.impliedVolatility / 100 : 0,
      inTheMoney:        c.inTheMoney === "True",
    };
  }
  return { ce: mapSide(r.CE, "CE"), pe: mapSide(r.PE, "PE") };
}

app.get("/api/options", async (req, res) => {
  const { symbol, expiry: expiryParam } = req.query;
  if (!symbol) return res.status(400).json({ error: "No symbol" });
  const nseSymbol = NSE_SYMBOL_MAP[symbol];
  if (!nseSymbol) return res.status(400).json({ error: "Symbol not supported" });

  const cacheKey = `${symbol}:${expiryParam ?? "default"}`;

  try {
    const cookies = await getNSECookies();
    const r = await fetchNSE(
      `https://www.nseindia.com/api/option-chain-equities?symbol=${nseSymbol}`,
      { ...BROWSER_HEADERS, "Accept": "application/json, text/plain, */*", "Referer": "https://www.nseindia.com/option-chain", "X-Requested-With": "XMLHttpRequest", "Cookie": cookies }
    );

    if (r.status !== 200) {
      cachedCookies = ""; cookieExpiry = 0;
      throw new Error(`NSE returned ${r.status}`);
    }

    const json = JSON.parse(r.body);
    if (!json?.records?.data?.length) {
      const cached = dataCache[cacheKey];
      if (cached) return res.json({ ...cached.data, marketClosed: true });
      return res.json({ calls: [], puts: [], expiryDates: [], underlyingPrice: 0, marketClosed: true });
    }

    const records         = json.records;
    const underlyingPrice = records.underlyingValue ?? 0;
    const expiryDates     = records.expiryDates     ?? [];
    const targetExpiry    = expiryParam ?? expiryDates[0];
    const filtered        = records.data.filter(r => r.expiryDate === targetExpiry);

    const calls = [], puts = [];
    for (const row of filtered) {
      const { ce, pe } = mapRow(row);
      if (ce) calls.push(ce);
      if (pe) puts.push(pe);
    }

    const result = { underlyingPrice, expiryDates, calls, puts, marketClosed: false };
    dataCache[cacheKey] = { data: result, ts: Date.now() };
    res.json(result);
  } catch (err) {
    console.error("[options]", err);
    cachedCookies = ""; cookieExpiry = 0;
    const cached = dataCache[cacheKey];
    if (cached) return res.json({ ...cached.data, marketClosed: true });
    res.json({ calls: [], puts: [], expiryDates: [], underlyingPrice: 0, marketClosed: true });
  }
});

app.listen(PORT, () => console.log(`StockPulse server running on http://localhost:${PORT}`));
