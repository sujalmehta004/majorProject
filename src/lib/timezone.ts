/**
 * Nepal Standard Time (NST) utilities — UTC+5:45
 *
 * PostgreSQL stores timestamps in UTC. These helpers ensure every
 * date displayed to the user or sent in APIs is formatted in Nepal time (+05:45)
 * regardless of the server or browser locale.
 */

const NPT_LOCALE = 'en-US';
const NPT_TZ = 'Asia/Kathmandu';
const NPT_OFFSET_MINUTES = 5 * 60 + 45; // +5:45 = 345 minutes

/**
 * Convert any Date or UTC string to Nepal Standard Time ISO string with +05:45 offset.
 * e.g. "2026-08-08T16:38:07.631Z" -> "2026-08-08T22:23:07.631+05:45"
 */
export function toNPTISOString(value?: string | Date | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);

  const nptDate = new Date(d.getTime() + NPT_OFFSET_MINUTES * 60 * 1000);
  const iso = nptDate.toISOString(); // e.g. "2026-08-08T22:23:07.631Z"
  return iso.replace('Z', '+05:45');
}

/**
 * Returns current Nepal time ISO string with +05:45 offset.
 */
export function nowNPTISOString(): string {
  return toNPTISOString(new Date());
}

/**
 * Format a date value as a short date string in Nepal time.
 * e.g. "Aug 8, 2026"
 */
export function formatDateNPT(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(NPT_LOCALE, {
      ...options,
      timeZone: NPT_TZ,
    });
  } catch {
    return String(value);
  }
}

/**
 * Format a date value as a time string in Nepal time.
 * e.g. "11:43 PM"
 */
export function formatTimeNPT(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true }
): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleTimeString(NPT_LOCALE, {
      ...options,
      timeZone: NPT_TZ,
    });
  } catch {
    return String(value);
  }
}

/**
 * Format a date value as a full datetime string in Nepal time (+05:45).
 * e.g. "Aug 8, 2026, 11:43 PM"
 */
export function formatDateTimeNPT(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }
): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(NPT_LOCALE, {
      ...options,
      timeZone: NPT_TZ,
    });
  } catch {
    return String(value);
  }
}

/**
 * Returns the current Nepal Standard Time as a Date object.
 */
export function nowNPT(): Date {
  const d = new Date();
  return new Date(d.getTime() + NPT_OFFSET_MINUTES * 60 * 1000);
}

/**
 * Format for use in export filenames, e.g. "2026-08-08_22-43"
 */
export function formatFilenameNPT(value?: string | Date): string {
  const d = value ? new Date(value) : new Date();
  return d
    .toLocaleString('en-CA', {
      timeZone: NPT_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(/,\s*/, '_')
    .replace(/:/g, '-');
}
