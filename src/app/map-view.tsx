import 'leaflet/dist/leaflet.css';

import { divIcon, type LatLngExpression, latLngBounds } from 'leaflet';
import { useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';

import { countByStop, loosePhotos } from '../lib/selectors';
import type { PhotoView, Snapshot } from '../lib/snapshot';
import type { LatLng, Stop } from '../lib/types';

interface MapViewProps {
  readonly snapshot: Snapshot;
  readonly onSelectStop: (stop: Stop) => void;
  readonly onOpenPhoto: (photo: PhotoView) => void;
}

const BARCELONA: LatLngExpression = [41.3874, 2.1686];
const ROUTE_COLOR = 'rgb(180 71 47)';

const toTuple = ({ lat, lng }: LatLng): [number, number] => [lat, lng];

/**
 * Markers are real DOM nodes, never HTML strings: user-provided text and URLs
 * cannot turn into markup.
 */
const element = (
  tag: string,
  attributes: Readonly<Record<string, string>>,
  ...children: readonly (Node | string)[]
): HTMLElement => {
  const node = document.createElement(tag);
  Object.entries(attributes).forEach(([name, value]) => {
    node.setAttribute(name, value);
  });
  node.append(...children);
  return node;
};

const stopIcon = (stop: Stop, count: number) =>
  divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: element(
      'span',
      { class: 'pin', 'aria-hidden': 'true' },
      String(stop.order),
      ...(count > 0 ? [element('span', { class: 'pin-count' }, String(count))] : []),
    ),
  });

const photoIcon = (photo: PhotoView) =>
  divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: element(
      'span',
      { class: 'pin-photo' },
      element('img', { src: photo.thumbUrl, alt: '', class: 'size-full object-cover' }),
    ),
  });

export const MapView = ({ snapshot, onSelectStop, onOpenPhoto }: MapViewProps) => {
  const counts = useMemo(() => countByStop(snapshot.photos), [snapshot.photos]);
  const loose = useMemo(() => loosePhotos(snapshot.photos), [snapshot.photos]);
  const route = snapshot.stops.map(({ position }) => toTuple(position));
  const points = [
    ...route,
    ...loose.flatMap(({ position }) => (position ? [toTuple(position)] : [])),
  ];
  const bounds = points.length > 1 ? latLngBounds(points).pad(0.2) : undefined;

  return (
    <MapContainer
      {...(bounds === undefined ? { center: points[0] ?? BARCELONA, zoom: 15 } : { bounds })}
      className="size-full"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        referrerPolicy="no-referrer"
      />
      {route.length > 1 && (
        <Polyline
          positions={route}
          pathOptions={{ color: ROUTE_COLOR, weight: 4, opacity: 0.7, dashArray: '6 10' }}
        />
      )}
      {snapshot.stops.map((stop) => (
        <Marker
          key={stop.id}
          position={toTuple(stop.position)}
          icon={stopIcon(stop, counts.get(stop.id) ?? 0)}
          title={stop.name}
          eventHandlers={{
            click: () => {
              onSelectStop(stop);
            },
          }}
        />
      ))}
      {loose.map((photo) =>
        photo.position === null ? null : (
          <Marker
            key={photo.id}
            position={toTuple(photo.position)}
            icon={photoIcon(photo)}
            eventHandlers={{
              click: () => {
                onOpenPhoto(photo);
              },
            }}
          />
        ),
      )}
    </MapContainer>
  );
};
