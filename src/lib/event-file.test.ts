import { describe, expect, it } from 'vitest';

import { parseEventFile, slugify, stopsOf } from './event-file';

const event = {
  name: 'Correpisos 2026',
  stops: [
    { name: 'Pis de l’Anna', lat: 41.4077, lng: 2.1846 },
    { name: 'Sala Plataforma', lat: 41.3728, lng: 2.1682 },
  ],
};

describe('parseEventFile', () => {
  it('accepts a valid file, with or without an itinerary', () => {
    expect(parseEventFile(event)).toEqual({ ...event, legs: [] });
    const legs = [{ options: [{ mode: 'walk', minutes: 13 }] }];
    expect(parseEventFile({ ...event, legs })?.legs).toEqual([
      { options: [{ mode: 'walk', minutes: 13, steps: [] }], path: [] },
    ]);
  });

  it.each([
    ['null', null],
    ['no name', { ...event, name: ' ' }],
    ['no stops', { name: 'x' }],
    ['a stop without name', { name: 'x', stops: [{ lat: 1, lng: 2 }] }],
    ['a stop out of range', { name: 'x', stops: [{ name: 'a', lat: 95, lng: 2 }] }],
    ['an invalid itinerary', { ...event, legs: [{ options: [{ mode: 'boat', minutes: 1 }] }] }],
  ])('rejects %s', (_, value) => {
    expect(parseEventFile(value)).toBeNull();
  });
});

describe('stopsOf', () => {
  it('numbers stops in file order with readable ids', () => {
    expect(stopsOf({ ...event, legs: [] })).toEqual([
      {
        kind: 'stop',
        id: 'stop-1-pis-de-l-anna',
        name: 'Pis de l’Anna',
        order: 1,
        position: { lat: 41.4077, lng: 2.1846 },
      },
      {
        kind: 'stop',
        id: 'stop-2-sala-plataforma',
        name: 'Sala Plataforma',
        order: 2,
        position: { lat: 41.3728, lng: 2.1682 },
      },
    ]);
  });

  it('slugifies accents and punctuation', () => {
    expect(slugify('  Príncep de Viana, 20 ')).toBe('princep-de-viana-20');
  });
});
