import { fromBase64Url, toBase64Url } from '../lib/encoding';
import type { Bytes } from '../lib/types';

export interface LiveChannel {
  readonly publish: (data: Bytes) => Promise<void>;
  /** Returns an unsubscribe function. */
  readonly subscribe: (onMessage: (data: Bytes) => void) => () => void;
  readonly enterPresence: () => Promise<void>;
  readonly leavePresence: () => Promise<void>;
  /** Returns an unsubscribe function. */
  readonly onPeerLeft: (onLeave: (clientId: string) => void) => () => void;
  /** Detaches without closing the connection, e.g. while the tab is hidden. */
  readonly suspend: () => void;
  readonly resume: () => void;
  readonly close: () => void;
}

const PING_EVENT = 'ping';

/**
 * A thin wrapper over the Ably SDK: everything it carries is already sealed
 * and signed (see `lib/location.ts`), so this layer only ever moves opaque
 * bytes, never a real position. The SDK itself is loaded lazily, only once
 * someone actually turns location sharing on.
 */
export const createLiveChannel = async (
  key: string,
  tag: string,
  clientId: string,
): Promise<LiveChannel> => {
  const { Realtime } = await import('ably');
  const client = new Realtime({ key, clientId });
  const channel = client.channels.get(`location:${tag}`);

  return {
    publish: async (data) => {
      await channel.publish(PING_EVENT, toBase64Url(data));
    },
    subscribe: (onMessage) => {
      const listener = (message: { readonly data?: unknown }) => {
        const bytes = typeof message.data === 'string' ? fromBase64Url(message.data) : null;
        if (bytes !== null) {
          onMessage(bytes);
        }
      };
      void channel.subscribe(PING_EVENT, listener);
      return () => {
        channel.unsubscribe(PING_EVENT, listener);
      };
    },
    enterPresence: async () => {
      await channel.presence.enter();
    },
    leavePresence: async () => {
      await channel.presence.leave();
    },
    onPeerLeft: (onLeave) => {
      const listener = (member: { readonly clientId?: string }) => {
        if (member.clientId !== undefined) {
          onLeave(member.clientId);
        }
      };
      void channel.presence.subscribe('leave', listener);
      return () => {
        channel.presence.unsubscribe('leave', listener);
      };
    },
    suspend: () => {
      void channel.detach();
    },
    resume: () => {
      void channel.attach();
    },
    close: () => {
      client.close();
    },
  };
};
