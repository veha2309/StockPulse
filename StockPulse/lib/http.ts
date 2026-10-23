const pendingOrders = new Map<string, string>();
export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  // Keep the same id across a failed/unknown response so retrying an order
  // cannot debit the account twice. A confirmed success starts a new order.
  const key =
    url === "/api/trade" ? `stockpulse:pending:${JSON.stringify(body)}` : null;
  let orderId: string | null = null;
  if (key) {
    orderId = pendingOrders.get(key) || null;
    try {
      orderId ||= sessionStorage.getItem(key);
    } catch {
      /* Storage can be disabled. */
    }
    orderId ||= crypto.randomUUID();
    pendingOrders.set(key, orderId);
    try {
      sessionStorage.setItem(key, orderId);
    } catch {
      /* In-memory retries still retain the id. */
    }
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      orderId ? { ...(body as Record<string, unknown>), orderId } : body,
    ),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Request failed. Please try again.");
  if (key) {
    pendingOrders.delete(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Optional persistence. */
    }
  }
  return data as T;
}
