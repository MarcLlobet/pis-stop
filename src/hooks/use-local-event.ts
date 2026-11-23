import { useEffect, useState } from 'react';

import type { DemoEvent } from '../lib/demo';
import { loadLocalEvent } from '../platform/local-event';

/** `undefined` while loading; `null` when disabled or there is no event.json. */
export const useLocalEvent = (enabled: boolean): DemoEvent | null | undefined => {
  const [event, setEvent] = useState<DemoEvent | null | undefined>(enabled ? undefined : null);
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const controller = new AbortController();
    void loadLocalEvent()
      .catch(() => null)
      .then((loaded) => {
        if (!controller.signal.aborted) {
          setEvent(loaded);
        }
      });
    return () => {
      controller.abort();
    };
  }, [enabled]);
  return event;
};
