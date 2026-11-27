/**
 * An in-memory Cloudinary that answers the same HTTP requests as the real
 * one (upload, list by tag, delivery, and the Admin API for presets). It sits
 * behind the real client, so every request goes through the production URL
 * checks, size limits and encryption: it plays the part MSW would, at the
 * `fetch` boundary, without a network or a service worker.
 *
 * It also keeps a log of every request, so tests can check what the server
 * actually got to see.
 */
import type { AdminCredentials } from '../lib/cloudinary-admin';
import type { Bytes } from '../lib/types';

export interface StoredFile {
  readonly url: string;
  readonly bytes: Bytes;
  readonly tags: readonly string[];
  readonly preset: string;
}

export interface LoggedRequest {
  readonly url: string;
  readonly method: string;
  /** The uploaded file, or the JSON body of an Admin API call, as bytes. */
  readonly body: Bytes;
}

interface State {
  files: readonly StoredFile[];
  presets: ReadonlySet<string>;
  log: readonly LoggedRequest[];
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Works under jsdom too, thanks to the `arrayBuffer` polyfill in setup.ts. */
export const readBlob = async (blob: Blob): Promise<Bytes> =>
  new Uint8Array(await blob.arrayBuffer());

const bodyBytes = async (body: RequestInit['body']): Promise<Bytes> => {
  if (body instanceof FormData) {
    const file = body.get('file');
    return file instanceof Blob ? readBlob(file) : new Uint8Array(0);
  }
  return typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(0);
};

export const createFakeCloudinary = (
  cloudName: string,
  credentials?: Pick<AdminCredentials, 'apiKey' | 'apiSecret'>,
) => {
  const state: State = { files: [], presets: new Set(), log: [] };
  const api = `https://api.cloudinary.com/v1_1/${cloudName}`;
  const delivery = `https://res.cloudinary.com/${cloudName}/raw/upload/v1/`;
  const list = `https://res.cloudinary.com/${cloudName}/raw/list/`;
  const authorization =
    credentials === undefined
      ? null
      : `Basic ${btoa(`${credentials.apiKey}:${credentials.apiSecret}`)}`;

  /* eslint-disable functional/immutable-data -- the single mutable cell of this test double */
  const addPreset = (name: string): void => {
    state.presets = new Set([...state.presets, name]);
  };

  const removePreset = (name: string): boolean => {
    const existed = state.presets.has(name);
    state.presets = new Set([...state.presets].filter((preset) => preset !== name));
    return existed;
  };

  const upload = (body: FormData, bytes: Bytes): Response => {
    const preset = body.get('upload_preset');
    if (typeof preset !== 'string' || !state.presets.has(preset)) {
      return json({ error: { message: 'Upload preset not found' } }, 400);
    }
    const tags = body.get('tags');
    const file: StoredFile = {
      url: `${delivery}f${String(state.files.length)}`,
      bytes,
      tags: typeof tags === 'string' ? tags.split(',').filter(Boolean) : [],
      preset,
    };
    state.files = [...state.files, file];
    return json({ secure_url: file.url });
  };

  const admin = (url: string, init: RequestInit | undefined): Response => {
    if (
      authorization === null ||
      new Headers(init?.headers).get('Authorization') !== authorization
    ) {
      return json({ error: { message: 'Invalid credentials' } }, 401);
    }
    if (init?.method === 'POST' && url === `${api}/upload_presets`) {
      const parsed: unknown = JSON.parse(typeof init.body === 'string' ? init.body : '{}');
      const name: unknown =
        typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'name') : undefined;
      if (typeof name !== 'string') {
        return json({ error: { message: 'Missing name' } }, 400);
      }
      addPreset(name);
      return json({ message: 'created', name });
    }
    if (init?.method === 'DELETE') {
      const name = decodeURIComponent(url.slice(`${api}/upload_presets/`.length));
      return removePreset(name) ? json({ message: 'deleted' }) : json({ error: {} }, 404);
    }
    return json({ error: { message: 'Unsupported' } }, 400);
  };

  const fetchFn = async (url: string, init?: RequestInit): Promise<Response> => {
    const body = await bodyBytes(init?.body);
    state.log = [...state.log, { url, method: init?.method ?? 'GET', body }];
    if (url.startsWith(`${api}/upload_presets`)) {
      return admin(url, init);
    }
    if (url === `${api}/raw/upload` && init?.body instanceof FormData) {
      return upload(init.body, body);
    }
    if (url.startsWith(list)) {
      const tag = decodeURIComponent(url.slice(list.length).replace(/\.json$/, ''));
      const tagged = state.files.filter((file) => file.tags.includes(tag));
      return tagged.length === 0
        ? new Response(null, { status: 404 })
        : json({
            resources: tagged.map((file) => ({
              public_id: file.url.slice(delivery.length),
              version: 1,
            })),
          });
    }
    const file = state.files.find((candidate) => candidate.url === url);
    return file === undefined ? new Response(null, { status: 404 }) : new Response(file.bytes);
  };

  /** What an attacker with access to the account could do: rewrite a stored file. */
  const tamper = (url: string, change: (bytes: Bytes) => Bytes): void => {
    state.files = state.files.map((file) =>
      file.url === url ? { ...file, bytes: change(file.bytes) } : file,
    );
  };
  /* eslint-enable functional/immutable-data */

  return {
    fetch: fetchFn,
    addPreset,
    hasPreset: (name: string): boolean => state.presets.has(name),
    files: (): readonly StoredFile[] => state.files,
    log: (): readonly LoggedRequest[] => state.log,
    tamper,
  };
};

export type FakeCloudinary = ReturnType<typeof createFakeCloudinary>;
