import { describe, expect, it } from 'vitest';

import { chosenOption, legStyle, lineColor, segmentStyle, walkingMinutes } from './transit';
import type { Leg, LegOption } from './types';

const leg = (options: readonly Omit<LegOption, 'segments'>[]): Leg => ({
  options: options.map((option) => ({ ...option, segments: [] })),
  path: [],
});

describe('lineColor', () => {
  it('knows the metro lines, case-insensitively', () => {
    expect(lineColor('L1')).toBe('#E2001A');
    expect(lineColor('l4')).toBe('#FFC20E');
    expect(lineColor('V7')).toBeNull();
  });
});

describe('legStyle', () => {
  it('draws metro legs solid, in the colour of their first line', () => {
    const style = legStyle(
      leg([
        {
          mode: 'metro',
          minutes: 26,
          steps: [
            { line: 'L4', from: 'Joanic', to: 'Verdaguer' },
            { line: 'L5', from: 'Verdaguer', to: 'Badal' },
          ],
        },
      ]),
    );
    expect(style).toEqual({ color: '#FFC20E', dashArray: null, weight: 5 });
  });

  it('falls back to the mode colour for unknown lines', () => {
    expect(
      legStyle(leg([{ mode: 'bus', minutes: 10, steps: [{ line: 'V7', from: 'a', to: 'b' }] }]))
        .color,
    ).toBe('#D42027');
  });

  it('draws walking dotted and cycling dashed', () => {
    expect(legStyle(leg([{ mode: 'walk', minutes: 13, steps: [] }])).dashArray).toBe('1 8');
    expect(legStyle(leg([{ mode: 'bike', minutes: 4, steps: [] }])).dashArray).toBe('10 8');
  });

  it('has a neutral style for a leg without options', () => {
    expect(legStyle(leg([])).dashArray).toBe('6 10');
  });
});

describe('segmentStyle', () => {
  const ride = {
    line: 'L4',
    color: '#FFC20E',
    vehicle: 'metro' as const,
    from: { name: 'Joanic', position: { lat: 41.4, lng: 2.16 } },
    to: { name: 'Verdaguer', position: { lat: 41.39, lng: 2.17 } },
    headsign: 'Trinitat Nova',
    stops: 2,
  };

  it('draws rides in the colour from the data, then the line table', () => {
    const segment = { mode: 'ride' as const, minutes: 4, meters: 1500, path: [], ride };
    expect(segmentStyle(segment).color).toBe('#FFC20E');
    expect(segmentStyle({ ...segment, ride: { ...ride, color: null, line: 'L1' } }).color).toBe(
      '#E2001A',
    );
  });

  it('draws walks dotted', () => {
    expect(
      segmentStyle({ mode: 'walk', minutes: 3, meters: 200, path: [], ride: null }).dashArray,
    ).toBe('1 8');
  });
});

describe('chosenOption and walkingMinutes', () => {
  const walkSegment = { mode: 'walk' as const, minutes: 4, meters: 300, path: [], ride: null };
  const metro = {
    mode: 'metro' as const,
    minutes: 20,
    steps: [],
    segments: [walkSegment, walkSegment],
  };
  const walkOnly = { mode: 'walk' as const, minutes: 25, steps: [], segments: [] };
  const twoOptions: Leg = { options: [metro, walkOnly], path: [] };

  it('picks the chosen option, falling back to the first', () => {
    expect(chosenOption(twoOptions, 1)).toBe(walkOnly);
    expect(chosenOption(twoOptions, undefined)).toBe(metro);
    expect(chosenOption(twoOptions, 9)).toBe(metro);
  });

  it('adds up the walking parts', () => {
    expect(walkingMinutes(metro)).toBe(8);
    expect(walkingMinutes(walkOnly)).toBe(25);
  });
});
