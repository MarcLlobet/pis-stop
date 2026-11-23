import { describe, expect, it } from 'vitest';

import { legStyle, lineColor } from './transit';
import type { Leg } from './types';

const leg = (options: Leg['options']): Leg => ({ options, path: [] });

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
