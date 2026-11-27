/**
 * SECURITY.md, claim by claim. Each `describe` is one promise the app makes,
 * tested against the production code with real cryptography: an organizer,
 * friends who cheat, an outsider, and a server that misbehaves (the in-memory
 * Cloudinary of fake-cloudinary.ts, which keeps every byte it receives).
 *
 * If a claim in SECURITY.md changes, a test here should change with it.
 */
import { describe, expect, it } from 'vitest';

import { deletePresetRequest } from '../lib/cloudinary-admin';
import { deriveEventKeys, ENTRY, generateSecret, open, seal } from '../lib/crypto';
import { concatBytes, toBase64Url, toHex, utf8 } from '../lib/encoding';
import { generateIdentity, safetyCode } from '../lib/identity';
import { buildInviteUrl, readInvite } from '../lib/invite';
import { createMemoryKeyStore } from '../lib/key-store';
import { openPing, profileKeys, sealPing } from '../lib/location';
import { signedMessageOf, unpackSigned } from '../lib/pack';
import { padme } from '../lib/padding';
import {
  createCloudinaryRepository,
  MAX_ENTRY_BYTES,
  photoEntry,
  publishEntry,
} from '../lib/repository';
import { leaveEvent, openInvite, resolveSession } from '../lib/session';
import type { Bytes, Entry, SignedEntry } from '../lib/types';
import { createFakeCloudinary } from './fake-cloudinary';
import {
  ADMIN,
  APP_URL,
  AT_PAUS,
  CALCOTADA,
  CLOUD,
  contains,
  CORREPISOS,
  createEvent,
  deps,
  image,
  join,
  newPhone,
  openLink,
  party,
} from './scenario';

const EMPTY = new Uint8Array(0);

/** What a member can do with the group key: read every stored entry. */
const decryptAll = async (
  files: readonly { readonly bytes: Bytes }[],
  aes: CryptoKey,
): Promise<readonly SignedEntry[]> => {
  const opened = await Promise.all(files.map(({ bytes }) => open(aes, bytes, ENTRY)));
  return opened.flatMap((plain) => {
    const entry = plain === null ? null : unpackSigned(plain);
    return entry === null ? [] : [entry];
  });
};

/** A member re-uses someone else's signature on changed content, and seals it with the group key. */
const sealWithSignature = async (aes: CryptoKey, signature: Bytes, entry: Entry): Promise<Bytes> =>
  seal(aes, await concatBytes([signature, await signedMessageOf(entry)]), ENTRY);

describe('la clau del grup només viatja dins l’enllaç', () => {
  it('va al fragment (#), que el navegador no envia mai al servidor', () => {
    const secret = generateSecret();
    const url = new URL(
      buildInviteUrl(`${APP_URL}?utm=x#vell`, { secret, organizer: 'A'.repeat(22) }),
    );
    expect(url.search).toBe('');
    expect(`${url.origin}${url.pathname}`).not.toContain(toBase64Url(secret));
    expect(readInvite(url.hash)?.secret).toEqual(secret);
  });

  it('cap petició a Cloudinary no porta el secret, el fragment ni l’empremta de l’organitzador', async () => {
    const { cloud, event } = await party();
    const invite = readInvite(new URL(event.invite).hash) ?? expect.unreachable();
    cloud.log().forEach(({ url, body }) => {
      expect(url).not.toContain('#');
      expect(url).not.toContain(toBase64Url(event.secret));
      expect(contains(body, event.secret)).toBe(false);
      expect(contains(body, utf8(toBase64Url(event.secret)))).toBe(false);
      expect(contains(body, utf8(invite.organizer))).toBe(false);
    });
  });

  it('el tag per trobar les dades no revela res del secret', async () => {
    const secret = generateSecret();
    const { tag } = await deriveEventKeys(secret, 'A'.repeat(22));
    expect(tag).toMatch(/^ps_[0-9a-f]{64}$/);
    expect(tag).not.toContain(toHex(secret).slice(0, 8));
  });

  it('les claus del mòbil no es poden exportar, ni des de la mateixa pàgina', async () => {
    const { aes } = await deriveEventKeys(generateSecret(), 'A'.repeat(22));
    const member = await generateIdentity();
    await expect(crypto.subtle.exportKey('raw', aes)).rejects.toThrow();
    await expect(crypto.subtle.exportKey('jwk', member.privateKey)).rejects.toThrow();
  });
});

