import { describe, expect, it } from 'vitest';

import { fakeToUrl, jpeg, photoMeta, stopEntry } from '../test/fixtures';
import { createCloudinaryClient } from './cloudinary';
import { deriveEventKeys, ENTRY, generateSecret, seal } from './crypto';
import { utf8 } from './encoding';
import { generateIdentity, type Identity } from './identity';
import {
  createCloudinaryRepository,
  type EncodedImage,
  isJpeg,
  MAX_ENTRY_BYTES,
  publishEntry,
  type RepositoryDeps,
} from './repository';
import type { Bytes } from './types';

interface StoredFile {
  readonly url: string;
  readonly bytes: Bytes;
  readonly tags: readonly string[];
  readonly preset: unknown;
}

const CLOUD = { cloudName: 'test', uploadPreset: 'preset' };
const base = 'https://res.cloudinary.com/test/raw/upload/v1/';

/**
 * An in-memory Cloudinary behind the real client: requests go through the
 * same URL checks and size limits as in production.
 */
const createFakeCloud = () => {
  const state: { files: readonly StoredFile[] } = { files: [] };
  const json = (body: unknown) => new Response(JSON.stringify(body));
  const fetchFn = async (url: string, init?: RequestInit): Promise<Response> => {
    if (init?.method === 'POST') {
      const body = init.body as FormData;
      const file = body.get('file') as Blob;
      const tags = body.get('tags');
      const stored: StoredFile = {
        url: `${base}${state.files.length}`,
        bytes: new Uint8Array(await file.arrayBuffer()),
        tags: typeof tags === 'string' ? tags.split(',').filter(Boolean) : [],
        preset: body.get('upload_preset'),
      };
      // eslint-disable-next-line functional/immutable-data -- test double
      state.files = [...state.files, stored];
      return json({ secure_url: stored.url });
    }
    if (url.includes('/raw/list/')) {
      const tag = decodeURIComponent(url.split('/raw/list/')[1]!.replace('.json', ''));
      const resources = state.files
        .filter((file) => file.tags.includes(tag))
        .map((file) => ({ public_id: file.url.slice(base.length), version: 1 }));
      return json({ resources });
    }
    const file = state.files.find((candidate) => candidate.url === url);
    return file ? new Response(file.bytes) : new Response(null, { status: 404 });
  };
  return { client: createCloudinaryClient(CLOUD, fetchFn), files: () => state.files };
};

const deps: RepositoryDeps = {
  toUrl: fakeToUrl,
  newId: () => 'photo-1',
  now: () => new Date('2026-12-12T13:00:00.000Z'),
};

const image = (...bytes: readonly number[]): EncodedImage => ({
  bytes: jpeg(...bytes),
  type: 'image/jpeg',
  width: 4,
  height: 3,
});

const newPhoto = {
  position: { lat: 41.4, lng: 2.17 },
  full: image(1, 2),
  thumb: image(3),
};

const setup = async () => {
  const cloud = createFakeCloud();
  const organizer = await generateIdentity();
  const keys = await deriveEventKeys(generateSecret(), organizer.id);
  const me = await generateIdentity();
  const repository = createCloudinaryRepository(cloud.client, keys, deps);
  await publishEntry(
    cloud.client,
    keys,
    {
      meta: { kind: 'event', name: 'Correpisos', organizerKey: organizer.publicKey, legs: [] },
      payload: new Uint8Array(0),
    },
    organizer.privateKey,
  );
  return { ...cloud, keys, organizer, me, repository };
};

const join = (repository: ReturnType<typeof createCloudinaryRepository>, me: Identity) =>
  repository.publishProfile(me, { name: ' Júlia ', email: 'j@x.cat', avatar: image(9) });

