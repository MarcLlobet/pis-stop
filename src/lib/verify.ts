import { fingerprintOf, importPublicKey, verify } from './identity';
import type { Entry, Meta, SignedEntry } from './types';

type OfKind<K extends Meta['kind']> = SignedEntry & { readonly meta: Extract<Meta, { kind: K }> };

const ofKind =
  <K extends Meta['kind']>(kind: K) =>
  (entry: SignedEntry): entry is OfKind<K> =>
    entry.meta.kind === kind;

const filterAsync = async <T>(
  items: readonly T[],
  predicate: (item: T) => Promise<boolean>,
): Promise<readonly T[]> => {
  const keep = await Promise.all(items.map(predicate));
  return items.filter((_, index) => keep[index] === true);
};

const isSignedBy = async (entry: SignedEntry, key: CryptoKey | null | undefined) =>
  key !== null && key !== undefined && verify(key, entry.signature, entry.signedMessage);

/** Imports every distinct public key once. */
const importAll = async (keys: readonly string[]): Promise<ReadonlyMap<string, CryptoKey | null>> =>
  new Map(
    await Promise.all(
      [...new Set(keys)].map(async (key) => [key, await importPublicKey(key)] as const),
    ),
  );

const stripSignature = ({ meta, payload }: SignedEntry): Entry => ({ meta, payload });

/**
 * Keeps only entries whose signature proves who wrote them:
 *
 * - event and stops: signed by the organizer, whose key must match the
 *   fingerprint that came with the invite (not anything read from storage);
 * - profiles: self-signed, and the profile id must be the key's fingerprint;
 * - photos and ratings: signed by the key of the profile they claim as author;
 * - hosts: signed by the organizer, naming the profiles that may run the voting;
 * - rounds (voting opened or closed): signed by one of those host profiles.
 *
 * Everything else is dropped silently. Knowing the group key is enough to
 * write entries, but not to write them in someone else's name.
 */
export const verifyEntries = async (
  entries: readonly SignedEntry[],
  organizer: string,
): Promise<readonly Entry[]> => {
  const events = entries.filter(ofKind('event'));
  const organizerKeys = await filterAsync(
    [...new Set(events.map(({ meta }) => meta.organizerKey))],
    async (key) => (await fingerprintOf(key)) === organizer,
  );
  const organizerKeyText = organizerKeys[0];
  const organizerKey =
    organizerKeyText === undefined ? null : await importPublicKey(organizerKeyText);

  const byOrganizer = await filterAsync(
    entries.filter(
      (entry) =>
        (entry.meta.kind === 'event' && entry.meta.organizerKey === organizerKeyText) ||
        entry.meta.kind === 'stop' ||
        entry.meta.kind === 'host',
    ),
    (entry) => isSignedBy(entry, organizerKey),
  );

  const profiles = entries.filter(ofKind('profile'));
  const profileKeys = await importAll(profiles.map(({ meta }) => meta.publicKey));
  const validProfiles = await filterAsync(
    profiles,
    async (entry) =>
      (await fingerprintOf(entry.meta.publicKey)) === entry.meta.id &&
      (await isSignedBy(entry, profileKeys.get(entry.meta.publicKey))),
  );
  const authorKeys = new Map(
    validProfiles.map(({ meta }) => [meta.id, profileKeys.get(meta.publicKey)] as const),
  );

  const photos = await filterAsync(entries.filter(ofKind('photo')), (entry) =>
    isSignedBy(entry, authorKeys.get(entry.meta.authorId)),
  );

  // Only profiles the organizer named may open and close the voting.
  const hostIds = new Set(
    byOrganizer.flatMap(({ meta }) => (meta.kind === 'host' ? [meta.profileId] : [])),
  );
  const rounds = await filterAsync(
    entries.filter(ofKind('round')),
    async (entry) =>
      hostIds.has(entry.meta.authorId) &&
      (await isSignedBy(entry, authorKeys.get(entry.meta.authorId))),
  );
  const ratings = await filterAsync(entries.filter(ofKind('rating')), (entry) =>
    isSignedBy(entry, authorKeys.get(entry.meta.authorId)),
  );

  return [...byOrganizer, ...validProfiles, ...photos, ...rounds, ...ratings].map(stripSignature);
};
