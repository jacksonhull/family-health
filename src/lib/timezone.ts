/**
 * Convert a datetime-local string ("YYYY-MM-DDTHH:MM") entered in a given
 * IANA timezone into a UTC Date for storage.
 *
 * Strategy: parse naively as UTC, measure how far off that is from the target
 * timezone's wall-clock, then shift by the difference.
 */
export function localToUtc(localStr: string, timezone: string): Date {
  // Parse as UTC first (naive)
  const naive = new Date(localStr + ":00.000Z");

  // Ask Intl what wall-clock time this UTC instant shows in the member's tz
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(naive);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  // hour can be "24" at midnight in some locales — normalise to "00"
  const hour = get("hour") === "24" ? "00" : get("hour");

  const shownAsUtc = new Date(
    `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:00.000Z`,
  );

  // The offset tells us how much to shift the naive parse to get true UTC
  const offsetMs = naive.getTime() - shownAsUtc.getTime();
  return new Date(naive.getTime() + offsetMs);
}

/**
 * Convert a UTC ISO string back to a "YYYY-MM-DDTHH:MM" string in the given
 * IANA timezone — the format expected by <input type="datetime-local">.
 */
export function utcToLocalInput(isoUtc: string, timezone: string): string {
  const date = new Date(isoUtc);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");

  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * Format a UTC Date for display in the given IANA timezone.
 */
export function formatInTz(
  date: Date,
  timezone: string,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...opts,
  }).format(date);
}
