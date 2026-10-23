# Logic audit and rollout

The application is a **virtual trading practice app**. The following fixes are implemented in the workspace. They have not been deployed, and the production Supabase database has not been modified.

## Required before using the updated application

1. Run **db/logic-safety.sql** in the Supabase SQL editor for this project. It assumes the existing users, trades, option_trades, email_otps, and app_config tables from schema.sql. It creates the recharge table if missing.
2. Deploy/restart the updated app together with the migration. The new routes intentionally return a service-unavailable response if the required database functions are missing.
3. Configure a private SESSION_SECRET containing at least 32 random characters. The existing server-only SUPABASE_SERVICE_ROLE_KEY is a supported fallback. Never expose either key through NEXT_PUBLIC variables. ADMIN_PASSWORD must also be configured.
4. Sign in again. A stored email or cached user object no longer authenticates a session. This deliberately invalidates the old localStorage/sessionStorage login mechanism.

The migration adds service-role-only transactional functions and denies anonymous/authenticated direct table access. Existing account records are retained. Any separate mobile client must use the authenticated API/session-cookie flow; old email-only calls and anonymous direct table subscriptions are intentionally rejected. Take a database backup and coordinate this access change when rolling out to other clients.

## Findings addressed

| Severity | Finding | Fix |
| --- | --- | --- |
| Critical | Private user APIs trusted a supplied email, and multiple admin APIs had no server authorization | Signed HttpOnly, SameSite session cookies; route-level admin guards plus API proxy protection; user identity comes from the verified session; cross-site mutations rejected |
| Critical | Installed Next.js had reported security vulnerabilities, including Windows-hosted RCE advisories | Next.js and matching ESLint config updated to 16.4.2; Nodemailer updated to 10.1.7; compatible dependency patches applied |
| High | Read-modify-write trades could lose updates, overspend, or mutate holdings without inserting history | Row lock + optimistic snapshot check + balance/positions/history in one PostgreSQL transaction; bounded retry on conflicts |
| High | An uncertain network response could lead to duplicate order submission | Stable order ids across retries, existing-receipt lookup, and database idempotency |
| High | Client-supplied execution prices and negative/non-numeric values were trusted | Fresh server-side provider quotes; finite positive prices, positive whole quantities, safe totals; indices cannot be bought as equity shares |
| High | Recharge approvals and airdrops could race or report success before crediting funds | Row-locked recharge resolution and atomic increments; repeat approvals rejected; failure rolls back request status |
| High | Registration API bypassed OTP; codes used Math.random and were stored as plaintext | Removed registration bypass; cryptographic codes, account-bound HMAC storage, database rate limits, atomic OTP consumption and account creation |
| High | Dashboard synthesized random ticks, generated missing candles, and advertised an unfinished WebSocket feed | Provider-only quote polling, bounded fetches, no invented ticks/candles; unfinished stream is explicitly reported as polling |
| High | Options contained fabricated volume/open interest/volatility and were presented as live exchange data | Explicit practice model; unavailable market metrics are zero/unknown; deterministic server-priced units, not exchange lot sizes or exchange expiry rules |
| High | Option sales could use a different expiry or an entry-price fallback; duplicate positions were handled incorrectly | Exact contract quote requests; no entry-price execution fallback; weighted aggregate entries, FIFO legacy sales, explicit position-id sales |
| Medium | Overlapping searches and asset fetches could overwrite a newer selection | Debounced cancellation, abort signals, active-effect checks, keyed option state, and account-update revision checks |
| Medium | Several forms remained loading after failed requests or closed dialogs after rejected changes | Shared throwing JSON helper, try/catch/finally, HTTP status checks, and visible errors |
| Medium | Admin statistics could truncate totals at PostgREST's row limit | SQL aggregates over all records and per-user trade counts |
| Medium | OAuth callback did not validate state or check token storage failure | Random state cookie, admin-session validation, bounded token exchange, checked database writes, and state clearing |

The OAuth parameters/state checks follow the [official Upstox authentication guidance](https://upstox.com/developer/api-documentation/authorize/).

## Validation

- `npm test`: 22 passing accounting/session and isolated PostgreSQL tests, using synthetic records only.
- `npm run test:api`: 10 passing HTTP authorization and validation tests against the final built server. The test server uses invalid database credentials; these tests cannot modify live data.
- `npx tsc --noEmit` and production webpack build.
- Focused ESLint over API routes, server action, new helpers, proxy, and tests.
- `npm audit --omit=dev`: zero reported production dependency advisories after the patches.
- Full dependency audit still reports five high findings in the ESLint -> fast-glob -> micromatch -> braces development chain. The available automated proposal downgrades eslint-config-next to Next 14; it was not applied.

## Remaining limits

- This is not a live brokerage execution system. Prices are last provider quotes and may be delayed or reflect a closed session. The practice option model is not a real exchange options feed; one stored unit has no exchange lot-size multiplier.
- There is no expired-option settlement engine. Expired contracts are rejected rather than sold at a fabricated current or entry premium. Existing expired positions require a defined settlement policy and reliable expiry-day data before crediting funds.
- Stop-loss/take-profit checks run only while a holdings panel is mounted in an open workspace. They are not background exchange orders. The server re-checks targets against the execution quote and serializes account updates.
- Existing corrupted historical balances/positions were not automatically repaired. A live-data reconciliation needs a separate review before changing account records.
- Sessions expire after eight hours. User password changes do not currently revoke other already-issued user sessions immediately; deployment should rotate SESSION_SECRET if all sessions need to be invalidated.
- Login, SMTP delivery, paid AI generation, and Upstox authorization were not exercised using real credentials or live side effects. Set GEMINI_MODEL to a currently available model for the configured account. The insight response is quote-grounded and rate-limited, but provider availability remains external.
- API changes and the SQL migration must be rolled out together. Until the migration is applied, database-backed sign-in throttling, registration, transactions, targets, admin aggregates, and recharge approval remain unavailable.
