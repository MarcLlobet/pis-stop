import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AblyConfig } from '../lib/config';
import type { EventKeys } from '../lib/crypto';
import { type Identity, importPublicKey } from '../lib/identity';
import { isExpired, isStale, openPing, sealPing } from '../lib/location';
import type { ProfileView } from '../lib/snapshot';
import type { LatLng } from '../lib/types';
import { createLiveChannel, type LiveChannel } from '../platform/live-channel';
import { useOwnPosition } from './use-own-position';

interface RawPeer {
  readonly position: LatLng;
  readonly receivedAt: number;
  readonly at: Date;
}

export interface PeerPosition extends RawPeer {
  readonly stale: boolean;
}

export interface LiveLocationState {
  /** Whether an Ably key is configured at all: `false` hides the feature entirely. */
  readonly available: boolean;
  readonly sharing: boolean;
  readonly setSharing: (sharing: boolean) => void;
  readonly peers: ReadonlyMap<string, PeerPosition>;
}

interface UseLiveLocationOptions {
  readonly config: AblyConfig | null;
  readonly keys: EventKeys | null;
  readonly identity: Identity | null;
  readonly profiles: ReadonlyMap<string, ProfileView> | null;
}

/** How often this device publishes its own position, once sharing is on. */
const PUBLISH_INTERVAL_MS = 20_000;
/** How often stale/expired peers are re-evaluated between incoming pings. */
const TICK_MS = 5_000;

const publicKeyOf =
  (profiles: ReadonlyMap<string, ProfileView>) =>
  async (authorId: string): Promise<CryptoKey | null> => {
    const profile = profiles.get(authorId);
    return profile === undefined ? null : importPublicKey(profile.publicKey);
  };

/**
 * Live, opt-in position sharing between everyone at the same event, carried
 * over Ably: every ping is sealed and signed exactly like a photo (see
 * `lib/location.ts`), so the transport only ever moves bytes it cannot read
 * or forge. One combined toggle: off means no connection at all, and neither
 * sharing nor seeing anyone else's position.
 */
export const useLiveLocation = ({
  config,
  keys,
  identity,
  profiles,
}: UseLiveLocationOptions): LiveLocationState => {
  // On by default while the app is open: the group chose this. It still
  // stops the moment the tab is hidden or sharing is turned off explicitly.
  const [sharing, setSharingState] = useState(true);
  const [channel, setChannel] = useState<LiveChannel | null>(null);
  const [rawPeers, setRawPeers] = useState<ReadonlyMap<string, RawPeer>>(new Map());
  const [now, setNow] = useState(() => Date.now());
  const ownPosition = useOwnPosition();
  const ownPositionRef = useRef<LatLng | null>(null);

  const dropPeer = useCallback((authorId: string) => {
    setRawPeers((current) =>
      current.has(authorId) ? new Map([...current].filter(([id]) => id !== authorId)) : current,
    );
  }, []);

  // The channel connection itself: independent of the device's own position,
  // so a GPS update never tears down and reopens the Ably connection.
  useEffect(() => {
    if (!sharing || config === null || keys === null || identity === null || profiles === null) {
      setChannel(null);
      setRawPeers(new Map());
      return undefined;
    }
    const controller = new AbortController();
    const resolveAuthor = publicKeyOf(profiles);

    void createLiveChannel(config.key, keys.tag, identity.id).then((created) => {
      if (controller.signal.aborted) {
        created.close();
        return;
      }
      setChannel(created);
      void created.enterPresence();

      const unsubscribeMessages = created.subscribe((data) => {
        void openPing(keys.aes, data, resolveAuthor).then((ping) => {
          if (ping !== null && ping.authorId !== identity.id) {
            setRawPeers(
              (current) =>
                new Map([
                  ...current,
                  [ping.authorId, { position: ping.position, receivedAt: Date.now(), at: ping.at }],
                ]),
            );
          }
        });
      });
      const unsubscribeLeave = created.onPeerLeft(dropPeer);
      const onVisibilityChange = () => {
        if (document.hidden) {
          created.suspend();
        } else {
          created.resume();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);

      controller.signal.addEventListener('abort', () => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        unsubscribeMessages();
        unsubscribeLeave();
        void created.leavePresence();
        created.close();
      });
    });

    return () => {
      controller.abort();
    };
  }, [sharing, config, keys, identity, profiles, dropPeer]);

  // The latest own position, for the publish timer below to read without
  // itself depending on it (a GPS update must not reset that timer).
  useEffect(() => {
    /* eslint-disable-next-line functional/immutable-data -- latest position for the stable publish timer */
    ownPositionRef.current = ownPosition;
  }, [ownPosition]);

  useEffect(() => {
    if (channel === null || keys === null || identity === null) {
      return undefined;
    }
    const publish = () => {
      const position = ownPositionRef.current;
      if (position !== null) {
        void sealPing(keys.aes, identity.privateKey, {
          authorId: identity.id,
          position,
          at: new Date(),
        }).then(channel.publish);
      }
    };
    const interval = setInterval(publish, PUBLISH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [channel, keys, identity]);

  // Re-evaluates staleness, and prunes long-expired peers, between pings.
  useEffect(() => {
    if (!sharing) {
      return undefined;
    }
    const interval = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      clearInterval(interval);
    };
  }, [sharing]);

  useEffect(() => {
    setRawPeers((current) => {
      const alive = [...current].filter(([, peer]) => !isExpired(peer.receivedAt, now));
      return alive.length === current.size ? current : new Map(alive);
    });
  }, [now]);

  const peers = useMemo(
    () =>
      new Map(
        [...rawPeers].map(([authorId, peer]) => [
          authorId,
          { ...peer, stale: isStale(peer.receivedAt, now) },
        ]),
      ),
    [rawPeers, now],
  );

  const setSharing = useCallback(
    (next: boolean) => {
      if (config !== null) {
        setSharingState(next);
      }
    },
    [config],
  );

  return { available: config !== null, sharing, setSharing, peers };
};
