import type { Leg, LegOption, Segment, TravelMode } from './types';

/** Official colours of the Barcelona metro lines (TMB / FGC). */
const LINE_COLORS: Readonly<Record<string, string>> = {
  L1: '#E2001A',
  L2: '#9C3293',
  L3: '#2EA836',
  L4: '#FFC20E',
  L5: '#0078BF',
  L9: '#F18E00',
  L10: '#00A6D6',
  L11: '#A1CE47',
};

const MODE_COLORS: Readonly<Record<TravelMode, string>> = {
  metro: '#B4472F',
  train: '#5B6B7F',
  tram: '#00936F',
  bus: '#D42027',
  walk: '#1F2937',
  bike: '#16A34A',
};

export const lineColor = (line: string): string | null => LINE_COLORS[line.toUpperCase()] ?? null;

export interface LegStyle {
  readonly color: string;
  /** SVG dash pattern; `null` for a solid line. */
  readonly dashArray: string | null;
  readonly weight: number;
}

/**
 * How a leg is drawn, from its first (main) option: metro in the colour of
 * its first line, walking as a dotted line, cycling dashed.
 */
export const legStyle = (leg: Leg): LegStyle => {
  const main: LegOption | undefined = leg.options[0];
  if (main === undefined) {
    return { color: MODE_COLORS.metro, dashArray: '6 10', weight: 4 };
  }
  switch (main.mode) {
    case 'walk':
      return { color: MODE_COLORS.walk, dashArray: '1 8', weight: 4 };
    case 'bike':
      return { color: MODE_COLORS.bike, dashArray: '10 8', weight: 4 };
    case 'metro':
    case 'train':
    case 'tram':
    case 'bus':
      return {
        color: lineColor(main.steps[0]?.line ?? '') ?? MODE_COLORS[main.mode],
        dashArray: null,
        weight: 5,
      };
  }
};

export const modeColor = (mode: TravelMode): string => MODE_COLORS[mode];

/** How one segment of a planned route is drawn: rides in their line colour. */
export const segmentStyle = (segment: Segment): LegStyle => {
  switch (segment.mode) {
    case 'walk':
      return { color: MODE_COLORS.walk, dashArray: '1 8', weight: 4 };
    case 'bike':
      return { color: MODE_COLORS.bike, dashArray: '10 8', weight: 4 };
    case 'ride':
      return {
        color:
          segment.ride?.color ??
          lineColor(segment.ride?.line ?? '') ??
          MODE_COLORS[segment.ride?.vehicle ?? 'metro'],
        dashArray: null,
        weight: 6,
      };
  }
};

/** The option shown for a leg: the chosen one, or the first. */
export const chosenOption = (leg: Leg, choice: number | undefined): LegOption | undefined =>
  leg.options[choice ?? 0] ?? leg.options[0];

/** Minutes spent walking in an option (all of it, for a walking option). */
export const walkingMinutes = (option: LegOption): number =>
  option.mode === 'walk'
    ? option.minutes
    : option.segments
        .filter(({ mode }) => mode === 'walk')
        .reduce((sum, { minutes }) => sum + minutes, 0);
