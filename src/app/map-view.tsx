import 'leaflet/dist/leaflet.css';

import { divIcon, latLngBounds, type LatLngExpression } from 'leaflet';
import { useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, useMap, useMapEvent } from 'react-leaflet';

import { clusterPoints } from '../lib/cluster';
import { centroid } from '../lib/geo';
import { countByStop, type PlacedPhoto, placedPhotos } from '../lib/selectors';
import type { PhotoView, Snapshot } from '../lib/snapshot';
import { type LegStyle, legStyle } from '../lib/transit';
import type { LatLng, Stop } from '../lib/types';
import { BaseMap } from './base-map';

interface MapViewProps {
  readonly snapshot: Snapshot;
  readonly onSelectStop: (stop: Stop) => void;
  readonly onOpenPhoto: (photo: PhotoView) => void;
  readonly onOpenGroup: (photos: readonly PhotoView[]) => void;
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

const thumbnail = (photo: PlacedPhoto): HTMLElement =>
  element('img', { src: photo.thumbUrl, alt: '', class: 'size-full object-cover' });

const photoIcon = (photo: PlacedPhoto) =>
  divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: element('span', { class: 'pin-photo' }, thumbnail(photo)),
  });

/** Several nearby photos: the newest one with a count, drawn as a small stack. */
const groupIcon = (photos: readonly PlacedPhoto[]) =>
  divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: element(
      'span',
      { class: 'pin-group' },
      element('span', { class: 'pin-photo' }, ...photos.slice(0, 1).map(thumbnail)),
      element('span', { class: 'pin-count' }, String(photos.length)),
    ),
  });

const PLAIN_ROUTE: LegStyle = { color: ROUTE_COLOR, dashArray: '6 10', weight: 4 };

/**
 * One line per leg, from stop N to stop N + 1 through the leg's waypoints,
 * styled by how you get there. Without an itinerary: a plain dashed route.
 */
const legLines = (snapshot: Snapshot) =>
  snapshot.stops.slice(1).map((to, index) => {
    const from = snapshot.stops[index] ?? to;
    const leg = snapshot.legs[index];
    return {
      key: `${from.id}-${to.id}`,
      positions: [from.position, ...(leg?.path ?? []), to.position].map(toTuple),
      style: leg === undefined ? PLAIN_ROUTE : legStyle(leg),
    };
  });

/** Photos closer than this on screen (in pixels) are shown as one group. */
const GROUP_RADIUS = 48;

interface PhotoPinsProps {
  readonly photos: readonly PlacedPhoto[];
  readonly onOpenPhoto: (photo: PhotoView) => void;
  readonly onOpenGroup: (photos: readonly PhotoView[]) => void;
}

/**
 * Photo pins, grouped by distance on screen. Zooming in splits groups; a
 * group that cannot be split any further (same spot, or maximum zoom) opens
 * as a list instead.
 */
const PhotoPins = ({ photos, onOpenPhoto, onOpenGroup }: PhotoPinsProps) => {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvent('zoomend', () => {
    setZoom(map.getZoom());
  });

  const groups = useMemo(
    () =>
      clusterPoints(
        photos.map((photo) => {
          const { x, y } = map.project(toTuple(photo.position), zoom);
          return { item: photo, x, y };
        }),
        GROUP_RADIUS,
      ),
    [map, photos, zoom],
  );

  return groups.map(({ items }) => {
    const [first] = items;
    if (first === undefined) {
      return null;
    }
    const center = centroid(items.map(({ position }) => position)) ?? first.position;
    const open = () => {
      if (items.length === 1) {
        onOpenPhoto(first);
        return;
      }
      const bounds = latLngBounds(items.map(({ position }) => toTuple(position)));
      if (map.getBoundsZoom(bounds) > map.getZoom()) {
        map.flyToBounds(bounds.pad(0.5));
      } else {
        onOpenGroup(items);
      }
    };
    return (
      <Marker
        key={`${first.id}:${items.length}`}
        position={toTuple(center)}
        icon={items.length === 1 ? photoIcon(first) : groupIcon(items)}
        eventHandlers={{ click: open }}
      />
    );
  });
};

export const MapView = ({ snapshot, onSelectStop, onOpenPhoto, onOpenGroup }: MapViewProps) => {
  const counts = useMemo(() => countByStop(snapshot.photos), [snapshot.photos]);
  const placed = useMemo(() => placedPhotos(snapshot.photos), [snapshot.photos]);
  const route = snapshot.stops.map(({ position }) => toTuple(position));
  const points = [...route, ...placed.map(({ position }) => toTuple(position))];
  const bounds = points.length > 1 ? latLngBounds(points).pad(0.2) : undefined;

  return (
    <MapContainer
      {...(bounds === undefined ? { center: points[0] ?? BARCELONA, zoom: 15 } : { bounds })}
      // `isolate` keeps Leaflet's internal z-indexes (400–1000) inside the
      // map, so dialogs and the upload button always stay on top of it.
      className="isolate size-full"
      zoomControl={false}
      maxZoom={18}
    >
      <BaseMap />
      {legLines(snapshot).map(({ key, positions, style }) => (
        <Polyline
          key={key}
          positions={positions}
          pathOptions={{
            color: style.color,
            weight: style.weight,
            opacity: 0.85,
            lineCap: 'round',
            ...(style.dashArray === null ? {} : { dashArray: style.dashArray }),
          }}
        />
      ))}
      {snapshot.stops.map((stop) => (
        <Marker
          key={stop.id}
          position={toTuple(stop.position)}
          icon={stopIcon(stop, counts.get(stop.id) ?? 0)}
          title={stop.name}
          // The itinerary stays readable on top of the photo pins.
          zIndexOffset={1000}
          eventHandlers={{
            click: () => {
              onSelectStop(stop);
            },
          }}
        />
      ))}
      <PhotoPins photos={placed} onOpenPhoto={onOpenPhoto} onOpenGroup={onOpenGroup} />
    </MapContainer>
  );
};
