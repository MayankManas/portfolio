/**
 * ascii.ts - typographic characters to their ASCII equivalents, for the PDF.
 *
 * Why this exists: a middot or an en dash in the resume sheet extracted as
 * U+FFFD, so the contact line came out as "India <?> email <?> phone". Whether
 * that is a font-embedding quirk or a ToUnicode mapping gap, the fix is the
 * same and it is the one the ATS rules already ask for: no decorative glyphs
 * in the PDF. A separator is decoration.
 *
 * This applies ONLY to the print route. The website keeps real typography -
 * it is read by browsers, which have no such problem.
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/[\u2018\u2019\u201A\u201B]/g, "'"], // curly single quotes
  [/[\u201C\u201D\u201E\u201F]/g, '"'], // curly double quotes
  [/[\u2013\u2014\u2015]/g, '-'], // en / em / horizontal bar
  [/[\u2010\u2011\u2012]/g, '-'], // hyphen variants
  [/\u2026/g, '...'], // ellipsis
  [/[\u00B7\u2022\u2027\u30FB]/g, '-'], // middot / bullet
  [/\u00A0/g, ' '], // non-breaking space
  [/[\u2000-\u200A\u202F\u205F]/g, ' '], // exotic spaces
  [/[\u200B-\u200D\uFEFF]/g, ''], // zero-width
  [/\u2122/g, '(TM)'],
  [/\u00AE/g, '(R)'],
  [/\u00A9/g, '(C)'],
];

/** Collapse whitespace and force ASCII punctuation. */
export function asciify(value: string): string {
  let out = value;
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement);
  return out.replace(/\s+/g, ' ').trim();
}
