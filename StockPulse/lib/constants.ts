import type { Company } from "./types";

/** Default stock list shown in the sidebar before any search.
 *  Covers all Nifty 50 constituents + a few midcap favourites.
 *  Symbol format: NSE:<TICKER>  (auto-converted to <TICKER>.NS by the stock API).
 *  Index format:  NSE:NIFTY_50, BSE:SENSEX  (mapped to Yahoo ^NSEI, ^BSESN etc.)
 */
export const COMPANIES: Company[] = [
  // ── Indian Market Indices ──
  { name: "NIFTY 50",         symbol: "NSE:NIFTY_50",        sector: "Index" },
  { name: "NIFTY Bank",       symbol: "NSE:NIFTY_BANK",      sector: "Index" },
  { name: "NIFTY IT",         symbol: "NSE:NIFTY_IT",        sector: "Index" },
  { name: "NIFTY Midcap 50",  symbol: "NSE:NIFTY_MIDCAP_50", sector: "Index" },
  { name: "SENSEX",           symbol: "BSE:SENSEX",          sector: "Index" },

  // Nifty 50 — Financial Services
  { name: "HDFC Bank",         symbol: "NSE:HDFCBANK",    sector: "Finance" },
  { name: "ICICI Bank",        symbol: "NSE:ICICIBANK",   sector: "Finance" },
  { name: "SBI",               symbol: "NSE:SBIN",        sector: "Finance" },
  { name: "Kotak Mahindra",    symbol: "NSE:KOTAKBANK",   sector: "Finance" },
  { name: "Axis Bank",         symbol: "NSE:AXISBANK",    sector: "Finance" },
  { name: "Bajaj Finance",     symbol: "NSE:BAJFINANCE",  sector: "Finance" },
  { name: "Bajaj Finserv",     symbol: "NSE:BAJAJFINSV",  sector: "Finance" },
  { name: "Shriram Finance",   symbol: "NSE:SHRIRAMFIN",  sector: "Finance" },

  // IT & Technology
  { name: "TCS",               symbol: "NSE:TCS",         sector: "Technology" },
  { name: "Infosys",           symbol: "NSE:INFY",        sector: "Technology" },
  { name: "Wipro",             symbol: "NSE:WIPRO",       sector: "Technology" },
  { name: "HCL Technologies",  symbol: "NSE:HCLTECH",     sector: "Technology" },
  { name: "Tech Mahindra",     symbol: "NSE:TECHM",       sector: "Technology" },

  // Energy & Oil
  { name: "Reliance",          symbol: "NSE:RELIANCE",    sector: "Energy" },
  { name: "ONGC",              symbol: "NSE:ONGC",        sector: "Energy" },
  { name: "Power Grid",        symbol: "NSE:POWERGRID",   sector: "Energy" },
  { name: "NTPC",              symbol: "NSE:NTPC",        sector: "Energy" },
  { name: "Adani Green",       symbol: "NSE:ADANIGREEN",  sector: "Energy" },
  { name: "Adani Ports",       symbol: "NSE:ADANIPORTS",  sector: "Infrastructure" },
  { name: "Adani Enterprises", symbol: "NSE:ADANIENT",    sector: "Infrastructure" },

  // Consumer & FMCG
  { name: "HUL",               symbol: "NSE:HINDUNILVR",  sector: "Consumer" },
  { name: "ITC",               symbol: "NSE:ITC",         sector: "Consumer" },
  { name: "Nestle India",      symbol: "NSE:NESTLEIND",   sector: "Consumer" },
  { name: "Titan Company",     symbol: "NSE:TITAN",       sector: "Consumer" },
  { name: "Asian Paints",      symbol: "NSE:ASIANPAINT",  sector: "Consumer" },
  { name: "Britannia",         symbol: "NSE:BRITANNIA",   sector: "Consumer" },

  // Automotive
  { name: "Tata Motors",       symbol: "NSE:TATAMOTORS",  sector: "Automotive" },
  { name: "Maruti Suzuki",     symbol: "NSE:MARUTI",      sector: "Automotive" },
  { name: "M&M",               symbol: "NSE:M&M",         sector: "Automotive" },
  { name: "Eicher Motors",     symbol: "NSE:EICHERMOT",   sector: "Automotive" },
  { name: "Hero MotoCorp",     symbol: "NSE:HEROMOTOCO",  sector: "Automotive" },
  { name: "Bajaj Auto",        symbol: "NSE:BAJAJ-AUTO",  sector: "Automotive" },

  // Pharma & Healthcare
  { name: "Sun Pharma",        symbol: "NSE:SUNPHARMA",   sector: "Healthcare" },
  { name: "Dr Reddy's",        symbol: "NSE:DRREDDY",     sector: "Healthcare" },
  { name: "Cipla",             symbol: "NSE:CIPLA",       sector: "Healthcare" },
  { name: "Divi's Labs",       symbol: "NSE:DIVISLAB",    sector: "Healthcare" },
  { name: "Apollo Hospitals",  symbol: "NSE:APOLLOHOSP",  sector: "Healthcare" },

  // Metals & Mining
  { name: "Tata Steel",        symbol: "NSE:TATASTEEL",   sector: "Metals" },
  { name: "JSW Steel",         symbol: "NSE:JSWSTEEL",    sector: "Metals" },
  { name: "Hindalco",          symbol: "NSE:HINDALCO",    sector: "Metals" },
  { name: "Coal India",        symbol: "NSE:COALINDIA",   sector: "Metals" },

  // Infrastructure & Cement
  { name: "Larsen & Toubro",   symbol: "NSE:LT",          sector: "Infrastructure" },
  { name: "UltraTech Cement",  symbol: "NSE:ULTRACEMCO",  sector: "Infrastructure" },
  { name: "Grasim",            symbol: "NSE:GRASIM",      sector: "Infrastructure" },

  // Telecom
  { name: "Bharti Airtel",     symbol: "NSE:BHARTIARTL",  sector: "Telecom" },

  // Others
  { name: "IndusInd Bank",     symbol: "NSE:INDUSINDBK",  sector: "Finance" },
  { name: "Tata Consumer",     symbol: "NSE:TATACONSUM",  sector: "Consumer" },

  // ── BSE Variants (Bombay Stock Exchange) ──
  { name: "HDFC Bank (BSE)",   symbol: "BSE:HDFCBANK",    sector: "Finance" },
  { name: "Reliance (BSE)",    symbol: "BSE:RELIANCE",    sector: "Energy" },
  { name: "TCS (BSE)",         symbol: "BSE:TCS",         sector: "Technology" },
  { name: "Infosys (BSE)",     symbol: "BSE:INFY",        sector: "Technology" },
  { name: "SBI (BSE)",         symbol: "BSE:SBIN",        sector: "Finance" },
];
