const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Compact human duration: "instant", "42 s", "3 m 48 s", "2 h 10 m", "3 d 4 h", "2.3 wks". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "–";
  const abs = Math.abs(ms);
  if (abs < SECOND) return "instant";
  if (abs < MINUTE) return `${Math.round(abs / SECOND)} s`;
  if (abs < HOUR) return twoPart(abs, MINUTE, SECOND, "m", "s");
  if (abs < DAY) return twoPart(abs, HOUR, MINUTE, "h", "m");
  if (abs < 2 * WEEK) return twoPart(abs, DAY, HOUR, "d", "h");
  return `${(abs / WEEK).toFixed(1)} wks`;
}

function twoPart(
  ms: number,
  big: number,
  small: number,
  bigUnit: string,
  smallUnit: string,
): string {
  let bigCount = Math.floor(ms / big);
  let smallCount = Math.round((ms - bigCount * big) / small);
  if (smallCount * small >= big) {
    bigCount++;
    smallCount = 0;
  }
  return smallCount > 0
    ? `${bigCount} ${bigUnit} ${smallCount} ${smallUnit}`
    : `${bigCount} ${bigUnit}`;
}

export function formatPercent(share: number, digits = 1): string {
  const value = share * 100;
  const text = value.toFixed(value >= 10 || value === 0 ? digits : 2);
  return `${text.replace(/\.0+$/, "")}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

export function formatDateTime(ms: number): string {
  if (!Number.isFinite(ms)) return "–";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(ms);
}
