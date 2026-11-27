/**
 * Stand-in for the Ably channel: an in-memory bus with the same interface as
 * `platform/live-channel.ts`. Tests deliver pings as another phone would, and
 * read back exactly what the transport carried.
 */
import type { Bytes } from '../lib/types';
import type { LiveChannel } from '../platform/live-channel';

interface Joined {
  readonly key: string;
  readonly tag: string;
  readonly clientId: string;
}

type Listener = (data: Bytes) => void;

const state: {
  joined: readonly Joined[];
  carried: readonly { readonly tag: string; readonly data: Bytes }[];
  listeners: readonly { readonly tag: string; readonly listener: Listener }[];
} = { joined: [], carried: [], listeners: [] };

/* eslint-disable functional/immutable-data -- the single mutable cell of this test double */
const deliver = (tag: string, data: Bytes): void => {
  state.carried = [...state.carried, { tag, data }];
  const listeners = state.listeners.filter((entry) => entry.tag === tag);
  listeners.forEach(({ listener }) => {
    listener(data);
  });
};

export const liveBus = {
  /** What another phone in the channel sends. */
  deliver,
  /** Who connected, with which key, to which channel. */
  joined: (): readonly Joined[] => state.joined,
  /** Every message the transport carried, from anyone. */
  carried: () => state.carried,
  reset: (): void => {
    state.joined = [];
    state.carried = [];
    state.listeners = [];
  },
};

export const createLiveChannel = (
  key: string,
  tag: string,
  clientId: string,
): Promise<LiveChannel> => {
  state.joined = [...state.joined, { key, tag, clientId }];
  return Promise.resolve({
    publish: (data) => {
      deliver(tag, data);
      return Promise.resolve();
    },
    subscribe: (listener) => {
      const entry = { tag, listener };
      state.listeners = [...state.listeners, entry];
      return () => {
        state.listeners = state.listeners.filter((candidate) => candidate !== entry);
      };
    },
    enterPresence: () => Promise.resolve(),
    leavePresence: () => Promise.resolve(),
    onPeerLeft: () => () => undefined,
    suspend: () => undefined,
    resume: () => undefined,
    close: () => undefined,
  });
};
/* eslint-enable functional/immutable-data */
