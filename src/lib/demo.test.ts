import { describe, expect, it } from 'vitest';

import { fakeToUrl } from '../test/fixtures';
import { avatarSvg, createDemoRepository, demoEntries, tileSvg } from './demo';
import { utf8 } from './encoding';

const repository = createDemoRepository({
  toUrl: fakeToUrl,
  newId: () => 'new-photo',
  now: () => new Date('2026-12-12T20:00:00.000Z'),
});

describe('demo data', () => {
  it('has an event, stops, friends and photos snapped to stops', async () => {
    const snapshot = await repository.load();
    expect(snapshot.eventName).toBe('Correpisos de prova');
    expect(snapshot.stops).toHaveLength(4);
    expect(snapshot.profiles.size).toBe(3);
    expect(snapshot.photos.length).toBeGreaterThan(0);
    const stopIds = new Set(snapshot.stops.map(({ id }) => id));
    expect(snapshot.photos.every(({ stopId }) => stopId !== null && stopIds.has(stopId))).toBe(
      true,
    );
  });

  it('is rebuilt fresh on every call', () => {
    expect(demoEntries()).toEqual(demoEntries());
    expect(demoEntries()).not.toBe(demoEntries());
  });

  it('escapes text inside generated SVGs', () => {
    expect(tileSvg('<b>&"', 10)).toContain('&lt;b&gt;&amp;&quot;');
    expect(avatarSvg("'x", 10)).toContain('&apos;');
  });
});

describe('createDemoRepository', () => {
  it('returns published profiles and photos without persisting them', async () => {
    const profile = await repository.publishProfile({
      id: 'me',
      name: 'Jo',
      email: '',
      avatar: null,
    });
    const photo = await repository.publishPhoto({
      authorId: 'me',
      stopId: null,
      position: null,
      full: { bytes: utf8('FULL'), type: 'image/jpeg', width: 1, height: 1 },
      thumb: { bytes: utf8('T'), type: 'image/jpeg', width: 1, height: 1 },
    });

    expect(profile).toMatchObject({ id: 'me', avatarUrl: null });
    expect(photo).toMatchObject({ id: 'new-photo', fullUrl: 'fake:image/jpeg:4' });
    expect(await repository.openPhoto(photo)).toBe('fake:image/jpeg:4');
    expect((await repository.load()).profiles.has('me')).toBe(false);
  });
});
