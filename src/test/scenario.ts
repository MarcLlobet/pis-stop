/**
 * The people and places of a test correpisos, shared by the end-to-end tests
 * of the library (correpisos.journey.test.ts) and of the screens
 * (app.journey.test.tsx). Everything runs against the in-memory Cloudinary of
 * fake-cloudinary.ts, with real cryptography.
 */
import { expect } from 'vitest';

import { type CloudinaryClient, createCloudinaryClient } from '../lib/cloudinary';
import { createPresetRequest, parseAdminCredentials, presetName } from '../lib/cloudinary-admin';
import { deriveEventKeys, generateSecret } from '../lib/crypto';
import { toHex, utf8 } from '../lib/encoding';
import { eventEntries, type EventFile } from '../lib/event-file';
import { fingerprintOf, generateIdentity, type Identity } from '../lib/identity';
import { buildInviteUrl } from '../lib/invite';
import { createMemoryKeyStore, type KeyStore } from '../lib/key-store';
import {
  createCloudinaryRepository,
  type EncodedImage,
  type EventRepository,
  publishEntry,
  type RepositoryDeps,
} from '../lib/repository';
import { resolveSession } from '../lib/session';
import type { Bytes, LatLng } from '../lib/types';
import { createFakeCloudinary, type FakeCloudinary } from './fake-cloudinary';
import { jpeg } from './fixtures';

export const CLOUD = 'correpisos';
export const APP_URL = 'https://marcllobet.github.io/pis-stop/';
/** The default preset of the web build: never created here, so any use of it fails. */
export const SHARED_PRESET = 'shared_default';
export const ADMIN =
  parseAdminCredentials({
    VITE_CLOUDINARY_CLOUD_NAME: CLOUD,
    CLOUDINARY_API_KEY: '123456789012345',
    CLOUDINARY_API_SECRET: 'not_a-real-secret',
  }) ?? expect.unreachable();

export const CORREPISOS: EventFile = {
  name: 'Correpisos 2026',
  stops: [
    { name: 'Pis de la Júlia, carrer de Verdi', lat: 41.403_61, lng: 2.157_12 },
    { name: 'Pis d’en Pau, carrer de Blai', lat: 41.372_93, lng: 2.162_54 },
  ],
  legs: [],
};

export const CALCOTADA: EventFile = {
  name: 'Calçotada a Valls',
  stops: [{ name: 'Masia dels avis', lat: 41.286_4, lng: 1.249_8 }],
  legs: [],
};

/** Images keep their bytes in the URL, so a test can check exactly what was decrypted. */
export const deps: RepositoryDeps = {
  toUrl: (bytes, type) => `bytes:${type}:${toHex(bytes)}`,
  newId: () => crypto.randomUUID(),
  now: () => new Date('2026-12-12T20:30:00.000Z'),
};

export const image = (marker: string): EncodedImage => ({
  bytes: jpeg(...utf8(marker)),
  type: 'image/jpeg',
  width: 4,
  height: 3,
});

export const AT_JULIAS: LatLng = { lat: 41.403_6, lng: 2.157_1 };
export const AT_PAUS: LatLng = { lat: 41.372_9, lng: 2.162_5 };

export const clientOf = (cloud: FakeCloudinary): CloudinaryClient =>
  createCloudinaryClient({ cloudName: CLOUD, uploadPreset: SHARED_PRESET }, cloud.fetch);

/** What `pnpm event:create` does, step by step, against the fake Cloudinary. */
export const createEvent = async (cloud: FakeCloudinary, file: EventFile) => {
  const organizer = await generateIdentity(true);
  const fingerprint = (await fingerprintOf(organizer.publicKey)) ?? expect.unreachable();
  const secret = generateSecret();
  const preset = presetName(crypto.getRandomValues(new Uint8Array(16)));
  const { url, init } = createPresetRequest(ADMIN, preset);
  expect((await cloud.fetch(url, init)).ok).toBe(true);

  const keys = await deriveEventKeys(secret, fingerprint);
  const client = clientOf(cloud);
  await eventEntries(file, organizer.publicKey, preset).reduce(async (previous, entry) => {
    await previous;
    await publishEntry(client, keys, entry, organizer.privateKey, preset);
  }, Promise.resolve());

  return { invite: buildInviteUrl(APP_URL, { secret, organizer: fingerprint }), secret, preset };
};

export interface Phone {
  readonly store: KeyStore;
  readonly client: CloudinaryClient;
}

export const newPhone = (cloud: FakeCloudinary): Phone => ({
  store: createMemoryKeyStore(),
  client: clientOf(cloud),
});

/** Opens an invite link the way the app does (only the `#…` part is read) and loads the event. */
export const openLink = async (phone: Phone, link: string) => {
  const { session, events, fromInvite } = await resolveSession(new URL(link).hash, phone.store);
  if (session.kind !== 'event') {
    return expect.unreachable();
  }
  const repository = createCloudinaryRepository(phone.client, session.keys, deps);
  const snapshot = await repository.load();
  return { session, events, fromInvite, repository, snapshot };
};

export const join = async (repository: EventRepository, name: string): Promise<Identity> => {
  const identity = await generateIdentity();
  await repository.publishProfile(identity, {
    name,
    email: `${name.toLowerCase()}@example.cat`,
    avatar: image(`AVATAR-OF-${name}`),
  });
  return identity;
};

export const contains = (haystack: Bytes, needle: Bytes): boolean =>
  Array.from(
    { length: Math.max(0, haystack.length - needle.length + 1) },
    (_, index) => index,
  ).some((start) => needle.every((byte, offset) => haystack[start + offset] === byte));

/** Marc creates the event; Júlia joins with the QR and posts; she invites Pau, who posts too. */
export const party = async () => {
  const cloud = createFakeCloudinary(CLOUD, ADMIN);
  const event = await createEvent(cloud, CORREPISOS);

  const juliasPhone = newPhone(cloud);
  const julia = await openLink(juliasPhone, event.invite);
  const juliaId = await join(julia.repository, 'Júlia');
  const juliasPhoto = await julia.repository.publishPhoto(juliaId, {
    position: AT_JULIAS,
    full: image('FULL-PIXELS-OF-JULIA'),
    thumb: image('THUMB-OF-JULIA'),
  });

  // Júlia shows her QR to Pau, from her own phone.
  const juliasInvite = julia.session.invite ?? expect.unreachable();
  const pausPhone = newPhone(cloud);
  const pau = await openLink(pausPhone, buildInviteUrl(APP_URL, juliasInvite));
  const pauId = await join(pau.repository, 'Pau');
  await pau.repository.publishPhoto(pauId, {
    position: AT_PAUS,
    full: image('FULL-PIXELS-OF-PAU'),
    thumb: image('THUMB-OF-PAU'),
  });

  return { cloud, event, julia, juliaId, juliasPhoto, juliasPhone, pau, pauId, pausPhone };
};
