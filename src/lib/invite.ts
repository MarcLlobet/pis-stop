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
  return secret?.length === SECRET_BYTES && organizer !== null && FINGERPRINT.test(organizer)
    ? { secret, organizer }
    : null;
};
