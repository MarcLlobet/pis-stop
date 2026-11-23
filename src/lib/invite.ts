import { SECRET_BYTES } from './crypto';
import { fromBase64Url, toBase64Url } from './encoding';
import type { Bytes } from './types';

const PARAM = 'k';

/**
 * The secret travels in the URL fragment (`#k=…`). Browsers never send the
 * fragment to the server, so GitHub Pages never sees it.
 */
export const buildInviteUrl = (appUrl: string, secret: Bytes): string => {
  const url = new URL(appUrl);
  return `${url.origin}${url.pathname}#${PARAM}=${toBase64Url(secret)}`;
};

export const readInviteSecret = (hash: string): Bytes | null => {
  const encoded = new URLSearchParams(hash.replace(/^#/, '')).get(PARAM);
  const secret = encoded === null ? null : fromBase64Url(encoded);
  return secret?.length === SECRET_BYTES ? secret : null;
};