describe('createCloudinaryRepository', () => {
  it('uploads with the preset the organizer signed into the event', async () => {
    const { repository, files, keys, organizer, client, me } = await setup();
    await repository.load();
    await join(repository, me);
    expect(files().at(-1)?.preset).toBe('preset');

    await publishEntry(
      client,
      keys,
      {
        meta: {
          kind: 'event',
          name: 'Correpisos',
          organizerKey: organizer.publicKey,
          legs: [],
          uploadPreset: 'ps_event_preset',
        },
        payload: new Uint8Array(0),
      },
      organizer.privateKey,
      'ps_event_preset',
    );
    expect((await repository.load()).uploadPreset).toBe('ps_event_preset');
    await repository.publishPhoto(me, newPhoto);
    expect(
      files()
        .slice(-2)
        .map(({ preset }) => preset),
    ).toEqual(['ps_event_preset', 'ps_event_preset']);
  });

  it('loads the event published by the organizer', async () => {
    const { repository } = await setup();
    const snapshot = await repository.load();
    expect(snapshot.eventName).toBe('Correpisos');
    expect(snapshot.photos).toEqual([]);
  });

  it('publishes a profile and a photo that a fresh load can read and verify', async () => {
    const { repository, me } = await setup();
    await join(repository, me);
    const published = await repository.publishPhoto(me, newPhoto);

    const snapshot = await repository.load();
    expect(snapshot.profiles.get(me.id)).toMatchObject({
      name: 'Júlia',
      avatarUrl: 'fake:image/jpeg:5',
    });
    expect(snapshot.photos).toEqual([published]);
    expect(published).toMatchObject({ id: 'photo-1', authorId: me.id });
  });

  it('never uploads plaintext, and leaves full-size images untagged', async () => {
    const { repository, files, keys, me } = await setup();
    await repository.publishProfile(me, { name: 'SECRET-NAME', email: '', avatar: null });
    await repository.publishPhoto(me, newPhoto);
    const uploaded = files();
    expect(uploaded.filter(({ tags }) => tags.length === 0)).toHaveLength(1);
    expect(uploaded.filter(({ tags }) => tags.includes(keys.tag))).toHaveLength(3);
    const asText = uploaded.map(({ bytes }) => new TextDecoder().decode(bytes)).join('');
    expect(asText).not.toContain('SECRET');
    expect(asText).not.toContain('Correpisos');
  });

  it('opens a full-size photo after checking its hash', async () => {
    const { repository, me } = await setup();
    await join(repository, me);
    const photo = await repository.publishPhoto(me, newPhoto);
    expect(await repository.openPhoto(photo)).toBe('fake:image/jpeg:6');
    await expect(repository.openPhoto({ ...photo, fullSha256: '0'.repeat(64) })).rejects.toThrow(
      'integrity',
    );
  });

  it('refuses to open a blob made for another photo', async () => {
    const { repository, me } = await setup();
    await join(repository, me);
    const photo = await repository.publishPhoto(me, newPhoto);
    await expect(repository.openPhoto({ ...photo, id: 'another-photo' })).rejects.toThrow(
      'integrity',
    );
  });

  it('drops entries from strangers, forgeries, garbage and unsafe content', async () => {
    const { repository, client, keys, me, organizer } = await setup();
    await join(repository, me);
    const stranger = await generateIdentity();
    const otherKeys = await deriveEventKeys(generateSecret(), organizer.id);

    // Encrypted with another event's key, but uploaded under our tag.
    await publishEntry(
      client,
      { ...otherKeys, tag: keys.tag },
      stopEntry('foreign', 1),
      organizer.privateKey,
    );
    // Valid encryption, but not an entry.
    await client.upload(await seal(keys.aes, utf8('not an entry'), ENTRY), [keys.tag]);
    // A stop signed by a member instead of the organizer.
    await publishEntry(client, keys, stopEntry('forged', 1), me.privateKey);
    const published = await repository.publishPhoto(me, newPhoto);
    const meta = photoMeta('copy', { authorId: me.id, fullUrl: published.fullUrl });
    // A photo signed by someone without a profile, in my name.
    await publishEntry(
      client,
      keys,
      { meta: { ...meta, id: 'forged-photo', authorId: stranger.id }, payload: jpeg() },
      stranger.privateKey,
    );
    await publishEntry(
      client,
      keys,
      { meta: { ...meta, id: 'impersonated' }, payload: jpeg() },
      stranger.privateKey,
    );
    // Properly signed by me, but pointing outside the account, or not a JPEG.
    await publishEntry(
      client,
      keys,
      { meta: { ...meta, id: 'tracker', fullUrl: 'https://evil.example/pixel' }, payload: jpeg() },
      me.privateKey,
    );
    await publishEntry(
      client,
      keys,
      { meta: { ...meta, id: 'svg' }, payload: utf8('<svg/>') },
      me.privateKey,
    );
    // A stop properly signed by the organizer.
    await publishEntry(client, keys, stopEntry('s1', 1), organizer.privateKey);

    const snapshot = await repository.load();
    expect(snapshot.stops.map(({ id }) => id)).toEqual(['s1']);
    expect(snapshot.photos.map(({ id }) => id)).toEqual(['photo-1']);
  });

  it('refuses oversized downloads', async () => {
    const { client, keys } = await setup();
    await client.upload(new Uint8Array(MAX_ENTRY_BYTES + 1), [keys.tag]);
    const [url] = await client.list(keys.tag).then((urls) => urls.slice(-1));
    await expect(client.download(url!, MAX_ENTRY_BYTES)).rejects.toThrow('larger');
  });
});

