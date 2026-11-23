import { useEffect, useState } from 'react';
import { Polyline } from 'react-leaflet';

import { METRO_FILE, type MetroMap, parseMetroFile } from '../lib/metro';

/** Loads public/map/metro.json (same origin) once; nothing if it does not exist. */
const useMetro = (): MetroMap | null => {
  const [metro, setMetro] = useState<MetroMap | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(new URL(METRO_FILE, document.baseURI).href, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (json: unknown) => {
          setMetro(parseMetroFile(json));
        },
        () => undefined,
      );
    return () => {
      controller.abort();
    };
  }, []);
  return metro;
};

/**
 * The whole metro network, faint, in each line's colour. The itinerary is
 * drawn on top of it, stronger, so you see which line takes you where.
 */
export const MetroLayer = () => {
  const metro = useMetro();
  return metro?.lines.map((line) => (
    <Polyline
      key={line.ref}
      positions={line.path.map(({ lat, lng }): [number, number] => [lat, lng])}
      pathOptions={{ color: line.color, weight: 3, opacity: 0.35, interactive: false }}
    />
  ));
};
