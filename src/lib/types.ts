/** Bytes backed by a plain ArrayBuffer, which is what WebCrypto accepts. */
export type Bytes = Uint8Array<ArrayBuffer>;

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/** Signed by the organizer. Its key must match the fingerprint in the invite. */
export interface EventInfo {
  readonly kind: 'event';
  readonly name: string;
  /** Organizer's ECDSA P-256 public key, raw (65 bytes), base64url. */
  readonly organizerKey: string;
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
