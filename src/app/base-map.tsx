// protomaps-leaflet reads Leaflet from the global `L`, which Leaflet 1.x always
// sets on load. map-view.tsx imports Leaflet before this module is used.
import type { Layer } from 'leaflet';
import { leafletLayer } from 'protomaps-leaflet';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { TileLayer, useMap } from 'react-leaflet';

import { MAP_FILE, MAX_DATA_ZOOM } from '../lib/map-area';

const ATTRIBUTION =
  '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

const darkQuery = (): MediaQueryList => window.matchMedia('(prefers-color-scheme: dark)');

const usePrefersDark = (): boolean =>
  useSyncExternalStore(
    (onChange) => {
      const query = darkQuery();
      query.addEventListener('change', onChange);
      return () => {
        query.removeEventListener('change', onChange);
      };
    },
    () => darkQuery().matches,
  );

type Availability = 'checking' | 'available' | 'missing';

/** Checks once whether the map extract has been generated (pnpm map:extract). */
const useMapFile = (url: string): Availability => {
  const [availability, setAvailability] = useState<Availability>('checking');
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { method: 'HEAD', signal: controller.signal }).then(
      (response) => {
        // The dev server answers unknown paths with index.html, so check the type too.
        const isHtml = response.headers.get('content-type')?.includes('text/html') === true;
        setAvailability(response.ok && !isHtml ? 'available' : 'missing');
      },
      () => {
        if (!controller.signal.aborted) {
          setAvailability('missing');
        }
      },
    );
    return () => {
      controller.abort();
    };
  }, [url]);
  return availability;
};

/** Vector map drawn by protomaps-leaflet from a file on this same site. */
const ProtomapsLayer = ({ url, dark }: { readonly url: string; readonly dark: boolean }) => {
  const map = useMap();
  useEffect(() => {
    // The library types its layer loosely (it extends the global `L`).
    const layer = leafletLayer({
      url,
      flavor: dark ? 'dark' : 'light',
      lang: 'ca',
      maxDataZoom: MAX_DATA_ZOOM,
      attribution: ATTRIBUTION,
    }) as unknown as Layer;
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, url, dark]);
  return null;
};

/**
 * The base map. Self-hosted, so neither OpenStreetMap nor anyone else sees
 * which area is being looked at. In development, before the extract exists,
 * it falls back to the public OpenStreetMap tiles (the production CSP does
 * not allow them).
 */
export const BaseMap = () => {
  const url = new URL(MAP_FILE, document.baseURI).href;
  const availability = useMapFile(url);
  const dark = usePrefersDark();

  if (availability === 'available') {
    return <ProtomapsLayer url={url} dark={dark} />;
  }
  if (availability === 'missing' && import.meta.env.DEV) {
    return (
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> (dev: run pnpm map:extract)'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        referrerPolicy="strict-origin"
      />
    );
  }
  return null;
};
