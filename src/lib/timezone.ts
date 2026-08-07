/**
 * Nepal Standard Time (NST) utilities — UTC+5:45
 *
 * PostgreSQL always stores timestamps in UTC. These helpers ensure every
 * date displayed to the user is formatted in Nepal time regardless of the
 * server or browser locale.
 */

const NPT_LOCALE = 'en-NP';
const NPT_TZ = 'Asia/Kathmandu';

/**
 * Format a date value as a short date string in Nepal time.
 * e.g. "02/08/2026" or "Aug 2, 2026"
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
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
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
 * Format a date value as a full datetime string in Nepal time.
 * e.g. "Aug 2, 2026, 11:43 PM"
 */
export function formatDateTimeNPT(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
 * Useful for server-side code that needs "now" in NPT.
 */
export function nowNPT(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: NPT_TZ })
  );
}

/**
 * Format for use in export filenames, e.g. "2026-08-02_23-43"
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
