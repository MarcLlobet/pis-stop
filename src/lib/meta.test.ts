import { describe, expect, it } from 'vitest';

import { isLatLng, parseLegs, parseMeta } from './meta';
import type { Photo, Profile, Stop } from './types';

const stop: Stop = {
  kind: 'stop',
  id: 's1',
  name: 'Pis de la Júlia',
  order: 1,
  position: { lat: 41.38, lng: 2.16 },
};

const profile: Profile = {
  kind: 'profile',
  id: 'p1',
  publicKey: 'BKey_-1',
  name: 'Júlia',
  email: 'julia@example.com',
  imageType: 'image/jpeg',
  createdAt: '2026-12-12T12:00:00.000Z',
};

const photo: Photo = {
  kind: 'photo',
  id: 'ph1',
  authorId: 'p1',
  position: { lat: 41.38, lng: 2.16 },
  takenAt: '2026-12-12T12:30:00.000Z',
  fullUrl: 'https://example.com/full',
  fullSha256: 'f'.repeat(64),
  imageType: 'image/jpeg',
  width: 1600,
  height: 1200,
};

describe('isLatLng', () => {
  it('accepts valid coordinates and rejects out-of-range ones', () => {
    expect(isLatLng({ lat: 41.4, lng: 2.1 })).toBe(true);
    expect(isLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isLatLng({ lat: 0, lng: -181 })).toBe(false);
    expect(isLatLng({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(isLatLng([41, 2])).toBe(false);
  });
});

describe('parseMeta', () => {
  it.each([
    ['event', { kind: 'event', name: 'Correpisos 2026', organizerKey: 'BKey', legs: [] }],
    ['stop', stop],
    ['profile', profile],
    ['photo', photo],
    ['photo without position', { ...photo, position: null }],
  ])('accepts a valid %s', (_, value) => {
    expect(parseMeta(value)).toEqual(value);
  });

  it('drops unknown fields so decrypted data cannot smuggle extra props', () => {
    expect(parseMeta({ ...stop, admin: true })).toEqual(stop);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['an unknown kind', { kind: 'secret' }],
    ['an event without name', { kind: 'event', name: '', organizerKey: 'k' }],
    ['an event without organizer key', { kind: 'event', name: 'x' }],
    ['a name that is too long', { ...stop, name: 'x'.repeat(81) }],
    ['an id with unsafe characters', { ...stop, id: '../etc' }],
    ['an SVG avatar (scripts!)', { ...profile, imageType: 'image/svg+xml' }],
    ['a photo with a bad hash', { ...photo, fullSha256: 'xyz' }],
    ['a photo with an invalid date', { ...photo, takenAt: 'ahir' }],
    ['a stop with bad coordinates', { ...stop, position: { lat: 'x', lng: 2 } }],
    ['a profile without id', { ...profile, id: '' }],
    ['a profile with a numeric email', { ...profile, email: 3 }],
    ['a photo with a bad size', { ...photo, width: '1600' }],
  ])('rejects %s', (_, value) => {
    expect(parseMeta(value)).toBeNull();
  });
});

describe('parseLegs', () => {
  const metro = {
    mode: 'metro',
    minutes: 26,
    steps: [
      { line: 'L4', from: 'Joanic', to: 'Verdaguer' },
      { line: 'L5', from: 'Verdaguer', to: 'Badal' },
    ],
  };

  it('fills in optional fields and drops unknown ones', () => {
    expect(parseLegs([{ options: [metro, { mode: 'walk', minutes: 13, extra: 1 }] }])).toEqual([
      {
        options: [
          { ...metro, segments: [] },
          { mode: 'walk', minutes: 13, steps: [], segments: [] },
        ],
        path: [],
      },
    ]);
  });

  it('treats a missing itinerary as empty', () => {
    expect(parseLegs(undefined)).toEqual([]);
    expect(parseMeta({ kind: 'event', name: 'x', organizerKey: 'k' })).toMatchObject({ legs: [] });
  });

  it.each([
    ['a non-list', 'L1'],
    ['an unknown mode', [{ options: [{ mode: 'boat', minutes: 3 }] }]],
    ['a negative time', [{ options: [{ mode: 'walk', minutes: -1 }] }]],
    ['a fractional time', [{ options: [{ mode: 'walk', minutes: 1.5 }] }]],
    [
      'a weird line name',
      [{ options: [{ ...metro, steps: [{ line: '<b>', from: 'a', to: 'b' }] }] }],
    ],
    ['a bad waypoint', [{ options: [], path: [{ lat: 100, lng: 0 }] }]],
    ['too many legs', Array.from({ length: 51 }, () => ({ options: [] }))],
  ])('rejects %s', (_, value) => {
    expect(parseLegs(value)).toBeNull();
    expect(parseMeta({ kind: 'event', name: 'x', organizerKey: 'k', legs: value })).toBeNull();
  });
});
