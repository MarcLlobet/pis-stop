import 'leaflet/dist/leaflet.css';

import { divIcon, latLngBounds, type LatLngExpression } from 'leaflet';
import { Fragment, memo, useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Tooltip,
  useMap,
  useMapEvent,
} from 'react-leaflet';

import type { PeerPosition } from '../hooks/use-live-location';
import { useOwnPosition } from '../hooks/use-own-position';
import { clusterPoints } from '../lib/cluster';
import { initialOf } from '../lib/format';
import { centroid } from '../lib/geo';
import { type PlacedPhoto, placedPhotos } from '../lib/selectors';
import type { PhotoView, ProfileView, Snapshot } from '../lib/snapshot';
import { chosenOption, type LegStyle, legStyle, segmentStyle } from '../lib/transit';
import type { LatLng, Stop } from '../lib/types';
import { BaseMap, usePrefersDark } from './base-map';

interface MapViewProps {
  readonly snapshot: Snapshot;
  readonly onOpenPhoto: (photo: PhotoView) => void;
  readonly onOpenGroup: (photos: readonly PhotoView[]) => void;
  /** Which option is shown for each leg (by leg index); the first by default. */
  readonly choices: ReadonlyMap<number, number>;
  /** Other people currently sharing their live position, keyed by author id. */
  readonly peers: ReadonlyMap<string, PeerPosition>;
}

const BARCELONA: LatLngExpression = [41.3874, 2.1686];
const FALLBACK_POINT: LatLng = { lat: 41.3874, lng: 2.1686 };
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

const SVG_NS = 'http://www.w3.org/2000/svg';

const svgElement = (
  tag: string,
  attributes: Readonly<Record<string, string>>,
  ...children: readonly Node[]
): SVGElement => {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => {
    node.setAttribute(name, value);
  });
  node.append(...children);
  return node;
};

/** Untitled UI's Home02, redrawn as DOM nodes: a divIcon takes no React tree. */
const houseIcon = (): SVGElement =>
  svgElement(
    'svg',
    { viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none', 'aria-hidden': 'true' },
    svgElement('path', {
      d: 'M9 21v-7.4c0-.56 0-.84.109-1.054a1 1 0 0 1 .437-.437C9.76 12 10.04 12 10.6 12h2.8c.56 0 .84 0 1.054.109a1 1 0 0 1 .437.437C15 12.76 15 13.04 15 13.6V21M11.018 2.764 4.235 8.039c-.453.353-.68.53-.843.75a2 2 0 0 0-.318.65C3 9.704 3 9.991 3 10.565V17.8c0 1.12 0 1.68.218 2.108a2 2 0 0 0 .874.874C4.52 21 5.08 21 6.2 21h11.6c1.12 0 1.68 0 2.108-.218a2 2 0 0 0 .874-.874C21 19.48 21 18.92 21 17.8v-7.235c0-.574 0-.861-.074-1.126a2.002 2.002 0 0 0-.318-.65c-.163-.22-.39-.397-.843-.75l-6.783-5.275c-.351-.273-.527-.41-.72-.462a1 1 0 0 0-.523 0c-.194.052-.37.189-.721.462Z',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );

/**
 * A stop only marks the itinerary: photos are placed on the map on their
 * own. Drawn a touch smaller than a photo pin — quiet wayfinding, not the
 * main thing on the map.
 */
const stopIcon = () =>
  divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: element('span', { class: 'pin', 'aria-hidden': 'true' }, houseIcon()),
  });

/** Who left a photo there: their avatar, or their initial when they have none. */
const avatarContent = (profile: ProfileView | undefined): HTMLElement =>
  profile?.avatarUrl !== null && profile?.avatarUrl !== undefined
    ? element('img', { src: profile.avatarUrl, alt: '', class: 'size-full object-cover' })
    : element('span', { class: 'pin-initial' }, initialOf(profile?.name ?? '?'));

const personIcon = (profile: ProfileView | undefined) =>
  divIcon({
    className: '',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    html: element('span', { class: 'pin-photo' }, avatarContent(profile)),
  });

/** At most this many faces are drawn; past it, the last cell counts the rest. */
const FACES_SHOWN = 4;

/** Several different people posted from the same spot: their avatars in a grid. */
const peopleIcon = (profiles: readonly (ProfileView | undefined)[]) => {
  const overflow = profiles.length > FACES_SHOWN;
  const shown = profiles.slice(0, overflow ? FACES_SHOWN - 1 : FACES_SHOWN);
  const cells = shown.map((profile) =>
    element('span', { class: 'pin-face' }, avatarContent(profile)),
  );
  const more = overflow
    ? [
        element(
          'span',
          { class: 'pin-face pin-more' },
          `+${String(profiles.length - shown.length)}`,
        ),
      ]
    : [];
  return divIcon({
    className: '',
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    html: element('span', { class: 'pin-people' }, ...cells, ...more),
  });
};

/** Someone sharing their live position: their avatar, faded once it goes stale. */
const peerIcon = (profile: ProfileView | undefined, stale: boolean) =>
  divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: element(
      'span',
      { class: stale ? 'pin-peer is-stale' : 'pin-peer' },
      element('span', { class: 'pin-face' }, avatarContent(profile)),
    ),
  });

