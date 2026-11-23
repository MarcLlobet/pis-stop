import type {
  EventInfo,
  LatLng,
  Leg,
  LegOption,
  Meta,
  Photo,
  Profile,
  Stop,
  TransitStep,
  TravelMode,
} from './types';

type Fields = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isNonEmptyString = (value: unknown): value is string => isString(value) && value.length > 0;

/** Bounded text: decrypted data is still untrusted, so nothing is unbounded. */
const isText =
  (max: number) =>
  (value: unknown): value is string =>
    isNonEmptyString(value) && value.length <= max;

const isName = isText(80);
const isId = (value: unknown): value is string =>
  isString(value) && /^[A-Za-z0-9_-]{1,64}$/.test(value);
const isBase64Url = (value: unknown): value is string =>
  isString(value) && /^[A-Za-z0-9_-]{1,200}$/.test(value);
const isSha256Hex = (value: unknown): value is string =>
  isString(value) && /^[0-9a-f]{64}$/.test(value);
/**
 * Only JPEG is accepted from the network. SVG can carry scripts: an SVG made
 * into a blob: URL from this origin and opened in a tab would run with access
 * to the keys. (The demo uses SVG, but its data never passes through here.)
 */
const isImageType = (value: unknown): value is 'image/jpeg' => value === 'image/jpeg';
const isIsoDate = (value: unknown): value is string =>
  isText(40)(value) && !Number.isNaN(Date.parse(value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const isLatLng = (value: unknown): value is LatLng =>
  isRecord(value) &&
  isFiniteNumber(value['lat']) &&
  isFiniteNumber(value['lng']) &&
  Math.abs(value['lat']) <= 90 &&
  Math.abs(value['lng']) <= 180;

const TRAVEL_MODES: readonly TravelMode[] = ['metro', 'train', 'tram', 'bus', 'walk', 'bike'];

const isTravelMode = (value: unknown): value is TravelMode =>
  TRAVEL_MODES.some((mode) => mode === value);

/** Parses a bounded list; `null` if it is not a list, too long, or any item is invalid. */
const parseList = <T>(
  value: unknown,
  max: number,
  parseItem: (item: unknown) => T | null,
): readonly T[] | null => {
  if (!Array.isArray(value) || value.length > max) {
    return null;
  }
  const items = value.map(parseItem);
  return items.every((item) => item !== null) ? (items as readonly T[]) : null;
};

const parseStep = (value: unknown): TransitStep | null =>
  isRecord(value) &&
  isString(value['line']) &&
  /^[A-Za-z0-9]{1,6}$/.test(value['line']) &&
  isName(value['from']) &&
  isName(value['to'])
    ? { line: value['line'], from: value['from'], to: value['to'] }
    : null;

const parseOption = (value: unknown): LegOption | null => {
  if (!isRecord(value) || !isTravelMode(value['mode'])) {
    return null;
  }
  const minutes = value['minutes'];
  const steps = value['steps'] === undefined ? [] : parseList(value['steps'], 5, parseStep);
  return typeof minutes === 'number' &&
    Number.isInteger(minutes) &&
    minutes >= 0 &&
    minutes <= 600 &&
    steps !== null
    ? { mode: value['mode'], minutes, steps }
    : null;
};

const parsePoint = (value: unknown): LatLng | null =>
  isLatLng(value) ? { lat: value.lat, lng: value.lng } : null;

const parseLeg = (value: unknown): Leg | null => {
  if (!isRecord(value)) {
    return null;
  }
  const options = parseList(value['options'], 5, parseOption);
  const path = value['path'] === undefined ? [] : parseList(value['path'], 200, parsePoint);
  return options !== null && path !== null ? { options, path } : null;
};

/** The itinerary between stops. Missing means none; anything invalid means `null`. */
export const parseLegs = (value: unknown): readonly Leg[] | null =>
  value === undefined ? [] : parseList(value, 50, parseLeg);

const isEventInfo = (value: Fields): value is EventInfo & Fields =>
  isName(value['name']) && isBase64Url(value['organizerKey']) && parseLegs(value['legs']) !== null;

const isStop = (value: Fields): value is Stop & Fields =>
  isId(value['id']) &&
  isName(value['name']) &&
  isFiniteNumber(value['order']) &&
  isLatLng(value['position']);

const isProfile = (value: Fields): value is Profile & Fields =>
  isId(value['id']) &&
  isBase64Url(value['publicKey']) &&
  isName(value['name']) &&
  isString(value['email']) &&
  value['email'].length <= 254 &&
  isImageType(value['imageType']) &&
  isIsoDate(value['createdAt']);

const isPhoto = (value: Fields): value is Photo & Fields =>
  isId(value['id']) &&
  isId(value['authorId']) &&
  (value['stopId'] === null || isId(value['stopId'])) &&
  (value['position'] === null || isLatLng(value['position'])) &&
  isIsoDate(value['takenAt']) &&
  isText(500)(value['fullUrl']) &&
  isSha256Hex(value['fullSha256']) &&
  isImageType(value['imageType']) &&
  isFiniteNumber(value['width']) &&
  isFiniteNumber(value['height']);

/**
 * Validates untrusted, decrypted JSON. Anything that does not match the
 * expected shape is dropped rather than trusted.
 */
export const parseMeta = (value: unknown): Meta | null => {
  if (!isRecord(value)) {
    return null;
  }
  switch (value['kind']) {
    case 'event':
      return isEventInfo(value)
        ? {
            kind: 'event',
            name: value.name,
            organizerKey: value.organizerKey,
            legs: parseLegs(value['legs']) ?? [],
          }
        : null;
    case 'stop':
      return isStop(value)
        ? {
            kind: 'stop',
            id: value.id,
            name: value.name,
            order: value.order,
            position: { lat: value.position.lat, lng: value.position.lng },
          }
        : null;
    case 'profile':
      return isProfile(value)
        ? {
            kind: 'profile',
            id: value.id,
            publicKey: value.publicKey,
            name: value.name,
            email: value.email,
            imageType: value.imageType,
            createdAt: value.createdAt,
          }
        : null;
    case 'photo':
      return isPhoto(value)
        ? {
            kind: 'photo',
            id: value.id,
            authorId: value.authorId,
            stopId: value.stopId,
            position: value.position && { lat: value.position.lat, lng: value.position.lng },
            takenAt: value.takenAt,
            fullUrl: value.fullUrl,
            fullSha256: value.fullSha256,
            imageType: value.imageType,
            width: value.width,
            height: value.height,
          }
        : null;
    default:
      return null;
  }
};
