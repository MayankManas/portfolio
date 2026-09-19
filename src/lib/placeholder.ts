/**
 * placeholder.ts - handling for the TODO values seeded in content/.
 *
 * The rule: a TODO never renders as if it were real. A link whose href is
 * "TODO" is a broken link that looks fine in a screenshot and 404s for a
 * recruiter, which is the worst of both. Renderers drop them, and the hero
 * surfaces what is still missing so it cannot be forgotten before launch.
 */
export function isTodo(value: string | undefined | null): boolean {
  return value === undefined || value === null || value.trim().toUpperCase() === 'TODO';
}

/** The value, or undefined if it is still a placeholder. */
export function real(value: string | undefined | null): string | undefined {
  return isTodo(value) ? undefined : (value as string);
}