/** This device's own position: a plain "you are here" dot, never shared with anyone. */
const ownPositionIcon = () =>
  divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: element('span', { class: 'pin-you', 'aria-hidden': 'true' }),
  });

const PLAIN_ROUTE: LegStyle = { color: ROUTE_COLOR, dashArray: '6 10', weight: 4 };

interface RouteLine {
  readonly key: string;
  readonly positions: readonly [number, number][];
  readonly style: LegStyle;
}

/**
 * The lines to draw for each leg, from stop N to stop N + 1:
 * - a planned option (from `pnpm event:route`): every segment along its real
 *   path, walks dotted and rides in their line colour;
 * - otherwise a single line through the leg's waypoints, styled by mode;
 * - without an itinerary, a plain dashed route.
 */
const routeLines = (snapshot: Snapshot, choices: ReadonlyMap<number, number>, dark: boolean) =>
  snapshot.stops.slice(1).flatMap((to, index): readonly RouteLine[] => {
    const from = snapshot.stops[index] ?? to;
    const leg = snapshot.legs[index];
    const option = leg === undefined ? undefined : chosenOption(leg, choices.get(index));
    if (option !== undefined && option.segments.length > 0) {
      return option.segments.map((segment, part) => ({
        key: `${from.id}-${to.id}-${String(part)}`,
        positions: segment.path.map(toTuple),
        style: segmentStyle(segment, dark),
      }));
    }
    return [
      {
        key: `${from.id}-${to.id}`,
        positions: [from.position, ...(leg?.path ?? []), to.position].map(toTuple),
        style: leg === undefined ? PLAIN_ROUTE : legStyle(leg, dark),
      },
    ];
  });

/**
 * Stations where you board or get off, for the options being shown. A
 * transfer station appears once per line but is labelled only once.
 */
const stationsOf = (snapshot: Snapshot, choices: ReadonlyMap<number, number>) => {
  const stations = snapshot.legs.flatMap((leg, index) =>
    (chosenOption(leg, choices.get(index))?.segments ?? []).flatMap(({ ride }) =>
      ride === null
        ? []
        : [ride.from, ride.to].map((station) => ({
            key: `${String(index)}-${ride.line}-${station.name}`,
            station,
            color: segmentStyle({ mode: 'ride', minutes: 0, meters: 0, path: [], ride }).color,
          })),
    ),
  );
  return stations.map((entry, position) => ({
    ...entry,
    labelled: stations.findIndex(({ station }) => station.name === entry.station.name) === position,
  }));
};

/** Photos closer than this on screen (in pixels) are shown as one group. */
const GROUP_RADIUS = 48;

interface PhotoPinsProps {
  readonly photos: readonly PlacedPhoto[];
  readonly profiles: ReadonlyMap<string, ProfileView>;
  readonly onOpenPhoto: (photo: PhotoView) => void;
  readonly onOpenGroup: (photos: readonly PhotoView[]) => void;
}

/** Always above the stops and the route, whatever their own screen position. */
const PHOTO_Z_OFFSET = 10_000;
/** Above the photo pins: a live person, not a thing that happened earlier. */
const PEER_Z_OFFSET = PHOTO_Z_OFFSET + 500;
/** Above even the peers: it's you, always findable. */
const OWN_POSITION_Z_OFFSET = PHOTO_Z_OFFSET + 1000;

interface PhotoGroupPinProps {
  readonly items: readonly PlacedPhoto[];
  readonly profiles: ReadonlyMap<string, ProfileView>;
  readonly onOpenPhoto: (photo: PhotoView) => void;
  readonly onOpenGroup: (photos: readonly PhotoView[]) => void;
}

/**
 * One pin. Its icon and position are memoized: Leaflet swaps a marker's
 * icon whenever the prop is a new object, which reloads the avatar image,
 * so a pin must only get a new icon when what it shows has changed.
 */
const PhotoGroupPin = ({ items, profiles, onOpenPhoto, onOpenGroup }: PhotoGroupPinProps) => {
  const [first] = items;
  const authors = [...new Set(items.map(({ authorId }) => authorId))].map((authorId) =>
    profiles.get(authorId),
  );
  const icon = useMemo(
    () => (authors.length === 1 ? personIcon(authors[0]) : peopleIcon(authors)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `authors` is rebuilt every render; its contents are what matter
    [...authors],
  );
  const position = useMemo(
    () =>
      toTuple(centroid(items.map((item) => item.position)) ?? items[0]?.position ?? FALLBACK_POINT),
    [items],
  );
  if (first === undefined) {
    return null;
  }
  // Opens over the map rather than moving it: never zooms in on a click.
  const open = () => {
    if (items.length === 1) {
      onOpenPhoto(first);
    } else {
      onOpenGroup(items);
    }
  };
  return (
    <Marker
      position={position}
      icon={icon}
      zIndexOffset={PHOTO_Z_OFFSET}
      eventHandlers={{ click: open }}
    />
  );
};

/**
 * Photo pins, grouped by distance on screen: one person's avatar, or several
 * people's when more than one posted from the same spot. Zooming in splits
 * groups; a group that cannot be split any further (same spot, or maximum
 * zoom) opens as a list instead.
 */
const PhotoPins = ({ photos, profiles, onOpenPhoto, onOpenGroup }: PhotoPinsProps) => {
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
    return first === undefined ? null : (
      <PhotoGroupPin
        key={`${first.id}:${items.length}`}
        items={items}
        profiles={profiles}
        onOpenPhoto={onOpenPhoto}
        onOpenGroup={onOpenGroup}
      />
    );
  });
};