describe('isJpeg', () => {
  it('checks the magic number', () => {
    expect(isJpeg(jpeg())).toBe(true);
    expect(isJpeg(utf8('<svg/>'))).toBe(false);
    expect(isJpeg(Uint8Array.of(0xff, 0xd8))).toBe(false);
  });

  describe('voting', () => {
    const counter = () => {
      const state = { next: 0 };
      return () => {
        // eslint-disable-next-line functional/immutable-data -- test double
        state.next += 1;
        return `id-${String(state.next)}`;
      };
    };
    const scores = { presentation: 5, originality: 4, taste: 3, craft: 2 };

    it('runs a vote end to end, and a poll reports news only once', async () => {
      const { client, keys, organizer, me } = await setup();
      const repository = createCloudinaryRepository(client, keys, { ...deps, newId: counter() });
      const guest = await generateIdentity();
      const empty = new Uint8Array(0);
      const asOrganizer = (meta: Parameters<typeof publishEntry>[2]['meta']) =>
        publishEntry(client, keys, { meta, payload: empty }, organizer.privateKey);

      await asOrganizer(stopEntry('s1', 1).meta);
      await asOrganizer({ kind: 'host', profileId: me.id, grantedAt: '2026-12-12T12:00:00.000Z' });
      await join(repository, me);
      await join(repository, guest);

      expect((await repository.load()).rounds).toEqual([]);
      expect(await repository.poll()).toBeNull();

      await repository.publishRound(me, { stopId: 's1', status: 'open' });
      const afterOpen = await repository.poll();
      expect(afterOpen?.rounds.map(({ status }) => status)).toEqual(['open']);
      expect(afterOpen?.hosts.has(me.id)).toBe(true);
      expect(await repository.poll()).toBeNull();

      await repository.publishRating(guest, { stopId: 's1', scores });
      const afterVote = await repository.poll();
      expect(afterVote?.ratings.map(({ authorId, scores: given }) => [authorId, given])).toEqual([
        [guest.id, scores],
      ]);
    });

    it('does not accept a round from someone the organizer did not name', async () => {
      const { client, keys, organizer, me, repository } = await setup();
      await publishEntry(
        client,
        keys,
        { meta: stopEntry('s1', 1).meta, payload: new Uint8Array(0) },
        organizer.privateKey,
      );
      await join(repository, me);
      await repository.publishRound(me, { stopId: 's1', status: 'open' });
      expect((await repository.load()).rounds).toEqual([]);
    });
  });
});
