import { isValidName } from './cloudinary';
import type {
  Category,
  EventInfo,
  Host,
  LatLng,
  Leg,
  LegOption,
  Meta,
  Photo,
  Profile,
  Ride,
  Round,
  Scores,
  Segment,
  Station,
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
  return items.every((item): item is T => item !== null) ? items : null;
};

const parseStep = (value: unknown): TransitStep | null =>
  isRecord(value) &&
  isString(value['line']) &&
  /^[A-Za-z0-9]{1,6}$/.test(value['line']) &&
  isName(value['from']) &&
  isName(value['to'])
    ? { line: value['line'], from: value['from'], to: value['to'] }
    : null;

const isCount =
  (max: number) =>
  (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

const isMinutes = isCount(600);
const isMeters = isCount(200_000);

const parseStation = (value: unknown): Station | null =>
  isRecord(value) && isName(value['name']) && isLatLng(value['position'])
    ? { name: value['name'], position: { lat: value['position'].lat, lng: value['position'].lng } }
    : null;

const parseRide = (value: unknown): Ride | null => {
  if (!isRecord(value)) {
    return null;
  }
  const { line, color, vehicle, headsign, stops } = value;
  const from = parseStation(value['from']);
  const to = parseStation(value['to']);
  return isString(line) &&
    /^[A-Za-z0-9 ]{1,10}$/.test(line) &&
    (color === null || (isString(color) && /^#[0-9a-fA-F]{6}$/.test(color))) &&
    isTravelMode(vehicle) &&
    from !== null &&
    to !== null &&
    (headsign === '' || isName(headsign)) &&
    isCount(200)(stops)
    ? { line, color, vehicle, from, to, headsign, stops }
    : null;
};

const parseSegment = (value: unknown): Segment | null => {
  if (!isRecord(value)) {
    return null;
  }
  const { mode, minutes, meters } = value;
  const path = parseList(value['path'], 1000, parsePoint);
  const ride = value['ride'] === null ? null : parseRide(value['ride']);
  return (mode === 'walk' || mode === 'bike' || mode === 'ride') &&
    isMinutes(minutes) &&
    isMeters(meters) &&
    path !== null &&
    (mode === 'ride') === (ride !== null)
    ? { mode, minutes, meters, path, ride }
    : null;
};

const parseOption = (value: unknown): LegOption | null => {
  if (!isRecord(value) || !isTravelMode(value['mode'])) {
    return null;
  }
  const minutes = value['minutes'];
  const steps = value['steps'] === undefined ? [] : parseList(value['steps'], 5, parseStep);
  const segments =
    value['segments'] === undefined ? [] : parseList(value['segments'], 20, parseSegment);
  return isMinutes(minutes) && steps !== null && segments !== null
    ? { mode: value['mode'], minutes, steps, segments }
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

const isPresetName = (value: unknown): boolean =>
  value === undefined || (isString(value) && value.length <= 64 && isValidName(value));

const isEventInfo = (value: Fields): value is EventInfo & Fields =>
  isName(value['name']) &&
  isBase64Url(value['organizerKey']) &&
  parseLegs(value['legs']) !== null &&
  isPresetName(value['uploadPreset']);

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
  (value['position'] === null || isLatLng(value['position'])) &&
  isIsoDate(value['takenAt']) &&
  isText(500)(value['fullUrl']) &&
  isSha256Hex(value['fullSha256']) &&
  isImageType(value['imageType']) &&
  isFiniteNumber(value['width']) &&
  isFiniteNumber(value['height']);

const isHost = (value: Fields): value is Host & Fields =>
  isId(value['profileId']) && isIsoDate(value['grantedAt']);

const isRound = (value: Fields): value is Round & Fields =>
  isId(value['id']) &&
  isId(value['stopId']) &&
  isId(value['authorId']) &&
  (value['status'] === 'open' || value['status'] === 'closed') &&
  isIsoDate(value['at']);

export const CATEGORIES: readonly Category[] = ['presentation', 'originality', 'taste', 'craft'];

const isStars = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;

/** Exactly the four categories, each a whole number of stars from 1 to 5. */
const parseScores = (value: unknown): Scores | null =>
  isRecord(value) &&
  Object.keys(value).length === CATEGORIES.length &&
  CATEGORIES.every((category) => isStars(value[category]))
    ? {
        presentation: value['presentation'] as number,
        originality: value['originality'] as number,
        taste: value['taste'] as number,
        craft: value['craft'] as number,
      }
    : null;

const isRatingShape = (value: Fields): boolean =>
  isId(value['id']) && isId(value['stopId']) && isId(value['authorId']) && isIsoDate(value['at']);

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
            legs: parseLegs(value.legs) ?? [],
            ...(value.uploadPreset === undefined ? {} : { uploadPreset: value.uploadPreset }),
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
            position: value.position && { lat: value.position.lat, lng: value.position.lng },
            takenAt: value.takenAt,
            fullUrl: value.fullUrl,
            fullSha256: value.fullSha256,
            imageType: value.imageType,
            width: value.width,
            height: value.height,
          }
        : null;
    case 'host':
      return isHost(value)
        ? { kind: 'host', profileId: value.profileId, grantedAt: value.grantedAt }
        : null;
    case 'round':
      return isRound(value)
        ? {
            kind: 'round',
            id: value.id,
            stopId: value.stopId,
            authorId: value.authorId,
            status: value.status,
            at: value.at,
          }
        : null;
    case 'rating': {
      const scores = parseScores(value['scores']);
      return isRatingShape(value) && scores !== null
        ? {
            kind: 'rating',
            id: value['id'] as string,
            stopId: value['stopId'] as string,
            authorId: value['authorId'] as string,
            scores,
            at: value['at'] as string,
          }
        : null;
    }
    default:
      return null;
  }
};
