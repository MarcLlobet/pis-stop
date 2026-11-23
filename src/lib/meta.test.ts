import { describe, expect, it } from 'vitest';

import { isLatLng, parseMeta } from './meta';
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
  name: 'Júlia',
  email: 'julia@example.com',
  imageType: 'image/jpeg',
  createdAt: '2026-12-12T12:00:00.000Z',
};

const photo: Photo = {
  kind: 'photo',
  id: 'ph1',
  authorId: 'p1',
  stopId: 's1',
  position: { lat: 41.38, lng: 2.16 },
  takenAt: '2026-12-12T12:30:00.000Z',
  fullUrl: 'https://example.com/full',
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
    ['event', { kind: 'event', name: 'Correpisos 2026' }],
    ['stop', stop],
    ['profile', profile],
    ['photo', photo],
    ['photo without stop or position', { ...photo, stopId: null, position: null }],
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
    ['an event without name', { kind: 'event', name: '' }],
    ['a stop with bad coordinates', { ...stop, position: { lat: 'x', lng: 2 } }],
    ['a profile without id', { ...profile, id: '' }],
    ['a profile with a numeric email', { ...profile, email: 3 }],
    ['a photo with a bad size', { ...photo, width: '1600' }],
    ['a photo with an empty stop id', { ...photo, stopId: '' }],
  ])('rejects %s', (_, value) => {
    expect(parseMeta(value)).toBeNull();
  });
});
