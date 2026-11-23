import type { PhotoView, ProfileView } from '../lib/snapshot';
import type { Entry, Photo, Profile, Stop } from '../lib/types';

export const fakeToUrl = (bytes: Uint8Array, type: string): string =>
  `fake:${type}:${bytes.length}`;

/** Smallest byte string that passes the JPEG magic-number check. */
export const jpeg = (...rest: readonly number[]): Uint8Array<ArrayBuffer> =>
  Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, ...rest);

export const stopEntry = (id: string, order: number): Entry<Stop> => ({
  meta: { kind: 'stop', id, name: `Pis ${id}`, order, position: { lat: 41.4, lng: 2.17 } },
  payload: new Uint8Array(0),
});

export const profileMeta = (id: string, overrides: Partial<Profile> = {}): Profile => ({
  kind: 'profile',
  id,
  publicKey: 'key',
  name: `Persona ${id}`,
  email: `${id}@example.com`,
  imageType: 'image/jpeg',
  createdAt: '2026-12-12T12:00:00.000Z',
  ...overrides,
});

export const photoMeta = (id: string, overrides: Partial<Photo> = {}): Photo => ({
  kind: 'photo',
  id,
  authorId: 'p1',
  stopId: 's1',
  position: { lat: 41.4, lng: 2.17 },
  takenAt: '2026-12-12T13:00:00.000Z',
  fullUrl: `https://example.com/${id}`,
  fullSha256: 'a'.repeat(64),
  imageType: 'image/jpeg',
  width: 1600,
  height: 1200,
  ...overrides,
});

export const photoView = (id: string, overrides: Partial<Photo> = {}): PhotoView => ({
  ...photoMeta(id, overrides),
  thumbUrl: `thumb:${id}`,
});

export const profileView = (id: string, overrides: Partial<Profile> = {}): ProfileView => ({
  ...profileMeta(id, overrides),
  avatarUrl: null,
});
