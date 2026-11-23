import type { Bytes } from './types';

export interface CloudinaryConfig {
  readonly cloudName: string;
  readonly uploadPreset: string;
}

export interface RawResource {
  readonly publicId: string;
  readonly version: number;
}

export interface CloudinaryClient {
  /** Resolves with the delivery URLs of every resource carrying `tag`. */
  readonly list: (tag: string) => Promise<readonly string[]>;
  /** Refuses URLs outside this account and responses larger than `maxBytes`. */
  readonly download: (url: string, maxBytes: number) => Promise<Bytes>;
  /** Uploads opaque bytes and resolves with their delivery URL. */
  readonly upload: (bytes: Bytes, tags: readonly string[]) => Promise<string>;
  readonly owns: (url: string) => boolean;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const NAME = /^[A-Za-z0-9_-]+$/;
const PUBLIC_ID = /^[A-Za-z0-9_./-]{1,200}$/;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

export const isValidName = (value: string): boolean => NAME.test(value);

/** Everything is uploaded as `raw`: Cloudinary only ever sees ciphertext. */
export const uploadEndpoint = ({ cloudName }: CloudinaryConfig): string =>
  `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;

/** Requires "Resource list" to be allowed in the Cloudinary security settings. */
export const listEndpoint = ({ cloudName }: CloudinaryConfig, tag: string): string =>
  `https://res.cloudinary.com/${cloudName}/raw/list/${encodeURIComponent(tag)}.json`;

const deliveryPrefix = ({ cloudName }: CloudinaryConfig): string =>
  `https://res.cloudinary.com/${cloudName}/raw/upload/`;

export const deliveryUrl = (config: CloudinaryConfig, resource: RawResource): string =>
  `${deliveryPrefix(config)}v${resource.version}/${resource.publicId}`;

/**
 * URL allowlist. A signed entry still comes from a group member, and a member
 * must not be able to make everyone's phone fetch an arbitrary URL: that would
 * leak their IP addresses to a server of the member's choice.
 */
export const isDeliveryUrl = (config: CloudinaryConfig, url: string): boolean => {
  if (!url.startsWith(deliveryPrefix(config))) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.href === url && parsed.search === '' && !url.includes('..');
  } catch {
    return false;
  }
};

export const parseListResponse = (json: unknown): readonly RawResource[] => {
  const resources = isRecord(json) ? json['resources'] : undefined;
  return Array.isArray(resources)
    ? resources.flatMap((item: unknown): readonly RawResource[] => {
        if (!isRecord(item)) {
          return [];
        }
        const publicId = item['public_id'];
        const version = item['version'];
        return typeof publicId === 'string' &&
          PUBLIC_ID.test(publicId) &&
          !publicId.includes('..') &&
          typeof version === 'number' &&
          Number.isSafeInteger(version)
          ? [{ publicId, version }]
          : [];
      })
    : [];
};

export const parseUploadResponse = (json: unknown): string | null =>
  isRecord(json) && typeof json['secure_url'] === 'string' ? json['secure_url'] : null;

const ensureOk = (response: Response, action: string): Response => {
  if (!response.ok) {
    throw new Error(`Cloudinary ${action} failed with status ${response.status}`);
  }
  return response;
};

const tooLarge = (maxBytes: number): Error =>
  new Error(`Refusing a download larger than ${maxBytes} bytes`);

/** No cookies and no referrer: Cloudinary learns as little as possible. */
const PRIVATE_REQUEST: RequestInit = { credentials: 'omit', referrerPolicy: 'no-referrer' };

export const createCloudinaryClient = (
  config: CloudinaryConfig,
  fetchFn: Fetch = (input, init) => fetch(input, init),
): CloudinaryClient => {
  const owns = (url: string): boolean => isDeliveryUrl(config, url);
  return {
    owns,
    list: async (tag) => {
      const response = await fetchFn(listEndpoint(config, tag), {
        ...PRIVATE_REQUEST,
        cache: 'no-store',
      });
      // Cloudinary answers 404 when a tag has no resources yet.
      if (response.status === 404) {
        return [];
      }
      const resources = parseListResponse(await ensureOk(response, 'list').json());
      return resources.map((resource) => deliveryUrl(config, resource));
    },
    download: async (url, maxBytes) => {
      if (!owns(url)) {
        throw new Error('Refusing to download from outside the Cloudinary account');
      }
      const response = ensureOk(await fetchFn(url, PRIVATE_REQUEST), 'download');
      if (Number(response.headers.get('content-length') ?? 0) > maxBytes) {
        throw tooLarge(maxBytes);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > maxBytes) {
        throw tooLarge(maxBytes);
      }
      return bytes;
    },
    upload: async (bytes, tags) => {
      const body = new FormData();
      body.append('file', new Blob([bytes], { type: 'application/octet-stream' }));
      body.append('upload_preset', config.uploadPreset);
      if (tags.length > 0) {
        body.append('tags', tags.join(','));
      }
      const response = ensureOk(
        await fetchFn(uploadEndpoint(config), { ...PRIVATE_REQUEST, method: 'POST', body }),
        'upload',
      );
      const url = parseUploadResponse(await response.json());
      if (url === null || !owns(url)) {
        throw new Error('Cloudinary upload response did not include a valid URL');
      }
      return url;
    },
  };
};
