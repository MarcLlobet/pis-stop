import { utf8 } from './encoding';
import { escapeHtml } from './html';
import { type EventRepository, photoEntry, profileEntry, type RepositoryDeps } from './repository';
import { buildSnapshot, toPhotoView, toProfileView } from './snapshot';
import type { Entry, LatLng, Stop } from './types';

const SVG = 'image/svg+xml';

export const tileSvg = (label: string, hue: number, width = 400, height = 300): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
  `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
  `<stop offset="0" stop-color="hsl(${hue} 80% 62%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 70% 38%)"/>` +
  `</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>` +
  `<text x="50%" y="54%" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${Math.round(width / 12)}" font-weight="700" fill="white">${escapeHtml(label)}</text></svg>`;

export const avatarSvg = (name: string, hue: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">` +
  `<rect width="96" height="96" rx="48" fill="hsl(${hue} 70% 50%)"/>` +
  `<text x="48" y="60" text-anchor="middle" font-family="system-ui,sans-serif" font-size="40" font-weight="700" fill="white">${escapeHtml(name.slice(0, 1).toUpperCase())}</text></svg>`;

const dataUrl = (svg: string): string => `data:${SVG};charset=utf-8,${encodeURIComponent(svg)}`;

// Public squares in Barcelona: the demo never shows real homes.
const DEMO_STOPS: readonly Stop[] = [
  { name: 'Pis de la Júlia', position: { lat: 41.3786, lng: 2.1622 } },
  { name: "Pis d'en Biel", position: { lat: 41.373, lng: 2.164 } },
  { name: "Pis de l'Anna", position: { lat: 41.4029, lng: 2.1564 } },
  { name: "Pis d'en Pol", position: { lat: 41.4053, lng: 2.1594 } },
].map((stop, index) => ({
  kind: 'stop' as const,
  id: `stop-${index + 1}`,
  order: index + 1,
  ...stop,
}));

const DEMO_FRIENDS = [
  { id: 'friend-julia', name: 'Júlia', hue: 340 },
  { id: 'friend-biel', name: 'Biel', hue: 200 },
  { id: 'friend-anna', name: 'Anna', hue: 140 },
] as const;

const DEMO_PHOTOS = [
  { author: 0, stop: 0, label: 'Vermut', hue: 20, minutes: 0 },
  { author: 1, stop: 0, label: 'Patates braves', hue: 40, minutes: 12 },
  { author: 1, stop: 1, label: 'Terrat', hue: 190, minutes: 70 },
  { author: 2, stop: 1, label: 'Brindis', hue: 280, minutes: 85 },
  { author: 0, stop: 2, label: 'Karaoke', hue: 320, minutes: 150 },
  { author: 2, stop: 3, label: 'Última ronda', hue: 250, minutes: 230 },
] as const;

const START = Date.UTC(2026, 11, 12, 12, 0);

const jitter = ({ lat, lng }: LatLng, seed: number): LatLng => ({
  lat: lat + Math.sin(seed) * 0.0002,
  lng: lng + Math.cos(seed) * 0.0002,
});

export const demoEntries = (): readonly Entry[] => [
  { meta: { kind: 'event', name: 'Correpisos de prova' }, payload: new Uint8Array(0) },
  ...DEMO_STOPS.map((meta): Entry => ({ meta, payload: new Uint8Array(0) })),
  ...DEMO_FRIENDS.map((friend) =>
    profileEntry(
      {
        id: friend.id,
        name: friend.name,
        email: `${friend.name.toLowerCase()}@example.com`,
        avatar: {
          bytes: utf8(avatarSvg(friend.name, friend.hue)),
          type: SVG,
          width: 96,
          height: 96,
        },
      },
      new Date(START),
    ),
  ),
  ...DEMO_PHOTOS.flatMap((photo, index) => {
    const stop = DEMO_STOPS[photo.stop];
    const author = DEMO_FRIENDS[photo.author];
    return stop && author
      ? [
          photoEntry(
            {
              authorId: author.id,
              stopId: stop.id,
              position: jitter(stop.position, index),
              full: { bytes: utf8(''), type: SVG, width: 1200, height: 900 },
              thumb: {
                bytes: utf8(tileSvg(photo.label, photo.hue)),
                type: SVG,
                width: 400,
                height: 300,
              },
            },
            {
              id: `demo-photo-${index + 1}`,
              fullUrl: dataUrl(tileSvg(photo.label, photo.hue, 1200, 900)),
            },
            new Date(START + photo.minutes * 60_000),
          ),
        ]
      : [];
  }),
];

/**
 * A repository that keeps nothing: uploads only live in the visitor's tab, so
 * the public demo can be played with freely.
 */
export const createDemoRepository = (deps: RepositoryDeps): EventRepository => ({
  load: () => Promise.resolve(buildSnapshot(demoEntries(), deps.toUrl)),
  publishProfile: (input) =>
    Promise.resolve(toProfileView(profileEntry(input, deps.now()), deps.toUrl)),
  publishPhoto: (input) =>
    Promise.resolve(
      toPhotoView(
        photoEntry(
          input,
          { id: deps.newId(), fullUrl: deps.toUrl(input.full.bytes, input.full.type) },
          deps.now(),
        ),
        deps.toUrl,
      ),
    ),
  openPhoto: (photo) => Promise.resolve(photo.fullUrl),
});
