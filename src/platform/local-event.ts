import type { DemoEvent } from '../lib/demo';
import { parseEventFile, stopsOf } from '../lib/event-file';

/**
 * Development only: the organizer's event.json at the repository root, if it
 * exists, so `pnpm dev` shows the real route. The file is git-ignored, and in
 * production builds this branch is compiled away (`import.meta.env.DEV` is
 * false), so the addresses never reach the published site.
 */
const files: Readonly<Record<string, () => Promise<unknown>>> = import.meta.env.DEV
  ? import.meta.glob('/event.json', { import: 'default' })
  : {};

export const loadLocalEvent = async (): Promise<DemoEvent | null> => {
  const load = files['/event.json'];
  if (load === undefined) {
    return null;
  }
  const event = parseEventFile(await load());
  return event === null ? null : { name: event.name, stops: stopsOf(event) };
};
