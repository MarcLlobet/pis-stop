/**
 * Stand-in for the Leaflet map in jsdom (which has no layout and no canvas):
 * the same props, shown as plain lists, so a test can see which stops and
 * photo pins the real map would draw, and tap a pin.
 */
import type { PhotoView, Snapshot } from '../lib/snapshot';

interface MapStandInProps {
  readonly snapshot: Snapshot;
  readonly onOpenPhoto: (photo: PhotoView) => void;
}

const coordinates = ({ lat, lng }: { readonly lat: number; readonly lng: number }) =>
  `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

export const MapView = ({ snapshot, onOpenPhoto }: MapStandInProps) => (
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
  </section>
);