describe('Cloudinary només guarda soroll', () => {
  it('cada fitxer és xifrat amb el format v1 i un IV diferent', async () => {
    const { cloud } = await party();
    const files = cloud.files();
    expect(files.length).toBeGreaterThan(8);
    files.forEach(({ bytes }) => {
      expect(bytes[0]).toBe(1);
    });
    const ivs = new Set(files.map(({ bytes }) => toHex(bytes.slice(1, 13))));
    expect(ivs.size).toBe(files.length);
  });

  it('cap nom, correu, adreça, coordenada, preset ni píxel no hi és en clar', async () => {
    const { cloud, event } = await party();
    const secrets = [
      'Correpisos 2026',
      'carrer de Verdi',
      'Júlia',
      'júlia@example.cat',
      'pau@example.cat',
      '41.4036',
      '2.1571',
      event.preset,
      'FULL-PIXELS-OF-JULIA',
      'THUMB-OF-JULIA',
      'AVATAR-OF-Pau',
    ].map(utf8);
    // Everything stored, and every request, except the organizer's own Admin API calls.
    const fromPhones = cloud.log().filter(({ url }) => !url.includes('/upload_presets'));
    [...cloud.files().map(({ bytes }) => bytes), ...fromPhones.map(({ body }) => body)].forEach(
      (bytes) => {
        secrets.forEach((secret) => {
          expect(contains(bytes, secret)).toBe(false);
        });
      },
    );
  });

  it('la mida no delata el contingut: tot s’arrodoneix a mides Padmé', async () => {
    const cloud = createFakeCloudinary(CLOUD, ADMIN);
    const event = await createEvent(cloud, CORREPISOS);
    const { repository } = await openLink(newPhone(cloud), event.invite);
    const before = cloud.files().length;
    const names = [
      'A',
      'Bo',
      'Cai',
      'Dani',
      'Elena',
      'Ferran',
      'Gemma B',
      'Hug Bosc',
      'Ivet Mira',
      'Jan Riera',
    ];
    await names.reduce(async (previous, name) => {
      await previous;
      await join(repository, name);
    }, Promise.resolve());

    // version (1) + IV (12) + padded plaintext + GCM tag (16)
    const OVERHEAD = 1 + 12 + 16;
    cloud.files().forEach(({ bytes }) => {
      expect(padme(bytes.length - OVERHEAD)).toBe(bytes.length - OVERHEAD);
    });
    // Ten profiles of ten different lengths: only three sizes on the server.
    const added = cloud.files().slice(before);
    const sizes = new Set(added.map(({ bytes }) => bytes.length));
    expect(sizes.size).toBeLessThanOrEqual(3);
  });

  it('un fitxer només s’obre per a allò per al qual es va xifrar', async () => {
    const { cloud, julia, juliasPhoto } = await party();
    const { aes } = julia.session.keys;
    const full =
      cloud.files().find(({ url }) => url === juliasPhoto.fullUrl) ?? expect.unreachable();
    // A full photo is not an entry...
    expect(await open(aes, full.bytes, ENTRY)).toBeNull();
    // ...nor the photo of another id.
    expect(await open(aes, full.bytes, { kind: 'photo', photoId: crypto.randomUUID() })).toBeNull();
    expect(await open(aes, full.bytes, { kind: 'photo', photoId: juliasPhoto.id })).not.toBeNull();
  });
});

