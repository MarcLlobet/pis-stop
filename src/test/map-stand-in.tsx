/**
 * Stand-in for the Leaflet map in jsdom (which has no layout and no canvas):
 * the same props, shown as plain lists, so a test can see which stops and
 * photo pins the real map would draw, and tap a pin.
 */
import type { PeerPosition } from '../hooks/use-live-location';
import type { PhotoView, Snapshot } from '../lib/snapshot';

interface MapStandInProps {
  readonly snapshot: Snapshot;
  readonly onOpenPhoto: (photo: PhotoView) => void;
  readonly peers: ReadonlyMap<string, PeerPosition>;
}

const coordinates = ({ lat, lng }: { readonly lat: number; readonly lng: number }) =>
  `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

export const MapView = ({ snapshot, onOpenPhoto, peers }: MapStandInProps) => (
  <section aria-label="Mapa">
    <ol aria-label="Pisos">
      {snapshot.stops.map((stop) => (
        <li key={stop.id}>{`${String(stop.order)}. ${stop.name}`}</li>
      ))}
    </ol>
    <ul aria-label="Fotos al mapa">
      {snapshot.photos.flatMap((photo) =>
        photo.position === null
          ? []
          : [
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenPhoto(photo);
                  }}
                >
                  {`${snapshot.profiles.get(photo.authorId)?.name ?? 'Algú'} a ${coordinates(photo.position)}`}
                </button>
              </li>,
            ],
      )}
    </ul>
    <ul aria-label="Companys en directe">
      {[...peers].map(([authorId, { position }]) => (
        <li key={authorId}>
          {`${snapshot.profiles.get(authorId)?.name ?? 'Algú'} a ${coordinates(position)}`}
        </li>
      ))}
    </ul>
  </section>
);
