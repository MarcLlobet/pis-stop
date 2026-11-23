import type { EventInfo, LatLng, Meta, Photo, Profile, Stop } from './types';

type Fields = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isNonEmptyString = (value: unknown): value is string => isString(value) && value.length > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const isLatLng = (value: unknown): value is LatLng =>
  isRecord(value) &&
  isFiniteNumber(value['lat']) &&
  isFiniteNumber(value['lng']) &&
  Math.abs(value['lat']) <= 90 &&
  Math.abs(value['lng']) <= 180;

const isEventInfo = (value: Fields): value is EventInfo & Fields => isNonEmptyString(value['name']);

const isStop = (value: Fields): value is Stop & Fields =>
  isNonEmptyString(value['id']) &&
  isNonEmptyString(value['name']) &&
  isFiniteNumber(value['order']) &&
  isLatLng(value['position']);

const isProfile = (value: Fields): value is Profile & Fields =>
  isNonEmptyString(value['id']) &&
  isNonEmptyString(value['name']) &&
  isString(value['email']) &&
  isNonEmptyString(value['imageType']) &&
  isNonEmptyString(value['createdAt']);

const isPhoto = (value: Fields): value is Photo & Fields =>
  isNonEmptyString(value['id']) &&
  isNonEmptyString(value['authorId']) &&
  (value['stopId'] === null || isNonEmptyString(value['stopId'])) &&
  (value['position'] === null || isLatLng(value['position'])) &&
  isNonEmptyString(value['takenAt']) &&
  isNonEmptyString(value['fullUrl']) &&
  isNonEmptyString(value['imageType']) &&
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
      return isEventInfo(value) ? { kind: 'event', name: value.name } : null;
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
            imageType: value.imageType,
            width: value.width,
            height: value.height,
          }
        : null;
    default:
      return null;
  }
};
