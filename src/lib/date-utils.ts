/**
 * Safe cross-browser (Chrome, Node.js, iOS Safari WebKit) date parsing & formatting
 * for timestamps stored in Google Sheets (ISO, YYYY-MM-DD HH:mm:ss, YYYY-MM-DD h:mm:ss am/pm).
 */

export function parseSheetDate(value?: string | null): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Match "YYYY-MM-DD" with optional time and optional AM/PM (without timezone -> assume IST +05:30)
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i
  );

  if (match) {
    const [, yearStr, monthStr, dayStr, hourStr, minStr, secStr, ampm] = match;
    if (!hourStr) {
      const isoDateOnly = `${yearStr}-${monthStr}-${dayStr}T00:00:00+05:30`;
      const d = new Date(isoDateOnly);
      return isNaN(d.getTime()) ? null : d;
    }

    let hour = parseInt(hourStr, 10);
    const min = minStr.padStart(2, '0');
    const sec = (secStr || '00').padStart(2, '0');

    if (ampm) {
      const lower = ampm.toLowerCase();
      if (lower === 'pm' && hour < 12) hour += 12;
      else if (lower === 'am' && hour === 12) hour = 0;
    }

    const hourPadded = String(hour).padStart(2, '0');
    const isoWithIst = `${yearStr}-${monthStr}-${dayStr}T${hourPadded}:${min}:${sec}+05:30`;
    const d = new Date(isoWithIst);
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(raw);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function formatSheetDate(
  value?: string | null,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }
): string {
  const parsed = parseSheetDate(value);
  if (!parsed) return value ? String(value) : 'N/A';
  return parsed.toLocaleDateString('en-IN', options);
}

export function formatSheetDateTime(
  value?: string | null,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }
): string {
  const parsed = parseSheetDate(value);
  if (!parsed) return value ? String(value) : 'N/A';
  return parsed.toLocaleString('en-IN', options);
}