describe('ningú no pot signar en nom d’un altre, ni tan sols amb la clau del grup', () => {
  it('ignora pisos, events, perfils i fotos que no estan ben signats', async () => {
    const { pau, pauId, pausPhone, juliaId, julia, juliasPhoto, event } = await party();
    const asPau = (entry: Entry) =>
      publishEntry(pausPhone.client, pau.session.keys, entry, pauId.privateKey, event.preset);

    await asPau({
      meta: { kind: 'stop', id: 'trampa', name: 'Pis trampa', order: 0, position: AT_PAUS },
      payload: EMPTY,
    });
    await asPau({
      meta: {
        kind: 'event',
        name: 'Correpisos del Pau',
        organizerKey: pauId.publicKey,
        legs: [],
        uploadPreset: 'ps_preset_del_pau',
      },
      payload: EMPTY,
    });
    await asPau({
      meta: {
        kind: 'profile',
        id: juliaId.id,
        publicKey: pauId.publicKey,
        name: 'Júlia (de veritat)',
        email: 'trampa@example.cat',
        imageType: 'image/jpeg',
        createdAt: '2026-12-12T23:00:00.000Z',
      },
      payload: EMPTY,
    });
    await asPau(
      photoEntry(
        juliaId.id,
        { position: AT_PAUS, full: image('X'), thumb: image('X') },
        { id: crypto.randomUUID(), url: juliasPhoto.fullUrl, sha256: juliasPhoto.fullSha256 },
        new Date(),
      ),
    );

    const snapshot = await julia.repository.load();
    expect(snapshot.eventName).toBe('Correpisos 2026');
    expect(snapshot.uploadPreset).toBe(event.preset);
    expect(snapshot.stops.map(({ name }) => name)).not.toContain('Pis trampa');
    expect(snapshot.profiles.get(juliaId.id)?.name).toBe('Júlia');
    expect(snapshot.photos.filter(({ authorId }) => authorId === juliaId.id)).toHaveLength(1);
  });

  it('ignora una entrada d’un altre amb el contingut canviat i la signatura original', async () => {
    const { cloud, pau, pausPhone, juliaId, julia, event } = await party();
    const { aes } = pau.session.keys;
    const entries = await decryptAll(cloud.files(), aes);
    const original =
      entries.find(({ meta }) => meta.kind === 'profile' && meta.id === juliaId.id) ??
      expect.unreachable();
    if (original.meta.kind !== 'profile') {
      return expect.unreachable();
    }
    const forged = await sealWithSignature(aes, original.signature, {
      meta: {
        ...original.meta,
        name: 'Júlia, que deu 20 €',
        createdAt: '2027-01-01T00:00:00.000Z',
      },
      payload: original.payload,
    });
    await pausPhone.client.upload(forged, [pau.session.keys.tag], event.preset);

    expect((await julia.repository.load()).profiles.get(juliaId.id)?.name).toBe('Júlia');
  });

  it('un membre no pot fer passar la foto d’un altre com a seva', async () => {
    const { pau, pauId, juliasPhoto } = await party();
    // Pau can read Júlia's full photo and knows its hash, but it is bound to her photo id.
    const copy = photoEntry(
      pauId.id,
      { position: AT_PAUS, full: image('FULL-PIXELS-OF-JULIA'), thumb: image('THUMB') },
      { id: crypto.randomUUID(), url: juliasPhoto.fullUrl, sha256: juliasPhoto.fullSha256 },
      new Date(),
    );
    await expect(pau.repository.openPhoto(copy.meta)).rejects.toThrow('integrity');
  });

  it('cada persona té un codi de seguretat estable i diferent', async () => {
    const [a, b] = await Promise.all([generateIdentity(), generateIdentity()]);
    expect(safetyCode(a.id)).toBe(safetyCode(a.id));
    expect(safetyCode(a.id)).not.toBe(safetyCode(b.id));
  });
});

