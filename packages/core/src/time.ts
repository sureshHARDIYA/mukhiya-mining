/** Parse a timestamp to epoch milliseconds. Throws on an unparsable value. */
export function toMillis(value: string | Date | number, context: string): number {
  if (typeof value === "number") return value;
  const ms = value instanceof Date ? value.getTime() : Date.parse(normaliseIso(value));
  if (Number.isNaN(ms)) throw new Error(`Invalid timestamp "${String(value)}" (${context})`);
  return ms;
}

/** Accepts "2026-01-05 10:00:00" style strings that Date.parse rejects in some engines. */
function normaliseIso(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)) return trimmed.replace(" ", "T");
  return trimmed;
}
