// @vitest-environment jsdom
/**
 * The real app, screen by screen, in jsdom: landing, onboarding, map, upload,
 * gallery, lightbox, invites and the event list. Only what jsdom lacks is
 * replaced: the Leaflet map (by lists), the canvas photo encoder (by the
 * picked file itself), the camera roll (a local JPEG), geolocation and object
 * URLs. Cloudinary is the in-memory one, so everything else, encryption and
 * signatures included, is the production code.
 */
import { configure, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { utf8 } from '../lib/encoding';
import { readInviteText } from '../lib/invite';
import { publishEntry } from '../lib/repository';
import { browserKeyStore } from '../platform/browser';
import { createFakeCloudinary, type FakeCloudinary, readBlob } from '../test/fake-cloudinary';
import { jpeg } from '../test/fixtures';
import {
  ADMIN,
  AT_JULIAS,
  AT_PAUS,
  CALCOTADA,
  CLOUD,
  contains,
  CORREPISOS,
  createEvent,
  image,
  join,
  newPhone,
  openLink,
  SHARED_PRESET,
} from '../test/scenario';

vi.mock('./map-view', () => import('../test/map-stand-in'));
vi.mock('../platform/image', () => import('../test/image-stand-in'));

configure({ asyncUtilTimeout: 5_000 });

/** A photo "taken with the camera": a JPEG whose bytes the test can recognise. */
const photoFile = (marker: string): File =>
  new File([jpeg(...utf8(marker))], `${marker}.jpg`, { type: 'image/jpeg' });

/** Object URLs the app created, to read back what it decrypted. */
const objectUrls: { readonly blobs: Map<string, Blob> } = { blobs: new Map() };

const state: { cloud: FakeCloudinary; App: ComponentType | null } = {
  cloud: createFakeCloudinary(CLOUD, ADMIN),
  App: null,
};

beforeAll(async () => {
  vi.stubEnv('DEV', false);
  vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', CLOUD);
  vi.stubEnv('VITE_CLOUDINARY_UPLOAD_PRESET', SHARED_PRESET);
  vi.stubEnv('VITE_ABLY_KEY', '');
  vi.stubGlobal(
    'fetch',
    (url: string, init?: RequestInit): Promise<Response> => state.cloud.fetch(url, init),
  );
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (success: (position: { coords: GeolocationCoordinates }) => void) => {
        success({ coords: { latitude: AT_JULIAS.lat, longitude: AT_JULIAS.lng } as never });
      },
      watchPosition: () => 0,
      clearWatch: () => undefined,
    },
  });
  /* eslint-disable functional/immutable-data -- jsdom has no object URLs: this provides them */
  URL.createObjectURL = (blob: Blob | MediaSource) => {
    const url = `blob:test/${String(objectUrls.blobs.size)}`;
    objectUrls.blobs.set(url, blob as Blob);
    return url;
  };
  URL.revokeObjectURL = () => undefined;
  // No install hint: it is shown once, before onboarding, and has its own tests.
  localStorage.setItem('pis-stop:install-hint-dismissed', '1');
  // Imported only now, so that it reads the stubbed environment.
  state.App = (await import('./app')).App;
  /* eslint-enable functional/immutable-data */
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  // A fresh Cloudinary and a phone that has joined nothing yet.
  // eslint-disable-next-line functional/immutable-data -- per-test fixture
  state.cloud = createFakeCloudinary(CLOUD, ADMIN);
  await (await browserKeyStore).saveEvents([]);
  window.history.replaceState(null, '', '/pis-stop/');
});

const renderApp = () => {
  const App = state.App ?? expect.unreachable();
  const user = userEvent.setup();
  render(<App />);
  return user;
};

const headerOf = (eventName: string) =>
  screen.findByRole('heading', { level: 1, name: `Pis Stop – ${eventName}` });

const makeProfile = async (user: UserEvent, name: string) => {
  await screen.findByRole('heading', { name: 'Qui ets?' });
  await user.type(screen.getByRole('textbox', { name: /^Nom/ }), name);
  await user.type(screen.getByRole('textbox', { name: /^Correu/ }), `${name}@example.cat`);
  await user.click(screen.getByRole('button', { name: 'Som-hi' }));
};

const pasteInvite = async (user: UserEvent, link: string, scope: HTMLElement = document.body) => {
  await user.click(within(scope).getByRole('textbox', { name: /enganxa l’enllaç/i }));
  await user.paste(link);
  await user.click(within(scope).getByRole('button', { name: 'Entra' }));
};

const takePhoto = async (user: UserEvent, marker: string) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  await user.upload(input ?? expect.unreachable(), photoFile(marker));
};

/** Júlia opens Marc's QR (the `#k=…` link), makes her profile and posts one photo. */
const juliaJoinsAndPosts = async () => {
  const event = await createEvent(state.cloud, CORREPISOS);
  window.history.replaceState(null, '', `/pis-stop/${new URL(event.invite).hash}`);
  const user = renderApp();
  await makeProfile(user, 'Júlia');
  await headerOf('Correpisos 2026');
  await takePhoto(user, 'PIXELS-OF-JULIA');
  await screen.findByRole('button', { name: 'Júlia a 41.4036, 2.1571' });
  return { user, event };
};

