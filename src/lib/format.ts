export function formatMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 10) return `${ms.toFixed(1)} ms`;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}

export function formatDistance(distance: number): string {
  return distance.toFixed(3);
}

export function formatTokens(count: number | null | undefined): string {
  return count == null ? "—" : new Intl.NumberFormat("en-US").format(count);
}

export function formatUsd(amount: number | null | undefined): string {
  if (amount == null) return "—";
  if (amount === 0) return "$0";
  if (amount < 0.0001) return "<$0.0001";
  return `$${amount < 0.01 ? amount.toFixed(4) : amount.toFixed(3)}`;
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** Amounts arrive in major units (rupees), exactly as the order service stores them. */
export function formatAmount(amount: number, currency = "INR"): string {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    moneyFormatters.set(currency, formatter);
  }
  return formatter.format(amount);
}

const clockFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function formatClock(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? "—" : clockFormatter.format(date);
}

const dayFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function formatRelativeDay(isoString: string, now: Date = new Date()): string {
  const date = new Date(isoString);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = date.getTime();
  if (time >= startOfToday) return "Today";
  if (time >= startOfToday - 86_400_000) return "Yesterday";
  return dayFormatter.format(date);
}

/** Convert a code-point offset (the contract's unit) to a JavaScript string index. */
export function codePointOffsetToIndex(text: string, codePoints: number): number {
  let index = 0;
  let seen = 0;
  for (const character of text) {
    if (seen >= codePoints) break;
    index += character.length;
    seen += 1;
  }
  return index;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
