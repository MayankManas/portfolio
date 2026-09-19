/**
 * formatDate.ts - every date on the site goes through here, because every date
 * needs two forms: one a human reads, and one a machine reads.
 *
 * The `datetime` value is what makes <time datetime="2021-07"> machine-
 * readable rather than just formatted text; it is required by the
 * machine-readability spec in docs/02-design.md.
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export interface FormattedDate {
  /** e.g. "Jul 2021" - for display */
  display: string;
  /** e.g. "2021-07" - for the datetime attribute; undefined when open-ended */
  datetime?: string;
}

/**
 * `null` means the entry is current. Rendering it as "Present" is a content
 * rule from docs/03-architecture.md, not a renderer choice.
 */
export function formatDate(value: string | null): FormattedDate {
  if (value === null) return { display: 'Present' };

  const [year, month, day] = value.split('-');
  if (!year) return { display: value, datetime: value };

  if (!month) return { display: year, datetime: year };

  const name = MONTHS[Number(month) - 1] ?? month;
  const display = day ? `${name} ${Number(day)}, ${year}` : `${name} ${year}`;

  return { display, datetime: value };
}

export interface FormattedRange {
  /** e.g. "Jul 2021 - Present" */
  display: string;
  start: FormattedDate;
  end: FormattedDate;
}

export function formatRange(start: string, end: string | null): FormattedRange {
  const from = formatDate(start);
  const to = formatDate(end);
  return {
    display: `${from.display} - ${to.display}`,
    start: from,
    end: to,
  };
}

/** Whole years between a start date and now (or an end date). Used for "5+ YOE". */
export function yearsBetween(start: string, end: string | null): number {
  const [sy, sm] = start.split('-').map(Number);
  const endDate = end === null ? new Date() : new Date(`${end}-01`);
  const months =
    (endDate.getFullYear() - (sy ?? 0)) * 12 +
    (endDate.getMonth() + 1 - (sm ?? 1));
  return Math.floor(months / 12);
}
