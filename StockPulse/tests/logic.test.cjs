const { test } = require("node:test");
const assert = require("node:assert/strict");
const { applyTrade, TradeError } = require("../lib/trading.ts");
const {
  practiceExpiry,
  practiceContract,
  optionPremium,
} = require("../lib/simulated-options.ts");
const {
  signSession,
  verifySession,
  requestSession,
  hashOtp,
} = require("../lib/session.ts");
process.env.SESSION_SECRET =
  "test-only-secret-that-is-longer-than-32-characters";
process.env.ADMIN_PASSWORD = "test-admin";
const user = () => ({
  name: "Test",
  email: "test@example.invalid",
  eTokens: 10000,
  portfolio: [],
  options: [],
});
const order = {
  action: "buy",
  tradeType: "equity",
  symbol: "NSE:TEST",
  quantity: 10,
  price: 100,
};
const timestamp = "2026-10-21T10:00:00Z";
test("equity buys and partial sales preserve balances and weighted cost basis", () => {
  let account = applyTrade(user(), order, "a", timestamp);
  account = applyTrade(
    account,
    { ...order, quantity: 5, price: 200 },
    "b",
    timestamp,
  );
  assert.equal(account.eTokens, 8000);
  assert.equal(account.portfolio[0].amount, 15);
  assert.equal(account.portfolio[0].avgBuyPrice, 2000 / 15);
  account = applyTrade(
    account,
    { ...order, action: "sell", quantity: 3, price: 150 },
    "c",
    timestamp,
  );
  assert.equal(account.eTokens, 8450);
  assert.equal(account.portfolio[0].amount, 12);
  assert.equal(account.portfolio[0].avgBuyPrice, 2000 / 15);
});
test("invalid quantities and prices cannot create credits or corrupt holdings", () => {
  for (const quantity of [0, -1, NaN, Infinity, "2", 0.5, Number.MAX_VALUE])
    assert.throws(
      () => applyTrade(user(), { ...order, quantity }, "a", timestamp),
      TradeError,
    );
  for (const price of [0, -1, NaN, Infinity, "100"])
    assert.throws(
      () => applyTrade(user(), { ...order, price }, "a", timestamp),
      TradeError,
    );
  assert.throws(
    () => applyTrade(user(), { ...order, quantity: 1000 }, "a", timestamp),
    /Insufficient/,
  );
  assert.throws(
    () => applyTrade(user(), { ...order, action: "sell" }, "a", timestamp),
    /Insufficient/,
  );
});
test("trade calculations do not mutate the caller account", () => {
  const account = user();
  account.portfolio = [
    { symbol: "NSE:TEST", amount: 2, avgBuyPrice: 50, sl: 40, tp: 200 },
  ];
  const snapshot = JSON.stringify(account);
  const result = applyTrade(account, order, "a", timestamp);
  assert.equal(JSON.stringify(account), snapshot);
  assert.equal(result.portfolio[0].sl, 40);
});
const expiration = practiceExpiry(Date.parse(timestamp));
const contract = {
  contractSymbol: practiceContract("NSE:TEST", 100, "call", expiration),
  underlyingSymbol: "NSE:TEST",
  type: "call",
  strike: 100,
  expiration,
};
const optionOrder = {
  action: "buy",
  tradeType: "option",
  symbol: "NSE:TEST",
  quantity: 2,
  price: 10,
  contract,
};
test("repeated option buys aggregate units and use a weighted entry premium", () => {
  let account = applyTrade(user(), optionOrder, "a", timestamp);
  account = applyTrade(
    account,
    { ...optionOrder, quantity: 3, price: 20 },
    "b",
    timestamp,
  );
  assert.equal(account.options.length, 1);
  assert.equal(account.options[0].lots, 5);
  assert.equal(account.options[0].premium, 16);
  assert.equal(account.eTokens, 9920);
});
test("legacy duplicate option positions sell FIFO or by exact position id", () => {
  const account = user();
  account.options = [
    { id: "a", ...contract, lots: 2, premium: 10, side: "buy", timestamp },
    { id: "b", ...contract, lots: 3, premium: 15, side: "buy", timestamp },
  ];
  const fifo = applyTrade(
    account,
    { ...optionOrder, action: "sell", quantity: 4, price: 20 },
    "c",
    timestamp,
  );
  assert.equal(fifo.options.length, 1);
  assert.equal(fifo.options[0].id, "b");
  assert.equal(fifo.options[0].lots, 1);
  const exact = applyTrade(
    account,
    { ...optionOrder, action: "sell", quantity: 3, positionId: "b" },
    "c",
    timestamp,
  );
  assert.equal(exact.options.length, 1);
  assert.equal(exact.options[0].id, "a");
  assert.throws(
    () =>
      applyTrade(
        account,
        { ...optionOrder, action: "sell", quantity: 3, positionId: "a" },
        "c",
        timestamp,
      ),
    /Insufficient/,
  );
});
test("different option expiry cannot be sold as a currently held contract", () => {
  const account = applyTrade(user(), optionOrder, "a", timestamp);
  assert.throws(
    () =>
      applyTrade(
        account,
        {
          ...optionOrder,
          action: "sell",
          contract: { ...contract, expiration: expiration + 604800 },
        },
        "c",
        timestamp,
      ),
    /Insufficient/,
  );
});
test("practice expiry rolls at exactly 15:30 IST and premium remains positive", () => {
  const before = Date.parse("2026-10-22T09:59:59Z"),
    at = Date.parse("2026-10-22T10:00:00Z");
  assert.equal(practiceExpiry(at) - practiceExpiry(before), 604800);
  assert.ok(
    optionPremium(100, 100, "call", practiceExpiry(before), before) > 0,
  );
});
test("signed sessions reject tampering, expiry and the wrong role", () => {
  const now = Date.parse(timestamp),
    token = signSession("user", "test@example.invalid", now);
  assert.equal(verifySession(token, "user", now).email, "test@example.invalid");
  assert.equal(verifySession(token + "x", "user", now), null);
  assert.equal(verifySession(token, "admin", now), null);
  assert.equal(verifySession(token, "user", now + 8 * 3600000), null);
  const payload = Buffer.from(
    JSON.stringify({
      role: "user",
      email: "other@example.invalid",
      exp: 9999999999,
    }),
  ).toString("base64url");
  assert.equal(
    verifySession(payload + "." + token.split(".")[1], "user", now),
    null,
  );
  assert.equal(
    requestSession(
      new Request("http://localhost", {
        headers: {
          cookie:
            "stockpulse_user=" + signSession("user", "test@example.invalid"),
        },
      }),
    ).email,
    "test@example.invalid",
  );
});
test("OTP hashes are bound to both account and code", () => {
  assert.notEqual(
    hashOtp("a@example.invalid", "123456"),
    hashOtp("b@example.invalid", "123456"),
  );
  assert.notEqual(
    hashOtp("a@example.invalid", "123456"),
    hashOtp("a@example.invalid", "123457"),
  );
});
