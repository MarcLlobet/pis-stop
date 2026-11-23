import { Bus, Train, Tram } from '@untitledui/icons';
import type { FC } from 'react';

import type { TravelMode } from '../lib/types';

/** The props we pass to any travel icon: ours and Untitled UI's accept them. */
interface IconProps {
  readonly className?: string;
  readonly 'aria-hidden'?: boolean | 'true' | 'false';
}

/** Line icon in the Untitled UI style (24px grid, 2px stroke); it has no walking icon. */
const Walk = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
    <circle cx="13" cy="4" r="2" />
    <path
      d="m9 21 2-6m2 6-2-6 1-5m0 0-4 2-1 4m5-6 2 3 4 1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Line icon in the Untitled UI style; it has no bicycle icon. */
const Bike = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
    <circle cx="5.5" cy="16.5" r="3.5" />
    <circle cx="18.5" cy="16.5" r="3.5" />
    <path
      d="M5.5 16.5 9 9h6l3.5 7.5M9 9l3 7.5L15 9m-1.5-3h2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const TRAVEL_ICONS: Readonly<Record<TravelMode, FC<IconProps>>> = {
  metro: Train,
  train: Train,
  tram: Tram,
  bus: Bus,
  walk: Walk,
  bike: Bike,
};
