// This is a practice model, not an exchange option feed or lot-size calendar.
export function practiceExpiry(now = Date.now()) {
  const shifted = new Date(now + 330 * 60_000);
  let days = (4 - shifted.getUTCDay() + 7) % 7;
  if (!days && shifted.getUTCHours() * 60 + shifted.getUTCMinutes() >= 930)
    days = 7;
  return Math.floor(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() + days,
      10,
    ) / 1000,
  );
}
export function expiryLabel(expiration: number) {
  return new Date(expiration * 1000)
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    })
    .replace(/ /g, "-");
}
export function optionPremium(
  spot: number,
  strike: number,
  type: "call" | "put",
  expiration: number,
  now = Date.now(),
) {
  const intrinsic =
    type === "call" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  const days = Math.max(0, (expiration * 1000 - now) / 86400000);
  const timeValue =
    spot *
    0.02 *
    Math.sqrt(days / 7) *
    Math.exp((-Math.abs(spot - strike) / spot) * 20);
  return Math.max(0.01, Math.round((intrinsic + timeValue) * 100) / 100);
}
export function practiceContract(
  symbol: string,
  strike: number,
  type: "call" | "put",
  expiration: number,
) {
  return `${symbol.slice(4)}-${expiryLabel(expiration)}-${strike}-${type === "call" ? "CE" : "PE"}`;
}