describe('l’app, pantalla per pantalla', () => {
  it('sense cap event, només deixa entrar amb el QR o l’enllaç', async () => {
    const event = await createEvent(state.cloud, CORREPISOS);
    const user = renderApp();

    await screen.findByText(/Necessites un event/);
    expect(screen.queryByRole('button', { name: 'Prova la demo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: /Correpisos/ })).not.toBeInTheDocument();

    await pasteInvite(user, 'https://marcllobet.github.io/pis-stop/');
    expect(screen.getByText(/no és una invitació/)).toBeInTheDocument();

    await pasteInvite(user, event.invite);
    await makeProfile(user, 'Júlia');
    await headerOf('Correpisos 2026');
  });

  it('la Júlia obre el QR, es fa el perfil, penja una foto i la veu al mapa', async () => {
    await juliaJoinsAndPosts();

    // The secret is gone from the address bar as soon as the app has read it.
    expect(window.location.hash).toBe('');
    const stops = within(screen.getByRole('list', { name: 'Pisos' })).getAllByRole('listitem');
    expect(stops.map(({ textContent }) => textContent)).toEqual([
      '1. Pis de la Júlia, carrer de Verdi',
      '2. Pis d’en Pau, carrer de Blai',
    ]);

    // Cloudinary got her profile and photo, but none of it in the clear.
    const received = state.cloud.log().map(({ body }) => body);
    ['Júlia', 'Júlia@example.cat', 'PIXELS-OF-JULIA', 'carrer de Verdi'].forEach((text) => {
      expect(received.some((body) => contains(body, utf8(text)))).toBe(false);
    });
    expect(state.cloud.files().length).toBeGreaterThan(4);
  });

  it('veu les fotos del Pau, les obre senceres i no es creu les seves trampes', async () => {
    const { user, event } = await juliaJoinsAndPosts();

    // Pau, on his own phone, joins with the same QR and posts from Blai.
    const pau = await openLink(newPhone(state.cloud), event.invite);
    const pauId = await join(pau.repository, 'Pau');
    await pau.repository.publishPhoto(pauId, {
      position: AT_PAUS,
      full: image('FULL-OF-PAU'),
      thumb: image('THUMB-OF-PAU'),
    });
    // ...and tries to add a stop of his own to the route.
    await publishEntry(
      newPhone(state.cloud).client,
      pau.session.keys,
      {
        meta: { kind: 'stop', id: 'trampa', name: 'Pis trampa', order: 3, position: AT_PAUS },
        payload: new Uint8Array(0),
      },
      pauId.privateKey,
      event.preset,
    );

    await user.click(screen.getByRole('button', { name: 'Actualitza' }));
    await screen.findByRole('button', { name: 'Pau a 41.3729, 2.1625' });
    expect(screen.queryByText(/Pis trampa/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Galeria/ }));
    await user.click(await screen.findByRole('button', { name: /^Foto de Pau/ }));
    const full = await screen.findByRole('img', { name: 'Foto de Pau' });
    const blob = objectUrls.blobs.get(full.getAttribute('src') ?? '') ?? expect.unreachable();
    expect(await readBlob(blob)).toEqual(image('FULL-OF-PAU').bytes);
  });

  it('pot convidar algú altre amb el QR o l’enllaç', async () => {
    const { user, event } = await juliaJoinsAndPosts();

    await user.click(screen.getByRole('button', { name: 'Convida' }));
    const sheet = await screen.findByRole('dialog');
    expect(
      within(sheet).getByRole('img', { name: 'QR d’invitació a Correpisos 2026' }),
    ).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Copia l’enllaç' }));

    const copied = readInviteText(await navigator.clipboard.readText());
    expect(copied?.secret).toEqual(readInviteText(event.invite)?.secret);
    expect(copied?.organizer).toBe(readInviteText(event.invite)?.organizer);
  });

  it('entra en un segon event, en canvia i en surt sense perdre l’altre', async () => {
    const { user } = await juliaJoinsAndPosts();
    const calcotada = await createEvent(state.cloud, CALCOTADA);

    await user.click(screen.getByRole('button', { name: /^Els meus events/ }));
    await pasteInvite(user, calcotada.invite, await screen.findByRole('dialog'));
    // A new event is a new identity: nobody can link her profiles across events.
    await makeProfile(user, 'Júlia');
    await headerOf('Calçotada a Valls');
    expect(screen.getByText('1. Masia dels avis')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Fotos al mapa' })).queryAllByRole('button'),
    ).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /^Els meus events/ }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Correpisos 2026' }),
    );
    await headerOf('Correpisos 2026');
    await screen.findByRole('button', { name: 'Júlia a 41.4036, 2.1571' });

    await user.click(screen.getByRole('button', { name: /^Els meus events/ }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Surt d’aquest event',
      }),
    );
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Vols sortir d’aquest event?' })).getByRole(
        'button',
        { name: 'Surt' },
      ),
    );
    await headerOf('Calçotada a Valls');
  });
});
