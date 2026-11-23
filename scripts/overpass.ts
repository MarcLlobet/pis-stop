import type { Bbox } from '../src/lib/map-area';
import { type MetroMap, parseOverpass } from '../src/lib/metro';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

/** Every metro line (both directions) in the box, plus the names of their stops. */
export const metroQuery = ({ west, south, east, north }: Bbox): string =>
  [
    '[out:json][timeout:120];',
    `rel["route"="subway"](${String(south)},${String(west)},${String(north)},${String(east)})->.lines;`,
    '.lines out geom;',
    'node(r.lines)["name"];',
    'out;',
  ].join('\n');

/** Public OpenStreetMap data: no key, no account. */
export const fetchMetro = async (bbox: Bbox): Promise<MetroMap> => {
  const response = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'pis-stop (https://github.com/MarcLlobet/pis-stop)',
    },
    body: new URLSearchParams({ data: metroQuery(bbox) }),
  });
  if (!response.ok) {
    throw new Error(`Overpass answered ${String(response.status)}`);
  }
  return parseOverpass(await response.json());
};
