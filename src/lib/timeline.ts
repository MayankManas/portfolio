/**
 * timeline.ts - flattens the two genuinely different entry shapes the
 * `timeline` layout serves into one thing the renderer can loop over.
 *
 * `work` nests three levels deep (entry -> workstreams -> highlights) and
 * `education` is flat with awards. Rather than branch inside the component -
 * which is how per-section markup creeps back in - both are normalised here
 * and Timeline.astro renders exactly one shape.
 */
import type { EducationEntry, WorkEntry } from './schema';

export interface TimelineGroup {
  name: string;
  tech: string[];
  highlights: string[];
}

export interface TimelineEntry {
  /** the organisation - company or institution */
  title: string;
  /** the role held there - position or degree */
  role: string;
  /** rendered under the title; the client, for contract work */
  subtitle?: string;
  location?: string;
  startDate: string;
  endDate: string | null;
  summary?: string;
  /** workstreams, for work entries; empty for education */
  groups: TimelineGroup[];
  /** flat bullets not belonging to a group - awards, for education */
  bullets: string[];
  /** e.g. "CGPA 9.3" */
  note?: string;
}

function isWork(entry: WorkEntry | EducationEntry): entry is WorkEntry {
  return 'company' in entry;
}

export function normalizeTimelineEntry(entry: WorkEntry | EducationEntry): TimelineEntry {
  if (isWork(entry)) {
    return {
      title: entry.company,
      role: entry.position,
      subtitle: entry.client,
      location: entry.location,
      startDate: entry.startDate,
      endDate: entry.endDate,
      summary: entry.summary,
      groups: entry.workstreams.map((ws) => ({
        name: ws.name,
        tech: ws.tech,
        highlights: ws.highlights,
      })),
      bullets: [],
    };
  }

  return {
    title: entry.institution,
    role: entry.degree,
    location: entry.location,
    startDate: entry.startDate,
    endDate: entry.endDate,
    groups: [],
    bullets: entry.awards,
    note: entry.score,
  };
}

/** How many highlights stay visible before the disclosure kicks in. */
export const VISIBLE_HIGHLIGHTS = 2;
