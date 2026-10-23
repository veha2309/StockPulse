const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { signSession } = require("../lib/session.ts");
const key = "isolated-route-test-secret-more-than-32-characters";
process.env.SESSION_SECRET = key;
const base = "http://localhost:3199";
let server;
let logs = "";
before(async () => {
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", "3199"],
    {
      windowsHide: true,
      env: {
        ...process.env,
        SESSION_SECRET: key,
        SUPABASE_SERVICE_ROLE_KEY: "invalid-key-for-isolated-negative-tests",
      },
    },
  );
  server.stdout.on("data", (b) => (logs += b));
  server.stderr.on("data", (b) => (logs += b));
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(base);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Test server failed to start: " + logs);
});
after(() => server?.kill());
const userCookie = () =>
  `stockpulse_user=${signSession("user", "test@example.invalid")}`;
async function post(path, body, headers = {}) {
  return fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
test("private GET APIs reject email-only identity", async () => {
  for (const path of [
    "/api/auth?email=other@example.invalid",
    "/api/history?email=other@example.invalid",
    "/api/admin/users",
    "/api/admin/stats",
    "/api/admin/trades",
    "/api/admin/recharge",
  ])
    assert.equal((await fetch(base + path)).status, 401, path);
});
test("all admin mutations require a real admin cookie", async () => {
  for (const [path, method] of [
    ["user", "DELETE"],
    ["trades", "DELETE"],
    ["favorites", "POST"],
    ["learnings", "POST"],
    ["airdrop", "POST"],
    ["user/reset-tokens", "POST"],
    ["recharge", "PATCH"],
  ])
    assert.equal(
      (
        await fetch(base + "/api/admin/" + path, {
          method,
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      401,
      path,
    );
});
test("forged local storage equivalents and cookies do not grant access", async () => {
  assert.equal(
    (
      await fetch(base + "/api/admin/users", {
        headers: { cookie: "admin_authed=1; stockpulse_admin=forged" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(base + "/api/history", {
        headers: {
          cookie: "session_email=test@example.invalid; stockpulse_user=forged",
        },
      })
    ).status,
    401,
  );
});
test("cross-origin mutations are rejected even with a valid cookie", async () => {
  assert.equal(
    (
      await post(
        "/api/trade",
        {},
        { cookie: userCookie(), origin: "https://attacker.example" },
      )
    ).status,
    403,
  );
});
test("signed user cannot trade or edit targets for another email", async () => {
  for (const path of ["/api/trade", "/api/targets"])
    assert.equal(
      (
        await post(
          path,
          { email: "other@example.invalid" },
          { cookie: userCookie() },
        )
      ).status,
      403,
      path,
    );
});
test("invalid quantity types and nonexistent trade types are rejected before provider calls", async () => {
  for (const amount of [0, -1, 0.5, "10", null])
    assert.equal(
      (
        await post(
          "/api/trade",
          { action: "buy", symbol: "NSE:TEST", amount },
          { cookie: userCookie() },
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await post(
        "/api/trade",
        { action: "buy", symbol: "NSE:TEST", amount: 1, tradeType: "unknown" },
        { cookie: userCookie() },
      )
    ).status,
    400,
  );
});
test("index share buys and inverted targets cannot reach persistence", async () => {
  assert.equal(
    (
      await post(
        "/api/trade",
        { action: "buy", symbol: "NSE:NIFTY_50", amount: 1 },
        { cookie: userCookie() },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/api/targets",
        { symbol: "NSE:TEST", sl: 200, tp: 100 },
        { cookie: userCookie() },
      )
    ).status,
    400,
  );
});
test("registration bypass and malformed registration data are rejected", async () => {
  assert.equal(
    (
      await post("/api/auth", {
        action: "register",
        email: "new@example.invalid",
        password: "whatever",
      })
    ).status,
    400,
  );
  assert.equal(
    (await post("/api/auth/verify-otp", { email: "bad", otp: "123456" }))
      .status,
    400,
  );
});
test("upstream URLs reject invalid symbols and OAuth rejects missing state", async () => {
  for (const path of [
    "/api/stock?symbol=https://attacker.example",
    "/api/options?symbol=bad",
    "/api/quotes?symbols=bad",
  ])
    assert.equal((await fetch(base + path)).status, 400, path);
  assert.equal(
    (await fetch(base + "/api/upstox/callback?code=bogus")).status,
    403,
  );
});
test("recharge rejects negative or string amounts before touching the database", async () => {
  for (const requestedAmount of [-10000, "10000", Infinity])
    assert.equal(
      (
        await post(
          "/api/recharge",
          { requestedAmount },
          { cookie: userCookie() },
        )
      ).status,
      400,
    );
});
