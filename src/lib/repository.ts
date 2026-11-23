import type { CloudinaryClient } from './cloudinary';
import { ENTRY, type EventKeys, open, seal, sha256Hex } from './crypto';
import type { Identity } from './identity';
import { packSigned, unpackSigned } from './pack';
import {
  buildSnapshot,
  type PhotoView,
  type ProfileView,
  type Snapshot,
  type ToImageUrl,
  toPhotoView,
  toProfileView,
} from './snapshot';
import type { Bytes, Entry, LatLng, Meta, Photo, Profile, SignedEntry } from './types';
import { verifyEntries } from './verify';

export interface EncodedImage {
  readonly bytes: Bytes;
  readonly type: string;
  readonly width: number;
  readonly height: number;
}

export interface NewProfile {
  readonly name: string;
  readonly email: string;
  readonly avatar: EncodedImage | null;
}

export interface NewPhoto {
  readonly stopId: string | null;
  readonly position: LatLng | null;
  readonly full: EncodedImage;
  readonly thumb: EncodedImage;
}

/** Everything the UI needs, independent of where the data lives. */
export interface EventRepository {
  readonly load: () => Promise<Snapshot>;
  readonly publishProfile: (identity: Identity, profile: NewProfile) => Promise<ProfileView>;
  readonly publishPhoto: (identity: Identity, photo: NewPhoto) => Promise<PhotoView>;
  /** Resolves with a URL for the full-size image. */
  readonly openPhoto: (photo: Photo) => Promise<string>;
}

export interface RepositoryDeps {
  readonly toUrl: ToImageUrl;
  readonly newId: () => string;
  readonly now: () => Date;
}

/** Hard limits: a group member must not be able to exhaust everyone's memory. */
export const MAX_ENTRY_BYTES = 1024 * 1024;
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

const EMPTY: Bytes = new Uint8Array(0);

/** Images from the network must start with the JPEG magic number. */
export const isJpeg = (bytes: Bytes): boolean =>
  bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

export const profileEntry = (
  identity: Pick<Identity, 'id' | 'publicKey'>,
  input: NewProfile,
  createdAt: Date,
): Entry<Profile> => ({
  meta: {
    kind: 'profile',
    id: identity.id,
    publicKey: identity.publicKey,
    name: input.name.trim().slice(0, 80),
    email: input.email.trim().slice(0, 254),
    imageType: input.avatar?.type ?? 'image/jpeg',
    createdAt: createdAt.toISOString(),
  },
  payload: input.avatar?.bytes ?? EMPTY,
});

export const photoEntry = (
  authorId: string,
  input: NewPhoto,
  full: { readonly id: string; readonly url: string; readonly sha256: string },
  takenAt: Date,
): Entry<Photo> => ({
  meta: {
    kind: 'photo',
    id: full.id,
    authorId,
    stopId: input.stopId,
    position: input.position,
    takenAt: takenAt.toISOString(),
    fullUrl: full.url,
    fullSha256: full.sha256,
    imageType: input.full.type,
    width: input.full.width,
    height: input.full.height,
  },
  payload: input.thumb.bytes,
});

/** Signs, encrypts and uploads one entry under the event tag. */
export const publishEntry = async <M extends Meta>(
  client: CloudinaryClient,
  keys: EventKeys,
  entry: Entry<M>,
  signer: CryptoKey,
): Promise<string> =>
  client.upload(await seal(keys.aes, await packSigned(entry, signer), ENTRY), [keys.tag]);

/** Downloads and decrypts one entry. Anything unreadable resolves to `null`. */
const readEntry = async (
  client: CloudinaryClient,
  keys: EventKeys,
  url: string,
): Promise<SignedEntry | null> => {
  const plain = await open(keys.aes, await client.download(url, MAX_ENTRY_BYTES), ENTRY);
  return plain && unpackSigned(plain);
};

/** Drops entries that would make the app show non-JPEG data or fetch foreign URLs. */
const isSafe =
  (client: CloudinaryClient) =>
  ({ meta, payload }: Entry): boolean => {
    switch (meta.kind) {
      case 'photo':
        return isJpeg(payload) && client.owns(meta.fullUrl);
      case 'profile':
        return payload.length === 0 || isJpeg(payload);
      case 'event':
      case 'stop':
        return true;
    }
  };

const isEntry = <T>(result: PromiseSettledResult<T | null>): result is PromiseFulfilledResult<T> =>
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
    const verified = await verifyEntries(
      results.filter(isEntry).map((result) => result.value),
      keys.organizer,
    );
    return buildSnapshot(verified.filter(isSafe(client)), deps.toUrl);
  },

  publishProfile: async (identity, input) => {
    const entry = profileEntry(identity, input, deps.now());
    await publishEntry(client, keys, entry, identity.privateKey);
    return toProfileView(entry, deps.toUrl);
  },

  publishPhoto: async (identity, input) => {
    const id = deps.newId();
    // The full image is uploaded untagged and bound to this photo id: only the
    // signed entry below points to it, and it cannot be reused for another photo.
    const [url, sha256] = await Promise.all([
      seal(keys.aes, input.full.bytes, { kind: 'photo', photoId: id }).then((sealed) =>
        client.upload(sealed, []),
      ),
      sha256Hex(input.full.bytes),
    ]);
    const entry = photoEntry(identity.id, input, { id, url, sha256 }, deps.now());
    await publishEntry(client, keys, entry, identity.privateKey);
    return toPhotoView(entry, deps.toUrl);
  },

  openPhoto: async (photo) => {
    const plain = await open(keys.aes, await client.download(photo.fullUrl, MAX_PHOTO_BYTES), {
      kind: 'photo',
      photoId: photo.id,
    });
    if (plain === null || !isJpeg(plain) || (await sha256Hex(plain)) !== photo.fullSha256) {
      throw new Error('This photo failed its integrity check');
    }
    return deps.toUrl(plain, 'image/jpeg');
  },
});