/**
 * Leaflet only re-measures its container on a window resize. When the map's
 * panel is hidden and shown again (tabs), or the browser bars change the
 * viewport, the container size changes without one: tiles then stop short of
 * the bottom edge. Watching the container itself fixes both.
 */
const KeepSized = () => {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
    };
  }, [map]);
  return null;
};

interface PeerPinsProps {
  readonly peers: ReadonlyMap<string, PeerPosition>;
  readonly profiles: ReadonlyMap<string, ProfileView>;
}

const PeerPin = ({
  profile,
  peer,
}: {
  readonly profile: ProfileView | undefined;
  readonly peer: PeerPosition;
}) => {
  const icon = useMemo(() => peerIcon(profile, peer.stale), [profile, peer.stale]);
  return (
    <Marker
      position={toTuple(peer.position)}
      icon={icon}
      zIndexOffset={PEER_Z_OFFSET}
      interactive={false}
    />
  );
};

/** Everyone currently sharing their position, as their own avatar pin. */
const PeerPins = ({ peers, profiles }: PeerPinsProps) =>
  [...peers].map(([authorId, peer]) => (
    <PeerPin key={authorId} profile={profiles.get(authorId)} peer={peer} />
  ));

const StopPin = ({ stop }: { readonly stop: Stop }) => {
  const icon = useMemo(stopIcon, []);
  const position = useMemo(() => toTuple(stop.position), [stop.position]);
  return <Marker position={position} icon={icon} title={stop.name} />;
};

/**
 * Your own dot lives in its own component: the GPS updates about once a
 * second, and that must not re-render (and so rebuild) every pin on the map.
 */
const OwnPositionMarker = () => {
  const position = useOwnPosition();
  const icon = useMemo(ownPositionIcon, []);
  return position === null ? null : (
    <Marker
      position={toTuple(position)}
      icon={icon}
      zIndexOffset={OWN_POSITION_Z_OFFSET}
      interactive={false}
    />
  );
};

const MapViewContent = ({ snapshot, onOpenPhoto, onOpenGroup, choices, peers }: MapViewProps) => {
  const dark = usePrefersDark();
  const placed = useMemo(() => placedPhotos(snapshot.photos), [snapshot.photos]);
  const route = snapshot.stops.map(({ position }) => toTuple(position));
  const points = [...route, ...placed.map(({ position }) => toTuple(position))];
  const lines = useMemo(() => routeLines(snapshot, choices, dark), [snapshot, choices, dark]);
  const stations = useMemo(() => stationsOf(snapshot, choices), [snapshot, choices]);
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
      <KeepSized />
      {lines.map(({ key, positions, style }) => (
        <Fragment key={key}>
          {/* A thin halo under solid (ride) lines, like a real transit map,
              so a bright line colour stays legible over the streets below. */}
          {style.dashArray === null && (
            <Polyline
              positions={[...positions]}
              pathOptions={{
                color: dark ? 'rgba(10, 14, 20, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                weight: style.weight + 3,
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              interactive={false}
            />
          )}
          <Polyline
            positions={[...positions]}
            pathOptions={{
              color: style.color,
              weight: style.weight,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
              ...(style.dashArray === null ? {} : { dashArray: style.dashArray }),
            }}
          />
        </Fragment>
      ))}
      {stations.map(({ key, station, color, labelled }) => (
        <CircleMarker
          key={key}
          center={toTuple(station.position)}
          radius={5}
          pathOptions={{ color, weight: 3, fillColor: '#ffffff', fillOpacity: 1 }}
        >
          {/* Like a transit map: only the stations you use, always labelled. */}
          {labelled ? (
            <Tooltip permanent direction="right" offset={[6, 0]} className="station-label">
              <span
                className="mr-1 inline-block size-1.5 rounded-full align-middle"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              {station.name}
            </Tooltip>
          ) : null}
        </CircleMarker>
      ))}
      {snapshot.stops.map((stop) => (
        <StopPin key={stop.id} stop={stop} />
      ))}
      <PhotoPins
        photos={placed}
        profiles={snapshot.profiles}
        onOpenPhoto={onOpenPhoto}
        onOpenGroup={onOpenGroup}
      />
      <PeerPins peers={peers} profiles={snapshot.profiles} />
      <OwnPositionMarker />
    </MapContainer>
  );
};

/** Memoized: the screen around it re-renders on every GPS fix and live ping. */
export const MapView = memo(MapViewContent);
