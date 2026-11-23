import type { CloudinaryClient } from './cloudinary';
import { type EventKeys, open, seal } from './crypto';
import { packEntry, unpackEntry } from './pack';
import {
  buildSnapshot,
  type PhotoView,
  type ProfileView,
  type Snapshot,
  type ToImageUrl,
  toPhotoView,
  toProfileView,
} from './snapshot';
import type { Bytes, Entry, LatLng, Meta, Photo, Profile } from './types';

export interface EncodedImage {
  readonly bytes: Bytes;
  readonly type: string;
  readonly width: number;
  readonly height: number;
}

export interface NewProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly avatar: EncodedImage | null;
}

export interface NewPhoto {
  readonly authorId: string;
  readonly stopId: string | null;
  readonly position: LatLng | null;
  readonly full: EncodedImage;
  readonly thumb: EncodedImage;
}

/** Everything the UI needs, independent of where the data lives. */
export interface EventRepository {
  readonly load: () => Promise<Snapshot>;
  readonly publishProfile: (profile: NewProfile) => Promise<ProfileView>;
  readonly publishPhoto: (photo: NewPhoto) => Promise<PhotoView>;
  /** Resolves with a URL for the full-size image. */
  readonly openPhoto: (photo: Photo) => Promise<string>;
}

export interface RepositoryDeps {
  readonly toUrl: ToImageUrl;
  readonly newId: () => string;
  readonly now: () => Date;
}

const EMPTY: Bytes = new Uint8Array(0);

export const profileEntry = (input: NewProfile, createdAt: Date): Entry<Profile> => ({
  meta: {
    kind: 'profile',
    id: input.id,
    name: input.name.trim(),
    email: input.email.trim(),
    imageType: input.avatar?.type ?? 'image/jpeg',
    createdAt: createdAt.toISOString(),
  },
  payload: input.avatar?.bytes ?? EMPTY,
});

export const photoEntry = (
  input: NewPhoto,
  ids: { readonly id: string; readonly fullUrl: string },
  takenAt: Date,
): Entry<Photo> => ({
  meta: {
    kind: 'photo',
    id: ids.id,
    authorId: input.authorId,
    stopId: input.stopId,
    position: input.position,
    takenAt: takenAt.toISOString(),
    fullUrl: ids.fullUrl,
    imageType: input.full.type,
    width: input.full.width,
    height: input.full.height,
  },
  payload: input.thumb.bytes,
});

/** Packs, encrypts and uploads one entry under the event tag. */
export const publishEntry = async <M extends Meta>(
  client: CloudinaryClient,
  keys: EventKeys,
  entry: Entry<M>,
): Promise<string> => client.upload(await seal(keys.aes, await packEntry(entry)), [keys.tag]);

/** Downloads and decrypts one entry. Anything unreadable resolves to `null`. */
const readEntry = async (
  client: CloudinaryClient,
  keys: EventKeys,
  url: string,
): Promise<Entry | null> => {
  const plain = await open(keys.aes, await client.download(url));
  return plain && unpackEntry(plain);
};

const isEntry = (
  result: PromiseSettledResult<Entry | null>,
): result is PromiseFulfilledResult<Entry> =>
  result.status === 'fulfilled' && result.value !== null;

export const createCloudinaryRepository = (
  client: CloudinaryClient,
  keys: EventKeys,
  deps: RepositoryDeps,
): EventRepository => ({
  load: async () => {
    const urls = await client.list(keys.tag);
    // One broken upload must not hide everybody else's photos.
    const results = await Promise.allSettled(urls.map((url) => readEntry(client, keys, url)));
    return buildSnapshot(
      results.filter(isEntry).map((result) => result.value),
      deps.toUrl,
    );
  },

  publishProfile: async (input) => {
    const entry = profileEntry(input, deps.now());
    await publishEntry(client, keys, entry);
    return toProfileView(entry, deps.toUrl);
  },

  publishPhoto: async (input) => {
    // The full image is uploaded untagged: only its (encrypted) entry links to it.
    const fullUrl = await client.upload(await seal(keys.aes, input.full.bytes), []);
    const entry = photoEntry(input, { id: deps.newId(), fullUrl }, deps.now());
    await publishEntry(client, keys, entry);
    return toPhotoView(entry, deps.toUrl);
  },

  openPhoto: async (photo) => {
    const plain = await open(keys.aes, await client.download(photo.fullUrl));
    if (plain === null) {
      throw new Error('This photo could not be decrypted');
    }
    return deps.toUrl(plain, photo.imageType);
  },
});
