import { SECRET_BYTES } from './crypto';
import { fromBase64Url, toBase64Url } from './encoding';
import type { Bytes } from './types';

export interface Invite {
  /** 256-bit group secret. */
  readonly secret: Bytes;
  /** Fingerprint of the organizer's public key (16 bytes, base64url). */
  readonly organizer: string;
}

const FINGERPRINT = /^[A-Za-z0-9_-]{22}$/;

export const isFingerprint = (value: string): boolean => FINGERPRINT.test(value);

/**
 * Everything travels in the URL fragment (`#k=…&o=…`). Browsers never send the
 * fragment to the server, so GitHub Pages never sees it.
 */
export const buildInviteUrl = (appUrl: string, invite: Invite): string => {
  const url = new URL(appUrl);
  return `${url.origin}${url.pathname}#k=${toBase64Url(invite.secret)}&o=${invite.organizer}`;
};

export const readInvite = (hash: string): Invite | null => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const encoded = params.get('k');
  const organizer = params.get('o');
  const secret = encoded === null ? null : fromBase64Url(encoded);
  return secret?.length === SECRET_BYTES && organizer !== null && isFingerprint(organizer)
    ? { secret, organizer }
    : null;
};

/**
 * An invite typed, pasted or scanned: the whole link, or just its `#k=…&o=…`
 * part. Only the fragment is read, so the link's address does not matter.
 */
export const readInviteText = (text: string): Invite | null => {
  const trimmed = text.trim();
  const start = trimmed.indexOf('#');
  return start === -1 ? null : readInvite(trimmed.slice(start));
};
