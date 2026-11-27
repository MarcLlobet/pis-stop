/**
 * A whole correpisos, end to end, with real cryptography and a fake
 * Cloudinary behind the real HTTP client: the organizer creates the event,
 * friends join with the QR, make profiles, post photos, invite each other and
 * see each other on the map. Then, what a cheating member, an outsider and
 * the server itself can and cannot do.
 *
 * Nothing is mocked between the app code and `fetch`: every byte that would
 * leave a phone is in `cloud.log()`.
 */
import { describe, expect, it } from 'vitest';

import { createPresetRequest, deletePresetRequest } from '../lib/cloudinary-admin';
import { deriveEventKeys, generateSecret } from '../lib/crypto';
import { toBase64Url, toHex, utf8 } from '../lib/encoding';
import { buildInviteUrl } from '../lib/invite';
import { openPing, profileKeys, sealPing } from '../lib/location';
import { createCloudinaryRepository, publishEntry } from '../lib/repository';
import { placedPhotos } from '../lib/selectors';
import { switchEvent } from '../lib/session';
import type { Bytes, Entry } from '../lib/types';
import { createFakeCloudinary } from './fake-cloudinary';
import { jpeg } from './fixtures';
import {
  ADMIN,
  APP_URL,
  AT_JULIAS,
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
} from './scenario';