describe('el que no quadra es descarta, sense amagar la resta', () => {
  /** Pau, a real member, publishes a validly signed entry of his own. */
  const pauPublishes = async (build: (world: Awaited<ReturnType<typeof party>>) => Entry) => {
    const world = await party();
    await publishEntry(
      world.pausPhone.client,
      world.pau.session.keys,
      build(world),
      world.pauId.privateKey,
      world.event.preset,
    );
    return world.julia.repository.load();
  };

  it('una miniatura que no és JPEG (p. ex. un SVG amb codi)', async () => {
    const after = await pauPublishes(({ pauId, juliasPhoto }) =>
      photoEntry(
        pauId.id,
        {
          position: AT_PAUS,
          full: image('X'),
          thumb: { ...image('X'), bytes: utf8('<svg onload=alert(1)>') },
        },
        { id: crypto.randomUUID(), url: juliasPhoto.fullUrl, sha256: juliasPhoto.fullSha256 },
        new Date(),
      ),
    );
    expect(after.photos).toHaveLength(2);
    expect(
      after.photos.every(({ thumbUrl }) => thumbUrl.startsWith('bytes:image/jpeg:ffd8ff')),
    ).toBe(true);
  });

  it('una foto que apunta fora del compte (filtraria la IP de qui la mira)', async () => {
    const after = await pauPublishes(({ pauId }) =>
      photoEntry(
        pauId.id,
        { position: AT_PAUS, full: image('X'), thumb: image('X') },
        { id: crypto.randomUUID(), url: 'https://evil.example/track.jpg', sha256: '0'.repeat(64) },
        new Date(),
      ),
    );
    expect(after.photos.map(({ fullUrl }) => fullUrl)).not.toContain(
      'https://evil.example/track.jpg',
    );
    expect(after.photos).toHaveLength(2);
  });

  it('una entrada massa gran (no pot esgotar la memòria de ningú)', async () => {
    const world = await party();
    const huge = await seal(world.pau.session.keys.aes, new Uint8Array(MAX_ENTRY_BYTES + 1), ENTRY);
    await world.pausPhone.client.upload(huge, [world.pau.session.keys.tag], world.event.preset);
    const after = await world.julia.repository.load();
    expect(after.photos).toHaveLength(2);
    expect(after.profiles.size).toBe(2);
  });

  it('un fitxer que no és cap entrada, o xifrat amb una altra clau', async () => {
    const world = await party();
    const { keys } = world.pau.session;
    const other = await deriveEventKeys(generateSecret(), keys.organizer);
    const upload = (bytes: Bytes) =>
      world.pausPhone.client.upload(bytes, [keys.tag], world.event.preset);
    await upload(await seal(keys.aes, utf8('{"kind":"stop"'), ENTRY));
    await upload(await seal(other.aes, utf8('hola'), ENTRY));
    await upload(utf8('no és ni xifrat'));
    const after = await world.julia.repository.load();
    expect(after.photos).toHaveLength(2);
    expect(after.stops).toHaveLength(2);
  });

  it('el que Cloudinary modifiqui (una foto sencera o una entrada)', async () => {
    const { cloud, julia, juliasPhoto } = await party();
    const flip = (bytes: Bytes): Bytes =>
      bytes.map((byte, index) => (index === 20 ? byte ^ 1 : byte));
    cloud.tamper(juliasPhoto.fullUrl, flip);
    await expect(julia.repository.openPhoto(juliasPhoto)).rejects.toThrow('integrity');

    cloud.tamper(cloud.files().at(-1)?.url ?? expect.unreachable(), flip);
    const after = await julia.repository.load();
    expect(after.photos).toHaveLength(1);
    expect(after.eventName).toBe('Correpisos 2026');
  });
});

describe('algú de fora no troba ni llegeix res', () => {
  it('sense el secret no hi ha tag per llistar, i el que descarregui no s’obre', async () => {
    const { cloud, juliasPhoto, julia } = await party();
    const stranger = newPhone(cloud);
    const guess = await deriveEventKeys(generateSecret(), julia.session.keys.organizer);
    expect(await stranger.client.list(guess.tag)).toEqual([]);
    const repository = createCloudinaryRepository(stranger.client, guess, deps);
    expect((await repository.load()).photos).toEqual([]);
    await expect(repository.openPhoto(juliasPhoto)).rejects.toThrow('integrity');
  });

  it('sense el nom del preset de l’event, no hi pot pujar res', async () => {
    const { cloud, event } = await party();
    const stranger = newPhone(cloud);
    await expect(stranger.client.upload(utf8('brossa'), [], 'shared_default')).rejects.toThrow(
      '400',
    );
    await expect(stranger.client.upload(utf8('brossa'), [], 'ps_guess')).rejects.toThrow('400');
    expect(cloud.files().every(({ preset }) => preset === event.preset)).toBe(true);
  });
});

