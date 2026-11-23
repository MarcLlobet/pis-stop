/** Bytes backed by a plain ArrayBuffer, which is what WebCrypto accepts. */
export type Bytes = Uint8Array<ArrayBuffer>;

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export interface EventInfo {
  readonly kind: 'event';
  readonly name: string;
}

export interface Stop {
  readonly kind: 'stop';
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly position: LatLng;
}

export interface Profile {
  readonly kind: 'profile';
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly imageType: string;
  readonly createdAt: string;
}

export interface Photo {
  readonly kind: 'photo';
  readonly id: string;
  readonly authorId: string;
  readonly stopId: string | null;
  readonly position: LatLng | null;
  readonly takenAt: string;
  /** Location of the encrypted full-size image. */
  readonly fullUrl: string;
  readonly imageType: string;
  readonly width: number;
  readonly height: number;
}

export type Meta = EventInfo | Stop | Profile | Photo;

/**
 * The unit stored in Cloudinary: metadata plus an inline payload (a thumbnail
 * or an avatar). Every entry is encrypted as a whole before upload.
 */
export interface Entry<M extends Meta = Meta> {
  readonly meta: M;
  readonly payload: Bytes;
}
