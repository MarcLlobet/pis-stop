import { describe, expect, it } from 'vitest';

import { fakeToUrl, jpeg, stopEntry } from '../test/fixtures';
import { avatarSvg, createDemoRepository, demoEntries, tileSvg } from './demo';
import { generateIdentity } from './identity';

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
    const me = await generateIdentity();
    const profile = await repository.publishProfile(me, { name: 'Jo', email: '', avatar: null });
    const photo = await repository.publishPhoto(me, {
      stopId: null,
      position: null,
      full: { bytes: jpeg(1), type: 'image/jpeg', width: 1, height: 1 },
      thumb: { bytes: jpeg(), type: 'image/jpeg', width: 1, height: 1 },
    });

    expect(profile).toMatchObject({ id: me.id, avatarUrl: null });
    expect(photo).toMatchObject({ id: 'new-photo', authorId: me.id, fullUrl: 'fake:image/jpeg:5' });
    expect(await repository.openPhoto(photo)).toBe('fake:image/jpeg:5');
    expect((await repository.load()).profiles.has(me.id)).toBe(false);
  });

  it('serves its SVG pictures as data: URLs, never as same-origin blobs', async () => {
    const snapshot = await repository.load();
    const urls = [
      ...snapshot.photos.map(({ thumbUrl }) => thumbUrl),
      ...[...snapshot.profiles.values()].map(({ avatarUrl }) => avatarUrl ?? ''),
    ];
    expect(urls.every((url) => url.startsWith('data:image/svg+xml'))).toBe(true);
  });
});

describe('createDemoRepository with a ready-made profile', () => {
  it('includes the current device as a member', async () => {
    const me = await generateIdentity();
    const withMe = createDemoRepository(
      { toUrl: fakeToUrl, newId: () => 'x', now: () => new Date() },
      { identity: me, name: 'Dev' },
    );
    const snapshot = await withMe.load();
    expect(snapshot.profiles.get(me.id)).toMatchObject({ name: 'Dev', avatarUrl: null });
    expect(snapshot.profiles.size).toBe(4);
  });
});

describe('createDemoRepository with another route', () => {
  it('shows the given stops and places the sample photos on them', async () => {
    const stops = [stopEntry('a', 1).meta, stopEntry('b', 2).meta];
    const snapshot = await createDemoRepository(
      { toUrl: fakeToUrl, newId: () => 'x', now: () => new Date() },
      undefined,
      { name: 'Correpisos 2026', stops },
    ).load();
    expect(snapshot.eventName).toBe('Correpisos 2026');
    expect(snapshot.stops.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(snapshot.photos.every(({ stopId }) => stopId === 'a' || stopId === 'b')).toBe(true);
  });
});
