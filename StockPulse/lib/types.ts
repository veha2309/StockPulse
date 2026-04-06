export type ChartPoint  = { time: string; price: number };
export type CandlePoint = { time: number; open: number; high: number; low: number; close: number };
export type Quote       = { c: number; d: number; dp: number; h: number; l: number; o: number; pc: number } | null;
export type Screen      = "login" | "register" | "dashboard";
export type Company     = { name: string; symbol: string; sector: string };
export type ToastData   = { message: string; type: "success" | "error" };

export type PortfolioItem = {
  symbol:      string;
  amount:      number;
  avgBuyPrice: number;
  sl?:         number;
  tp?:         number;
};

export type TradeRecord = {
  _id:       string;
  action:    "buy" | "sell";
  symbol:    string;
  amount:    number;
  price:     number;
  total:     number;
  timestamp: string;
};

export type OptionTradeRecord = {
  _id:              string;
  action:           "buy" | "sell";
  contractSymbol:   string;
  underlyingSymbol: string;
  optionType:       "call" | "put";
  strike:           number;
  expiration:       number;
  lots:             number;
  premium:          number;
  total:            number;
  timestamp:        string;
};

export type OptionContract = {
  contractSymbol:    string;
  strike:            number;
  expiration:        number;
  lastPrice:         number;
  bid:               number;
  ask:               number;
  change:            number;
  percentChange:     number;
  volume:            number;
  openInterest:      number;
  impliedVolatility: number;
  inTheMoney:        boolean;
};

export type OptionPosition = {
  id:               string;
  contractSymbol:   string;
  underlyingSymbol: string;
  type:             "call" | "put";
  strike:           number;
  expiration:       number;
  lots:             number;
  premium:          number;
  side:             "buy" | "sell";
  timestamp:        string;
};

export type UserData = {
  name:       string;
  email:      string;
  branch:     string;
  enrollment: string;
  eTokens:    number;
  portfolio:  PortfolioItem[];
  options:    OptionPosition[];
};
