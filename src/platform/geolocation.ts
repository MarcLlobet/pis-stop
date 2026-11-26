import type { LatLng } from '../lib/types';

/** Resolves with `null` when location is unavailable or denied: never rejects. */
export const currentPosition = (timeoutMs = 8_000): Promise<LatLng | null> =>
  new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({ lat: coords.latitude, lng: coords.longitude });
      },
      () => {
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });

export interface PositionWatch {
  readonly stop: () => void;
}

/** Calls `onPosition` on every update. Never throws; does nothing without geolocation. */
export const watchPosition = (onPosition: (position: LatLng) => void): PositionWatch => {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return { stop: () => undefined };
  }
  const id = navigator.geolocation.watchPosition(
    ({ coords }) => {
      onPosition({ lat: coords.latitude, lng: coords.longitude });
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 10_000 },
  );
  return { stop: () => navigator.geolocation.clearWatch(id) };
};
