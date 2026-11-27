import { describe, expect, it } from 'vitest';

import { photoMeta, profileMeta, stopEntry } from '../test/fixtures';
import { generateIdentity, type Identity } from './identity';
import { packSigned, unpackSigned } from './pack';
import type { Entry, SignedEntry } from './types';
import { verifyEntries } from './verify';

const signed = async (entry: Entry, signer: Identity): Promise<SignedEntry> =>
  unpackSigned(await packSigned(entry, signer.privateKey))!;

const none = new Uint8Array(0);

const setup = async () => {
  const organizer = await generateIdentity();
  const anna = await generateIdentity();
  const mallory = await generateIdentity();
  const event: Entry = {
    meta: { kind: 'event', name: 'Correpisos', organizerKey: organizer.publicKey, legs: [] },
    payload: none,
  };
  const profile = (who: Identity, name: string): Entry => ({
    meta: profileMeta(who.id, { publicKey: who.publicKey, name }),
    payload: none,
  });
  const photo = (id: string, authorId: string): Entry => ({
    meta: photoMeta(id, { authorId }),
    payload: none,
  });
  return { organizer, anna, mallory, event, profile, photo };
};

const kinds = (entries: readonly Entry[]) =>
  entries.map(({ meta }) => {
    if ('id' in meta) {
      return `${meta.kind}:${meta.id}`;
    }
    return `${meta.kind}:${'name' in meta ? meta.name : meta.profileId}`;
  });

describe('verifyEntries', () => {
  it('keeps correctly signed event, stops, profiles and photos', async () => {
    const { organizer, anna, event, profile, photo } = await setup();
    const result = await verifyEntries(
      [
        await signed(event, organizer),
        await signed(stopEntry('s1', 1), organizer),
        await signed(profile(anna, 'Anna'), anna),
        await signed(photo('ph1', anna.id), anna),
      ],
      organizer.id,
    );
    expect(kinds(result)).toEqual([
      'event:Correpisos',
      'stop:s1',
      `profile:${anna.id}`,
      'photo:ph1',
    ]);
  });

  it('ignores an organizer whose key does not match the invite', async () => {
    const { organizer, mallory } = await setup();
    const fakeEvent: Entry = {
      meta: { kind: 'event', name: 'Fals', organizerKey: mallory.publicKey, legs: [] },
      payload: none,
    };
    const result = await verifyEntries(
      [await signed(fakeEvent, mallory), await signed(stopEntry('s9', 1), mallory)],
      organizer.id,
    );
    expect(result).toEqual([]);
  });

  it('rejects stops not signed by the organizer', async () => {
    const { organizer, mallory, event } = await setup();
    const result = await verifyEntries(
      [await signed(event, organizer), await signed(stopEntry('s9', 1), mallory)],
      organizer.id,
    );
    expect(kinds(result)).toEqual(['event:Correpisos']);
  });

  it('rejects a profile that claims an id it does not own', async () => {
    const { organizer, anna, mallory } = await setup();
    const impostor: Entry = {
      meta: profileMeta(anna.id, { publicKey: mallory.publicKey, name: 'Anna' }),
      payload: none,
    };
    expect(await verifyEntries([await signed(impostor, mallory)], organizer.id)).toEqual([]);
  });

  it('rejects a profile signed by a different key than the one it carries', async () => {
    const { organizer, anna, mallory, profile } = await setup();
    expect(
      await verifyEntries([await signed(profile(anna, 'Anna'), mallory)], organizer.id),
    ).toEqual([]);
  });

  it('rejects photos posted in someone else’s name or without a profile', async () => {
    const { organizer, anna, mallory, profile, photo } = await setup();
    const result = await verifyEntries(
      [
        await signed(profile(anna, 'Anna'), anna),
        await signed(photo('forged', anna.id), mallory),
        await signed(photo('orphan', mallory.id), mallory),
      ],
      organizer.id,
    );
    expect(kinds(result)).toEqual([`profile:${anna.id}`]);
  });

  it('rejects anything whose bytes changed after signing', async () => {
    const { organizer, anna, profile } = await setup();
    const entry = await signed(profile(anna, 'Anna'), anna);
    const tampered: SignedEntry = {
      ...entry,
      signedMessage: entry.signedMessage.map((byte, index) => (index === 10 ? byte ^ 1 : byte)),
    };
    expect(await verifyEntries([tampered], organizer.id)).toEqual([]);
  });

  describe('voting', () => {
    const at = '2026-12-12T20:00:00.000Z';
    const scores = { presentation: 5, originality: 4, taste: 3, craft: 2 };
    const host = (profileId: string): Entry => ({
      meta: { kind: 'host', profileId, grantedAt: at },
      payload: none,
    });
    const round = (id: string, authorId: string): Entry => ({
      meta: { kind: 'round', id, authorId, stopId: 's1', status: 'open', at },
      payload: none,
    });
    const rating = (id: string, authorId: string): Entry => ({
      meta: { kind: 'rating', id, authorId, stopId: 's1', scores, at },
      payload: none,
    });

    it('lets a host the organizer named open the voting', async () => {
      const { organizer, anna, event, profile } = await setup();
      const result = await verifyEntries(
        [
          await signed(event, organizer),
          await signed(host(anna.id), organizer),
          await signed(profile(anna, 'Anna'), anna),
          await signed(round('r1', anna.id), anna),
        ],
        organizer.id,
      );
      expect(kinds(result)).toContain('round:r1');
      expect(kinds(result)).toContain(`host:${anna.id}`);
    });

    it('ignores a host grant the organizer did not sign', async () => {
      const { organizer, mallory, event, profile } = await setup();
      const result = await verifyEntries(
        [
          await signed(event, organizer),
          await signed(host(mallory.id), mallory),
          await signed(profile(mallory, 'Mallory'), mallory),
          await signed(round('r1', mallory.id), mallory),
        ],
        organizer.id,
      );
      expect(kinds(result)).toEqual(['event:Correpisos', `profile:${mallory.id}`]);
    });

    it('ignores a round from someone who is not a host, or signed by another key', async () => {
      const { organizer, anna, mallory, event, profile } = await setup();
      const result = await verifyEntries(
        [
          await signed(event, organizer),
          await signed(host(anna.id), organizer),
          await signed(profile(anna, 'Anna'), anna),
          await signed(profile(mallory, 'Mallory'), mallory),
          await signed(round('not-a-host', mallory.id), mallory),
          await signed(round('forged', anna.id), mallory),
        ],
        organizer.id,
      );
      expect(kinds(result).filter((kind) => kind.startsWith('round'))).toEqual([]);
    });

    it('keeps a rating only if its author signed it', async () => {
      const { organizer, anna, mallory, profile } = await setup();
      const result = await verifyEntries(
        [
          await signed(profile(anna, 'Anna'), anna),
          await signed(profile(mallory, 'Mallory'), mallory),
          await signed(rating('mine', anna.id), anna),
          await signed(rating('forged', anna.id), mallory),
          await signed(rating('orphan', 'nobody'), mallory),
        ],
        organizer.id,
      );
      expect(kinds(result).filter((kind) => kind.startsWith('rating'))).toEqual(['rating:mine']);
    });
  });
});
