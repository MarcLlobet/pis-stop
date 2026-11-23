import type { Bytes } from './types';

const BASE64URL = /^[A-Za-z0-9_-]*$/;

export const utf8 = (text: string): Bytes => new TextEncoder().encode(text);

export const fromUtf8 = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

export const toHex = (data: ArrayBuffer | Uint8Array): string =>
  Array.from(data instanceof Uint8Array ? data : new Uint8Array(data), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

export const toBase64Url = (bytes: Uint8Array): string =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

/** Returns `null` instead of throwing on malformed input. */
export const fromBase64Url = (text: string): Bytes | null => {
  if (!BASE64URL.test(text) || text.length % 4 === 1) {
    return null;
  }
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

/** Concatenates byte chunks without mutating any of them. */
export const concatBytes = async (parts: readonly Uint8Array<ArrayBuffer>[]): Promise<Bytes> =>
  new Uint8Array(await new Blob([...parts]).arrayBuffer());

export const safeJsonParse = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};
