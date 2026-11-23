import { describe, expect, it } from 'vitest';

import {
  fakeToUrl,
  photoMeta,
  photoView,
  profileMeta,
  profileView,
  stopEntry,
} from '../test/fixtures';
import { buildSnapshot, EMPTY_SNAPSHOT, withPhoto, withProfile } from './snapshot';
import type { Entry } from './types';

const NO_BYTES = new Uint8Array(0);

describe('buildSnapshot', () => {
  it('returns an empty snapshot for no entries', () => {
    expect(buildSnapshot([], fakeToUrl)).toEqual(EMPTY_SNAPSHOT);
  });

  it('collects the event name, ordered stops, profiles and newest-first photos', () => {
    const entries: readonly Entry[] = [
      {
        meta: { kind: 'event', name: 'Correpisos 2026', organizerKey: 'k', legs: [] },
        payload: NO_BYTES,
      },
      stopEntry('s2', 2),
      stopEntry('s1', 1),
      { meta: profileMeta('p1'), payload: Uint8Array.of(1, 2, 3) },
      {
        meta: photoMeta('old', { takenAt: '2026-12-12T12:00:00.000Z' }),
        payload: Uint8Array.of(1),
      },
      {
        meta: photoMeta('new', { takenAt: '2026-12-12T14:00:00.000Z' }),
        payload: Uint8Array.of(1),
      },
    ];
    const snapshot = buildSnapshot(entries, fakeToUrl);

    expect(snapshot.eventName).toBe('Correpisos 2026');
    expect(snapshot.stops.map(({ id }) => id)).toEqual(['s1', 's2']);
    expect(snapshot.profiles.get('p1')?.avatarUrl).toBe('fake:image/jpeg:3');
    expect(snapshot.photos.map(({ id }) => id)).toEqual(['new', 'old']);
    expect(snapshot.photos[0]?.thumbUrl).toBe('fake:image/jpeg:1');
  });

  it('keeps the latest version of a profile and no avatar when it is empty', () => {
    const snapshot = buildSnapshot(
      [
        {
          meta: profileMeta('p1', { name: 'Nou', createdAt: '2026-12-12T13:00:00.000Z' }),
          payload: NO_BYTES,
        },
        {
          meta: profileMeta('p1', { name: 'Vell', createdAt: '2026-12-12T12:00:00.000Z' }),
          payload: NO_BYTES,
        },
      ],
      fakeToUrl,
    );
    expect(snapshot.profiles.size).toBe(1);
    expect(snapshot.profiles.get('p1')).toMatchObject({ name: 'Nou', avatarUrl: null });
  });

  it('deduplicates photos with the same id', () => {
    const entry = { meta: photoMeta('x'), payload: NO_BYTES };
    expect(buildSnapshot([entry, entry], fakeToUrl).photos).toHaveLength(1);
  });
});

describe('optimistic merges', () => {
  it('adds a photo in date order without mutating the original', () => {
    const base = {
      ...EMPTY_SNAPSHOT,
      photos: [photoView('a', { takenAt: '2026-12-12T12:00:00Z' })],
    };
    const next = withPhoto(base, photoView('b', { takenAt: '2026-12-12T15:00:00Z' }));
    expect(next.photos.map(({ id }) => id)).toEqual(['b', 'a']);
    expect(base.photos).toHaveLength(1);
  });

  it('replaces a photo with the same id', () => {
    const base = { ...EMPTY_SNAPSHOT, photos: [photoView('a')] };
    expect(withPhoto(base, photoView('a', { stopId: null })).photos).toEqual([
      photoView('a', { stopId: null }),
    ]);
  });

  it('adds or replaces a profile without mutating the original', () => {
    const base = withProfile(EMPTY_SNAPSHOT, profileView('p1'));
    const next = withProfile(base, profileView('p1', { name: 'Canviat' }));
    expect(next.profiles.get('p1')?.name).toBe('Canviat');
    expect(base.profiles.get('p1')?.name).toBe('Persona p1');
    expect(EMPTY_SNAPSHOT.profiles.size).toBe(0);
  });
});
