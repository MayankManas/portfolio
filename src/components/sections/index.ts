/**
 * layout -> component. The other half of the layout registry.
 *
 * Adding a layout means editing exactly two files: src/lib/schema.ts, which
 * declares the layout and the shape of the data it consumes, and this one,
 * which says what renders it. Nothing else in src/ knows layouts exist.
 *
 * The Record<LayoutName, ...> type is what enforces that: add a layout to the
 * registry without adding it here and this file stops compiling.
 */
import type { LayoutName } from '../../lib/schema';

import Prose from './Prose.astro';
import Metrics from './Metrics.astro';
import Timeline from './Timeline.astro';
import Cards from './Cards.astro';
import Tags from './Tags.astro';
import List from './List.astro';
import Contact from './Contact.astro';

export const SECTION_COMPONENTS = {
  prose: Prose,
  metrics: Metrics,
  timeline: Timeline,
  cards: Cards,
  tags: Tags,
  list: List,
  contact: Contact,
} as const satisfies Record<LayoutName, unknown>;
