import { describe, expect, it } from 'vitest';

import { deriveEventKeys, ENTRY, generateSecret, open, seal } from './crypto';
import { utf8 } from './encoding';
import { generateIdentity, importPublicKey, SIGNATURE_BYTES } from './identity';
import {
  isExpired,
  isStale,
  type LocationPing,
  openPing,
  packPing,
  type PublicKeyOf,
  sealPing,
  unpackPing,
} from './location';

const aesFor = async () => (await deriveEventKeys(generateSecret(), 'organizer')).aes;

const ping = (overrides: Partial<LocationPing> = {}) => ({
  authorId: 'anna',
  position: { lat: 41.4, lng: 2.17 },
  at: new Date('2026-12-12T20:00:00.000Z'),
  ...overrides,
});

describe('signedMessageOf / packPing / unpackPing', () => {
  it('round-trips a ping, including boundary coordinates', async () => {
    const boundary = ping({ position: { lat: 90, lng: -180 } });
    const identity = await generateIdentity();
    const packed = await packPing(boundary, identity.privateKey);
    const unpacked = unpackPing(packed)!;
    expect(unpacked.ping).toEqual(boundary);
    expect(unpacked.signature).toHaveLength(SIGNATURE_BYTES);
  });

  it('rejects truncated or empty bytes', () => {
    expect(unpackPing(new Uint8Array(0))).toBeNull();
    expect(unpackPing(new Uint8Array(SIGNATURE_BYTES + 24))).toBeNull();
  });

  it('rejects out-of-range coordinates and a missing author', async () => {
    const identity = await generateIdentity();
    const tooFarNorth = await packPing(
      ping({ position: { lat: 91, lng: 0 } }),
      identity.privateKey,
    );
    expect(unpackPing(tooFarNorth)).toBeNull();

    const tooFarEast = await packPing(
      ping({ position: { lat: 0, lng: 181 } }),
      identity.privateKey,
    );
    expect(unpackPing(tooFarEast)).toBeNull();

    const noAuthor = await packPing(ping({ authorId: '' }), identity.privateKey);
    expect(unpackPing(noAuthor)).toBeNull();
  });
});

describe('sealPing / openPing', () => {
  const publicKeyOfFor =
    (identities: Readonly<Record<string, { readonly publicKey: string }>>): PublicKeyOf =>
    async (authorId) => {
      const identity = identities[authorId];
      return identity === undefined ? null : importPublicKey(identity.publicKey);
    };

  it('round-trips a genuine ping from a known author', async () => {
    const aes = await aesFor();
    const anna = await generateIdentity();
    const message = ping({ authorId: anna.id });
    const sealed = await sealPing(aes, anna.privateKey, message);

    expect(await openPing(aes, sealed, publicKeyOfFor({ [anna.id]: anna }))).toEqual(message);
  });

  it('rejects a ping sealed under a different event key', async () => {
    const anna = await generateIdentity();
    const sealed = await sealPing(await aesFor(), anna.privateKey, ping({ authorId: anna.id }));
    expect(await openPing(await aesFor(), sealed, publicKeyOfFor({ [anna.id]: anna }))).toBeNull();
  });

  it('rejects an author nobody recognises', async () => {
    const aes = await aesFor();
    const anna = await generateIdentity();
    const sealed = await sealPing(aes, anna.privateKey, ping({ authorId: anna.id }));
    expect(await openPing(aes, sealed, publicKeyOfFor({}))).toBeNull();
  });

  it('rejects a ping claiming to be someone it was not signed by', async () => {
    // Mallory has the shared Ably key and AES key (same trust level as everyone
    // else), but not Anna's private key: she cannot forge a ping as Anna.
    const aes = await aesFor();
    const anna = await generateIdentity();
    const mallory = await generateIdentity();
    const sealed = await sealPing(aes, mallory.privateKey, ping({ authorId: anna.id }));
    expect(await openPing(aes, sealed, publicKeyOfFor({ [anna.id]: anna }))).toBeNull();
  });

  it('is bound to the location purpose: not an entry, and not opened as one', async () => {
    const aes = await aesFor();
    const anna = await generateIdentity();
    const sealed = await sealPing(aes, anna.privateKey, ping({ authorId: anna.id }));
    expect(await open(aes, sealed, ENTRY)).toBeNull();

    const entry = await seal(aes, utf8('Vermut'), ENTRY);
    expect(await openPing(aes, entry, publicKeyOfFor({ [anna.id]: anna }))).toBeNull();
  });
});

describe('isStale / isExpired', () => {
  it('judges freshness from the recipient clock, not the sender one', () => {
    const receivedAt = 1_000_000;
    expect(isStale(receivedAt, receivedAt + 1_000)).toBe(false);
    expect(isStale(receivedAt, receivedAt + 91_000)).toBe(true);
    expect(isExpired(receivedAt, receivedAt + 90_000)).toBe(false);
    expect(isExpired(receivedAt, receivedAt + 5 * 60_000 + 1)).toBe(true);
  });
});