/** Marc creates the event; Júlia joins with the QR and posts; she invites Pau, who posts too. */
const party = async () => {
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

describe('un correpisos de principi a fi', () => {
  it('la Júlia obre el QR de l’organitzador i veu l’event i la ruta', async () => {
    const cloud = createFakeCloudinary(CLOUD, ADMIN);
    const { invite, preset } = await createEvent(cloud, CORREPISOS);
    const julia = await openLink(newPhone(cloud), invite);

    expect(julia.fromInvite).toBe(true);
    expect(julia.snapshot.eventName).toBe('Correpisos 2026');
    expect(julia.snapshot.uploadPreset).toBe(preset);
    expect(julia.snapshot.stops.map(({ order, name }) => [order, name])).toEqual([
      [1, 'Pis de la Júlia, carrer de Verdi'],
      [2, 'Pis d’en Pau, carrer de Blai'],
    ]);
    expect(julia.events).toEqual([{ tag: julia.session.keys.tag, name: null }]);
  });

  it('el Pau, convidat per la Júlia, veu la seva foto al mapa i la pot obrir sencera', async () => {
    const { pau, juliaId, juliasPhoto } = await party();
    const snapshot = await pau.repository.load();

    expect(snapshot.profiles.get(juliaId.id)?.name).toBe('Júlia');
    expect(snapshot.profiles.size).toBe(2);
    const onTheMap = placedPhotos(snapshot.photos);
    expect(onTheMap).toHaveLength(2);
    const fromJulia = onTheMap.find(({ authorId }) => authorId === juliaId.id);
    expect(fromJulia?.position).toEqual(AT_JULIAS);
    expect(fromJulia?.thumbUrl).toBe(`bytes:image/jpeg:${toHex(image('THUMB-OF-JULIA').bytes)}`);

    expect(await pau.repository.openPhoto(juliasPhoto)).toBe(
      `bytes:image/jpeg:${toHex(image('FULL-PIXELS-OF-JULIA').bytes)}`,
    );
  });

  it('tots dos es veuen en directe al mapa, i ningú més ho pot llegir ni falsificar', async () => {
    const { julia, juliaId, pau, pauId } = await party();
    const profiles = (await pau.repository.load()).profiles;
    const at = new Date('2026-12-12T21:00:00.000Z');

    const fromJulia = await sealPing(julia.session.keys.aes, juliaId.privateKey, {
      authorId: juliaId.id,
      position: AT_JULIAS,
      at,
    });
    const fromPau = await sealPing(pau.session.keys.aes, pauId.privateKey, {
      authorId: pauId.id,
      position: AT_PAUS,
      at,
    });
    expect(await openPing(pau.session.keys.aes, fromJulia, profileKeys(profiles))).toEqual({
      authorId: juliaId.id,
      position: AT_JULIAS,
      at,
    });
    expect(
      (await openPing(julia.session.keys.aes, fromPau, profileKeys(profiles)))?.position,
    ).toEqual(AT_PAUS);

    // Someone from another event cannot read it...
    const outsider = await deriveEventKeys(generateSecret(), julia.session.keys.organizer);
    expect(await openPing(outsider.aes, fromJulia, profileKeys(profiles))).toBeNull();
    // ...and Pau cannot pretend to be Júlia, even with the group key.
    const forged = await sealPing(pau.session.keys.aes, pauId.privateKey, {
      authorId: juliaId.id,
      position: AT_PAUS,
      at,
    });
    expect(await openPing(julia.session.keys.aes, forged, profileKeys(profiles))).toBeNull();
  });

  it('Cloudinary només rep i guarda soroll: cap nom, adreça, correu, posició ni píxel', async () => {
    const { cloud, event } = await party();
    const secrets = [
      'Correpisos 2026',
      'carrer de Verdi',
      'carrer de Blai',
      'Júlia',
      'pau@example.cat',
      '41.4036',
      '2.1625',
      'FULL-PIXELS-OF-JULIA',
      'THUMB-OF-PAU',
      'AVATAR-OF-Pau',
    ].map(utf8);

    const seen = [
      ...cloud.log().map(({ body }) => body),
      ...cloud.files().map(({ bytes }) => bytes),
    ];
    expect(seen.length).toBeGreaterThan(10);
    seen.forEach((bytes) => {
      secrets.forEach((secret) => {
        expect(contains(bytes, secret)).toBe(false);
      });
    });

    // The key never travels: not in any URL, and the server never sees the `#…` part.
    const key = toBase64Url(event.secret);
    cloud.log().forEach(({ url }) => {
      expect(url).not.toContain(key);
      expect(url).not.toContain('#');
    });
    // Every upload used the event's own preset, never the public default.
    expect(new Set(cloud.files().map(({ preset }) => preset))).toEqual(new Set([event.preset]));
  });

  it('un membre no pot canviar la ruta, signar per un altre ni prendre el lloc de l’organitzador', async () => {
    const { pau, pauId, pausPhone, juliaId, julia, event } = await party();
    const asPau = (entry: Entry) =>
      publishEntry(pausPhone.client, pau.session.keys, entry, pauId.privateKey, event.preset);
    const empty = new Uint8Array(0);

    // A stop of his own, a photo signed in Júlia's name, a profile with her id,
    // and an event of his own, with a preset he would control.
    await asPau({
      meta: { kind: 'stop', id: 'fake', name: 'Pis trampa', order: 0, position: AT_PAUS },
      payload: empty,
    });
    await asPau({
      meta: {
        kind: 'photo',
        id: crypto.randomUUID(),
        authorId: juliaId.id,
        position: AT_PAUS,
        takenAt: '2026-12-12T21:00:00.000Z',
        fullUrl: `https://res.cloudinary.com/${CLOUD}/raw/upload/v1/f0`,
        fullSha256: '0'.repeat(64),
        imageType: 'image/jpeg',
        width: 4,
        height: 3,
      },
      payload: jpeg(),
    });
    await asPau({
      meta: {
        kind: 'profile',
        id: juliaId.id,
        publicKey: pauId.publicKey,
        name: 'Júlia (de veritat)',
        email: 'trampa@example.cat',
        imageType: 'image/jpeg',
        createdAt: '2026-12-12T22:00:00.000Z',
      },
      payload: empty,
    });
    await asPau({
      meta: {
        kind: 'event',
        name: 'Correpisos del Pau',
        organizerKey: pauId.publicKey,
        legs: [],
        uploadPreset: 'ps_preset_del_pau',
      },
      payload: empty,
    });

    const snapshot = await julia.repository.load();
    expect(snapshot.eventName).toBe('Correpisos 2026');
    expect(snapshot.uploadPreset).toBe(event.preset);
    expect(snapshot.stops.map(({ name }) => name)).not.toContain('Pis trampa');
    expect(snapshot.profiles.get(juliaId.id)?.name).toBe('Júlia');
    expect(snapshot.photos.filter(({ authorId }) => authorId === juliaId.id)).toHaveLength(1);
  });

  it('algú de fora no troba res, i el que descarrega directament no ho pot obrir', async () => {
    const { cloud, juliasPhoto } = await party();
    const stranger = newPhone(cloud);
    const strangerKeys = await deriveEventKeys(generateSecret(), 'A'.repeat(22));

    // Without the secret, there is no tag to list...
    expect(await stranger.client.list(strangerKeys.tag)).toEqual([]);
    // ...and a file found some other way is only ciphertext under another key.
    const repository = createCloudinaryRepository(stranger.client, strangerKeys, deps);
    await expect(repository.openPhoto(juliasPhoto)).rejects.toThrow('integrity');
  });

  it('el que Cloudinary toqui es descarta, sense amagar la resta', async () => {
    const { cloud, julia, juliasPhoto } = await party();
    const flip = (bytes: Bytes): Bytes =>
      bytes.map((byte, index) => (index === 20 ? byte ^ 1 : byte));

    cloud.tamper(juliasPhoto.fullUrl, flip);
    await expect(julia.repository.openPhoto(juliasPhoto)).rejects.toThrow('integrity');

    const before = (await julia.repository.load()).photos.length;
    const lastEntry = cloud.files().at(-1)?.url ?? expect.unreachable();
    cloud.tamper(lastEntry, flip);
    const after = await julia.repository.load();
    expect(after.photos).toHaveLength(before - 1);
    expect(after.eventName).toBe('Correpisos 2026');
  });

  it('dos events al mateix mòbil no es barregen', async () => {
    const { cloud, juliasPhone, julia } = await party();
    const calcotada = await createEvent(cloud, CALCOTADA);

    const second = await openLink(juliasPhone, calcotada.invite);
    expect(second.snapshot.eventName).toBe('Calçotada a Valls');
    expect(second.snapshot.photos).toEqual([]);
    expect(second.snapshot.profiles.size).toBe(0);
    expect(second.session.keys.tag).not.toBe(julia.session.keys.tag);
    expect(second.events.map(({ tag }) => tag)).toEqual([
      second.session.keys.tag,
      julia.session.keys.tag,
    ]);

    // The first event's keys cannot read anything of the second one.
    const files = cloud.files().filter(({ tags }) => tags.includes(second.session.keys.tag));
    expect(files.length).toBeGreaterThan(0);
    expect(cloud.files().filter(({ preset }) => preset === calcotada.preset)).toEqual(files);

    const back = await switchEvent(julia.session.keys.tag, juliasPhone.store);
    expect(back.session.kind === 'event' && back.session.keys.tag).toBe(julia.session.keys.tag);
  });

  it('tancar un event n’atura les pujades, però no les fotos ni els altres events', async () => {
    const { cloud, event, julia, juliaId } = await party();
    const calcotada = await createEvent(cloud, CALCOTADA);

    const { url, init } = deletePresetRequest(ADMIN, event.preset);
    expect((await cloud.fetch(url, init)).ok).toBe(true);
    expect(cloud.hasPreset(event.preset)).toBe(false);
    expect(cloud.hasPreset(calcotada.preset)).toBe(true);

    await expect(
      julia.repository.publishPhoto(juliaId, {
        position: AT_JULIAS,
        full: image('TOO-LATE'),
        thumb: image('TOO-LATE'),
      }),
    ).rejects.toThrow('400');
    expect((await julia.repository.load()).photos).toHaveLength(2);
  });

  it('sense les credencials de l’API no es pot crear ni esborrar cap preset', async () => {
    const cloud = createFakeCloudinary(CLOUD, ADMIN);
    const wrong = { ...ADMIN, apiSecret: 'someone_elses-secret' };
    const { url, init } = createPresetRequest(wrong, 'ps_x');
    expect((await cloud.fetch(url, init)).status).toBe(401);
    expect(cloud.hasPreset('ps_x')).toBe(false);
  });
});
