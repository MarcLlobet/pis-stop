import { useEffect, useState } from 'react';

import type { LatLng } from '../lib/types';
import { watchPosition } from '../platform/geolocation';

/** This device's own position, kept live; `null` until the first fix (or without geolocation). */
export const useOwnPosition = (): LatLng | null => {
  const [position, setPosition] = useState<LatLng | null>(null);
  useEffect(() => {
    const watch = watchPosition(setPosition);
    return watch.stop;
  }, []);
  return position;
};