describe('cada event és un món a part', () => {
  it('amb la clau d’un event no es llegeix res d’un altre', async () => {
    const { cloud, julia } = await party();
    const calcotada = await createEvent(cloud, CALCOTADA);
    const other = await openLink(newPhone(cloud), calcotada.invite);
    const files = cloud.files().filter(({ tags }) => tags.includes(other.session.keys.tag));
    expect(await decryptAll(files, julia.session.keys.aes)).toEqual([]);
    expect((await decryptAll(files, other.session.keys.aes)).length).toBe(files.length);
  });

  it('el mòbil oblida les claus d’un event en sortir-ne, i conserva les altres', async () => {
    const cloud = createFakeCloudinary(CLOUD, ADMIN);
    const [first, second] = await Promise.all([
      createEvent(cloud, CORREPISOS),
      createEvent(cloud, CALCOTADA),
    ]);
    const store = createMemoryKeyStore();
    const a = await openInvite(
      readInvite(new URL(first.invite).hash) ?? expect.unreachable(),
      store,
    );
    await openInvite(readInvite(new URL(second.invite).hash) ?? expect.unreachable(), store);
    if (a.session.kind !== 'event') {
      return expect.unreachable();
    }
    await leaveEvent(a.session.keys.tag, store);
    const left = await store.loadEvents();
    expect(left.map(({ keys }) => keys.tag)).not.toContain(a.session.keys.tag);
    expect(left).toHaveLength(1);
    expect((await resolveSession('', store)).session.kind).toBe('event');
  });
});

describe('tancar un event', () => {
  it('atura les pujades però no les fotos, i només per a aquell event', async () => {
    const { cloud, event, julia, juliaId } = await party();
    const calcotada = await createEvent(cloud, CALCOTADA);
    const { url, init } = deletePresetRequest(ADMIN, event.preset);
    expect((await cloud.fetch(url, init)).ok).toBe(true);

    await expect(
      julia.repository.publishPhoto(juliaId, {
        position: null,
        full: image('TARD'),
        thumb: image('TARD'),
      }),
    ).rejects.toThrow('400');
    expect((await julia.repository.load()).photos).toHaveLength(2);
    expect(cloud.hasPreset(calcotada.preset)).toBe(true);
  });
});

describe('la ubicació en directe', () => {
  it('va xifrada i signada: el transport no veu on és ningú', async () => {
    const { julia, juliaId } = await party();
    const sealed = await sealPing(julia.session.keys.aes, juliaId.privateKey, {
      authorId: juliaId.id,
      position: { lat: 41.403_6, lng: 2.157_1 },
      at: new Date(),
    });
    expect(sealed[0]).toBe(1);
    expect(contains(sealed, utf8(juliaId.id))).toBe(false);
    const lat = new Uint8Array(new Float64Array([41.403_6]).buffer);
    expect(contains(sealed, lat)).toBe(false);
  });

  it('només mostra companys amb perfil a l’event, i ningú no es pot fer passar per un altre', async () => {
    const { julia, juliaId, pauId } = await party();
    const profiles = (await julia.repository.load()).profiles;
    const { aes } = julia.session.keys;
    const at = new Date();
    const stranger = await generateIdentity();
    const other = await deriveEventKeys(generateSecret(), julia.session.keys.organizer);

    const real = await sealPing(aes, pauId.privateKey, {
      authorId: pauId.id,
      position: AT_PAUS,
      at,
    });
    const asJulia = await sealPing(aes, pauId.privateKey, {
      authorId: juliaId.id,
      position: AT_PAUS,
      at,
    });
    const noProfile = await sealPing(aes, stranger.privateKey, {
      authorId: stranger.id,
      position: AT_PAUS,
      at,
    });
    const otherEvent = await sealPing(other.aes, pauId.privateKey, {
      authorId: pauId.id,
      position: AT_PAUS,
      at,
    });
    const tampered = real.map((byte, index) => (index === 30 ? byte ^ 1 : byte));

    expect((await openPing(aes, real, profileKeys(profiles)))?.authorId).toBe(pauId.id);
    expect(await openPing(aes, asJulia, profileKeys(profiles))).toBeNull();
    expect(await openPing(aes, noProfile, profileKeys(profiles))).toBeNull();
    expect(await openPing(aes, otherEvent, profileKeys(profiles))).toBeNull();
    expect(await openPing(aes, tampered, profileKeys(profiles))).toBeNull();
  });
});
