const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
let db;
before(async () => {
  db = new PGlite();
  await db.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;",
  );
  await db.exec(fs.readFileSync("schema.sql", "utf8"));
  await db.exec(fs.readFileSync("db/logic-safety.sql", "utf8"));
  await db.exec(
    "INSERT INTO users(email,name,password) VALUES('test@example.invalid','Test','hash');",
  );
});
after(async () => {
  await db?.close();
});
async function account() {
  return (
    await db.query("SELECT * FROM users WHERE email='test@example.invalid'")
  ).rows[0];
}
async function reset() {
  await db.exec(
    "UPDATE users SET etokens=10000,e_tokens=10000,portfolio='[]',options='[]'; DELETE FROM trades; DELETE FROM option_trades; DELETE FROM recharge_requests;",
  );
}
async function commit(id, expected, state) {
  return db.query("SELECT stockpulse_commit_trade($1,$2,$3,$4,$5) AS result", [
    "test@example.invalid",
    expected,
    state,
    "equity",
    {
      _id: id,
      action: "buy",
      symbol: "NSE:TEST",
      amount: 10,
      price: 100,
      total: 1000,
      timestamp: "2026-10-21T10:00:00Z",
    },
  ]);
}
const expected = { balance: 10000, portfolio: [], options: [] };
const state = {
  eTokens: 9000,
  portfolio: [{ symbol: "NSE:TEST", amount: 10, avgBuyPrice: 100 }],
  options: [],
};
test("SQL migration compiles and can be reapplied", async () => {
  await db.exec(fs.readFileSync("db/logic-safety.sql", "utf8"));
});
test("balance, holdings and history commit together", async () => {
  await reset();
  await commit("first", expected, state);
  assert.equal(Number((await account()).etokens), 9000);
  assert.equal((await db.query("SELECT * FROM trades")).rows.length, 1);
});
test("stale concurrent order snapshot is rejected instead of overwriting state", async () => {
  await reset();
  const results = await Promise.allSettled([
    commit("one", expected, state),
    commit("two", expected, state),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(
    results.find((r) => r.status === "rejected").reason.message,
    /CONFLICT/,
  );
  assert.equal(Number((await account()).etokens), 9000);
  assert.equal((await db.query("SELECT * FROM trades")).rows.length, 1);
});
test("history insert failure rolls back the balance and portfolio update", async () => {
  await reset();
  await db.exec(
    "CREATE FUNCTION reject_test_trade() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'HISTORY_INSERT_FAILED'; END $$; CREATE TRIGGER reject_test_trade BEFORE INSERT ON trades FOR EACH ROW EXECUTE FUNCTION reject_test_trade();",
  );
  try {
    await assert.rejects(
      commit("failed", expected, state),
      /HISTORY_INSERT_FAILED/,
    );
  } finally {
    await db.exec(
      "DROP TRIGGER reject_test_trade ON trades; DROP FUNCTION reject_test_trade();",
    );
  }
  assert.equal(Number((await account()).etokens), 10000);
  assert.equal((await account()).portfolio.length, 0);
});

test("retrying the same order id does not debit twice", async () => {
  await reset();
  await commit("retry", expected, state);
  await commit("retry", expected, state);
  assert.equal(Number((await account()).etokens), 9000);
  assert.equal((await db.query("SELECT * FROM trades")).rows.length, 1);
});
test("target updates retain balance and reject inverted thresholds", async () => {
  await reset();
  await commit("targets", expected, state);
  await db.query("SELECT stockpulse_set_targets($1,$2,$3,$4)", [
    "test@example.invalid",
    "NSE:TEST",
    90,
    120,
  ]);
  assert.equal((await account()).portfolio[0].sl, 90);
  assert.equal(Number((await account()).etokens), 9000);
  await assert.rejects(
    db.query("SELECT stockpulse_set_targets($1,$2,$3,$4)", [
      "test@example.invalid",
      "NSE:TEST",
      150,
      100,
    ]),
    /INVALID_TARGETS/,
  );
});
test("recharge approval credits exactly once", async () => {
  await reset();
  const id = (
    await db.query(
      "INSERT INTO recharge_requests(user_email,requested_amount) VALUES('test@example.invalid',10000) RETURNING id",
    )
  ).rows[0].id;
  await db.query("SELECT stockpulse_resolve_recharge($1,$2,$3)", [
    id,
    "approved",
    null,
  ]);
  await assert.rejects(
    db.query("SELECT stockpulse_resolve_recharge($1,$2,$3)", [
      id,
      "approved",
      null,
    ]),
    /ALREADY_RESOLVED/,
  );
  assert.equal(Number((await account()).etokens), 20000);
});
test("missing-user recharge approval rolls back request status", async () => {
  const id = (
    await db.query(
      "INSERT INTO recharge_requests(user_email,requested_amount) VALUES('missing@example.invalid',10000) RETURNING id",
    )
  ).rows[0].id;
  await assert.rejects(
    db.query("SELECT stockpulse_resolve_recharge($1,$2,$3)", [
      id,
      "approved",
      null,
    ]),
    /USER_NOT_FOUND/,
  );
  assert.equal(
    (await db.query("SELECT status FROM recharge_requests WHERE id=$1", [id]))
      .rows[0].status,
    "pending",
  );
});
test("airdrop increments current balances atomically", async () => {
  await reset();
  await commit("airdrop", expected, state);
  await db.query("SELECT stockpulse_airdrop($1)", [1000]);
  assert.equal(Number((await account()).etokens), 10000);
});
test("database rate limits persist across calls", async () => {
  const call = () =>
    db.query("SELECT stockpulse_rate_limit($1,$2,$3) AS allowed", [
      "test",
      2,
      600,
    ]);
  assert.equal((await call()).rows[0].allowed, true);
  assert.equal((await call()).rows[0].allowed, true);
  assert.equal((await call()).rows[0].allowed, false);
});
test("anonymous role cannot read accounts, OTPs, broker tokens or execute privileged functions", async () => {
  await db.exec("SET ROLE anon");
  try {
    for (const table of [
      "users",
      "email_otps",
      "app_config",
      "recharge_requests",
    ])
      await assert.rejects(
        db.query("SELECT * FROM " + table),
        /permission denied/,
      );
    await assert.rejects(
      db.query("SELECT stockpulse_airdrop(1000)"),
      /permission denied/,
    );
  } finally {
    await db.exec("RESET ROLE");
  }
});
test("registration consumes OTP and creates account in one transaction", async () => {
  await db.query(
    "INSERT INTO email_otps(email,otp,expires_at) VALUES($1,$2,now()+interval '10 minutes')",
    ["new@example.invalid", "otp-hash"],
  );
  await db.query("SELECT stockpulse_register($1,$2,$3,$4)", [
    "new@example.invalid",
    "New",
    "password-hash",
    "otp-hash",
  ]);
  assert.equal(
    (
      await db.query(
        "SELECT * FROM email_otps WHERE email='new@example.invalid'",
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    db.query("SELECT stockpulse_register($1,$2,$3,$4)", [
      "new@example.invalid",
      "New",
      "password-hash",
      "otp-hash",
    ]),
    /INVALID_OTP/,
  );
});

test("admin totals and per-user trade counts include more than the API row limit", async () => {
  await reset();
  await db.exec(
    "INSERT INTO trades(_id,email,action,symbol,amount,price,total,timestamp) SELECT 'bulk-'||n,'test@example.invalid','buy','NSE:TEST',1,1,1,'2026-10-21T10:00:00Z' FROM generate_series(1,1100) n;",
  );
  const stats = (await db.query("SELECT stockpulse_admin_stats() AS stats"))
    .rows[0].stats;
  assert.equal(stats.totalTrades, 1100);
  assert.equal(stats.totalVolume, 1100);
  const users = (await db.query("SELECT stockpulse_admin_users() AS users"))
    .rows[0].users;
  assert.equal(
    users.find((u) => u.email === "test@example.invalid").tradeCount,
    1100,
  );
});
