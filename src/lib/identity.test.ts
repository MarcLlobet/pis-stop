import { describe, expect, it } from 'vitest';

import { toBase64Url, utf8 } from './encoding';
import {
  fingerprint,
  fingerprintOf,
  generateIdentity,
  importPublicKey,
  safetyCode,
  sign,
  SIGNATURE_BYTES,
  verify,
} from './identity';

describe('fingerprint', () => {
  it('matches the documented vector', async () => {
    const key = Uint8Array.from({ length: 65 }, (_, index) => (index === 0 ? 4 : index));
    expect(await fingerprint(key)).toBe('DtOmq5V_9vWaljCkc9MafQ');
    expect(await fingerprintOf(toBase64Url(key))).toBe('DtOmq5V_9vWaljCkc9MafQ');
  });

  it('refuses keys of the wrong size', async () => {
    expect(await fingerprintOf(toBase64Url(new Uint8Array(10)))).toBeNull();
    expect(await fingerprintOf('***')).toBeNull();
  });
});

describe('generateIdentity', () => {
  it('creates a self-certifying, non-extractable identity', async () => {
    const identity = await generateIdentity();
    expect(identity.id).toBe(await fingerprintOf(identity.publicKey));
    expect(identity.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('pkcs8', identity.privateKey)).rejects.toThrow();
  });

  it('can create an extractable identity for the organizer CLI', async () => {
    expect((await generateIdentity(true)).privateKey.extractable).toBe(true);
  });
});

describe('sign / verify', () => {
  it('accepts a valid signature and rejects any change', async () => {
    const identity = await generateIdentity();
    const key = (await importPublicKey(identity.publicKey))!;
    const message = utf8('Foto de la Júlia a cal Biel');
    const signature = await sign(identity.privateKey, message);

    expect(signature).toHaveLength(SIGNATURE_BYTES);
    expect(await verify(key, signature, message)).toBe(true);
    expect(await verify(key, signature, utf8('Foto del Biel a cal Biel'))).toBe(false);
    expect(await verify(key, signature.slice(1), message)).toBe(false);
  });

  it('rejects signatures from someone else', async () => {
    const alice = await generateIdentity();
    const mallory = await generateIdentity();
    const message = utf8('hola');
    const aliceKey = (await importPublicKey(alice.publicKey))!;
    expect(await verify(aliceKey, await sign(mallory.privateKey, message), message)).toBe(false);
  });

  it('only imports valid P-256 points', async () => {
    expect(await importPublicKey(toBase64Url(new Uint8Array(65)))).toBeNull();
    expect(await importPublicKey('short')).toBeNull();
  });
});

describe('safetyCode', () => {
  it('shows the first 4 bytes as two groups', () => {
    expect(safetyCode('DtOmq5V_9vWaljCkc9MafQ')).toBe('0ED3 A6AB');
    expect(safetyCode('***')).toBe('????');
  });
});
