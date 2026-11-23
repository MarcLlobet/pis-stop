import { describe, expect, it } from 'vitest';

import { fakeToUrl } from '../test/fixtures';
import type { CloudinaryClient } from './cloudinary';
import { deriveEventKeys, generateSecret, seal } from './crypto';
import { utf8 } from './encoding';
import {
  createCloudinaryRepository,
  type EncodedImage,
  publishEntry,
  type RepositoryDeps,
} from './repository';
import type { Bytes } from './types';

interface StoredFile {
  readonly url: string;
  readonly bytes: Bytes;
  readonly tags: readonly string[];
}

/**
 * An in-memory Cloudinary. The array is replaced, never mutated, so the fake
 * itself follows the same rules as the production code.
 */
const createFakeCloud = () => {
  const state: { files: readonly StoredFile[] } = { files: [] };
  const client: CloudinaryClient = {
    list: (tag) =>
      Promise.resolve(state.files.filter((file) => file.tags.includes(tag)).map(({ url }) => url)),
    download: (url) => {
      const file = state.files.find((candidate) => candidate.url === url);
      return file ? Promise.resolve(file.bytes) : Promise.reject(new Error(`404 ${url}`));
    },
    upload: (bytes, tags) => {
      const url = `https://cloud/raw/${state.files.length}`;
      // eslint-disable-next-line functional/immutable-data -- test double
      state.files = [...state.files, { url, bytes, tags }];
      return Promise.resolve(url);
    },
  };
  return { client, files: () => state.files };
};

const deps: RepositoryDeps = {
  toUrl: fakeToUrl,
  newId: () => 'photo-1',
  now: () => new Date('2026-12-12T13:00:00.000Z'),
};

const image = (text: string): EncodedImage => ({
  bytes: utf8(text),
  type: 'image/jpeg',
  width: 4,
  height: 3,
});

const setup = async () => {
  const cloud = createFakeCloud();
  const keys = await deriveEventKeys(generateSecret());
  return { ...cloud, keys, repository: createCloudinaryRepository(cloud.client, keys, deps) };
};

describe('createCloudinaryRepository', () => {
  it('loads an empty event', async () => {
    const { repository } = await setup();
    expect((await repository.load()).photos).toEqual([]);
  });

  it('publishes a profile and a photo that a fresh load can read back', async () => {
    const { repository } = await setup();
    await repository.publishProfile({
      id: 'p1',
      name: ' Júlia ',
      email: 'j@x.cat',
      avatar: image('A'),
    });
    const published = await repository.publishPhoto({
      authorId: 'p1',
      stopId: 's1',
      position: { lat: 41.4, lng: 2.17 },
      full: image('FULL'),
      thumb: image('T'),
    });

    const snapshot = await repository.load();
    expect(snapshot.profiles.get('p1')).toMatchObject({
      name: 'Júlia',
      avatarUrl: 'fake:image/jpeg:1',
    });
    expect(snapshot.photos).toEqual([published]);
    expect(published).toMatchObject({ id: 'photo-1', stopId: 's1', thumbUrl: 'fake:image/jpeg:1' });
  });

  it('never uploads plaintext and leaves full images untagged', async () => {
    const { repository, files, keys } = await setup();
    await repository.publishPhoto({
      authorId: 'p1',
      stopId: null,
      position: null,
      full: image('SECRET-FULL'),
      thumb: image('SECRET-THUMB'),
    });
    const [full, entry] = files();
    expect(full?.tags).toEqual([]);
    expect(entry?.tags).toEqual([keys.tag]);
    const asText = files()
      .map(({ bytes }) => new TextDecoder().decode(bytes))
      .join('');
    expect(asText).not.toContain('SECRET');
  });

  it('opens a full-size photo', async () => {
    const { repository } = await setup();
    const photo = await repository.publishPhoto({
      authorId: 'p1',
      stopId: null,
      position: null,
      full: image('FULL'),
      thumb: image('T'),
    });
    expect(await repository.openPhoto(photo)).toBe('fake:image/jpeg:4');
  });

  it('refuses to open a photo that does not decrypt', async () => {
    const { repository, client } = await setup();
    const url = await client.upload(Uint8Array.of(1, 2, 3), []);
    const photo = await repository.publishPhoto({
      authorId: 'p1',
      stopId: null,
      position: null,
      full: image('F'),
      thumb: image('T'),
    });
    await expect(repository.openPhoto({ ...photo, fullUrl: url })).rejects.toThrow('decrypted');
  });

  it('skips entries from other keys, garbage and failed downloads', async () => {
    const { repository, client, keys } = await setup();
    const strangers = await deriveEventKeys(generateSecret());
    await publishEntry(
      client,
      { ...strangers, tag: keys.tag },
      {
        meta: { kind: 'event', name: 'Intrús' },
        payload: new Uint8Array(0),
      },
    );
    await client.upload(await seal(keys.aes, utf8('not an entry')), [keys.tag]);
    await publishEntry(client, keys, {
      meta: { kind: 'event', name: 'Nostre' },
      payload: new Uint8Array(0),
    });

    const broken: CloudinaryClient = {
      ...client,
      list: async (tag) => [...(await client.list(tag)), 'https://cloud/missing'],
    };
    const snapshot = await createCloudinaryRepository(broken, keys, deps).load();
    expect(snapshot.eventName).toBe('Nostre');
    expect(await repository.load()).toEqual(snapshot);
  });
});
