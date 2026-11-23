/** Bytes backed by a plain ArrayBuffer, which is what WebCrypto accepts. */
export type Bytes = Uint8Array<ArrayBuffer>;

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export type TravelMode = 'metro' | 'train' | 'tram' | 'bus' | 'walk' | 'bike';

/** One ride on a line, e.g. L4 from Joanic to Verdaguer. */
export interface TransitStep {
  readonly line: string;
  readonly from: string;
  readonly to: string;
}

/** A metro or bus station, as shown on the map. */
export interface Station {
  readonly name: string;
  readonly position: LatLng;
}

/** One ride: board at `from`, get off at `to`. */
export interface Ride {
  readonly line: string;
  /** Line colour as `#rrggbb`, when the data provides one. */
  readonly color: string | null;
  readonly vehicle: TravelMode;
  readonly from: Station;
  readonly to: Station;
  readonly headsign: string;
  readonly stops: number;
}

/**
 * A continuous part of a route, Google-style: walk to the station, ride the
 * metro, change, walk to the flat. `path` is the real geometry.
 */
export interface Segment {
  readonly mode: 'walk' | 'bike' | 'ride';
  readonly minutes: number;
  readonly meters: number;
  readonly path: readonly LatLng[];
  readonly ride: Ride | null;
}

/** One way of covering a leg: by metro (with its changes), on foot or by bike. */
export interface LegOption {
  readonly mode: TravelMode;
  readonly minutes: number;
  readonly steps: readonly TransitStep[];
  /** Detailed route, when it was planned with `pnpm event:route`. */
  readonly segments: readonly Segment[];
}

/**
 * How to get from stop N to stop N + 1. The first option is the one drawn on
 * the map; `path` adds optional waypoints so the line can follow the streets
 * or the metro instead of going straight.
 */
export interface Leg {
  readonly options: readonly LegOption[];
  readonly path: readonly LatLng[];
}

/** Signed by the organizer. Its key must match the fingerprint in the invite. */
export interface EventInfo {
  readonly kind: 'event';
  readonly name: string;
  /** Organizer's ECDSA P-256 public key, raw (65 bytes), base64url. */
  readonly organizerKey: string;
  /** Leg N goes from the stop with order N + 1 to the next one. */
  readonly legs: readonly Leg[];
}

/** Signed by the organizer. */
export interface Stop {
  readonly kind: 'stop';
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly position: LatLng;
}

/** Self-signed: `id` must be the fingerprint of `publicKey`. */
export interface Profile {
  readonly kind: 'profile';
  readonly id: string;
  readonly publicKey: string;
  readonly name: string;
  readonly email: string;
  readonly imageType: string;
  readonly createdAt: string;
}

/** Signed by the author's profile key. */
export interface Photo {
  readonly kind: 'photo';
  readonly id: string;
  readonly authorId: string;
  readonly stopId: string | null;
  readonly position: LatLng | null;
  readonly takenAt: string;
  /** Location of the encrypted full-size image. */
  readonly fullUrl: string;
  /** SHA-256 (hex) of the decrypted full-size image, checked when it is opened. */
  readonly fullSha256: string;
  readonly imageType: string;
  readonly width: number;
  readonly height: number;
}

export type Meta = EventInfo | Stop | Profile | Photo;

/**
 * The unit stored in Cloudinary: metadata plus an inline payload (a thumbnail
 * or an avatar). Every entry is signed, then encrypted as a whole.
 */
export interface Entry<M extends Meta = Meta> {
  readonly meta: M;
  readonly payload: Bytes;
}

/** An entry as read from storage, before its signature has been checked. */
export interface SignedEntry extends Entry {
  readonly signature: Bytes;
  /** The exact bytes the signature covers. */
  readonly signedMessage: Bytes;
}
