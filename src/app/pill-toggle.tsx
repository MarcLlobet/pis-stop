import { cx } from '@/utils/cx';

/**
 * Pill-shaped toggle shared by the itinerary's travel-mode options and the
 * gallery's author filter: a ring when unselected, a solid brand fill with a
 * light lift when picked. Callers add their own padding (an avatar or an
 * icon needs different space on the left than plain text).
 */
export const pillToggle = (isSelected: boolean): string =>
  cx(
    'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full text-sm font-semibold ring-1 ring-inset transition duration-100 ease-linear outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2',
    isSelected
      ? 'bg-brand-solid text-white shadow-sm ring-transparent'
      : 'bg-primary text-secondary ring-primary hover:bg-primary_hover',
  );
