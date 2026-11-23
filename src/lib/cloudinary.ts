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
  readonly download: (url: string) => Promise<Bytes>;
  /** Uploads opaque bytes and resolves with their delivery URL. */
  readonly upload: (bytes: Bytes, tags: readonly string[]) => Promise<string>;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const NAME = /^[A-Za-z0-9_-]+$/;
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

export const isValidName = (value: string): boolean => NAME.test(value);

/** Everything is uploaded as `raw`: Cloudinary only ever sees ciphertext. */
export const uploadEndpoint = ({ cloudName }: CloudinaryConfig): string =>
  `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;

/** Requires "Resource list" to be allowed in the Cloudinary security settings. */
export const listEndpoint = ({ cloudName }: CloudinaryConfig, tag: string): string =>
  `https://res.cloudinary.com/${cloudName}/raw/list/${encodeURIComponent(tag)}.json`;

export const deliveryUrl = ({ cloudName }: CloudinaryConfig, resource: RawResource): string =>
  `https://res.cloudinary.com/${cloudName}/raw/upload/v${resource.version}/${resource.publicId}`;

export const parseListResponse = (json: unknown): readonly RawResource[] => {
  const resources = isRecord(json) ? json['resources'] : undefined;
  return Array.isArray(resources)
    ? resources.flatMap((item: unknown): readonly RawResource[] =>
        isRecord(item) &&
        typeof item['public_id'] === 'string' &&
        typeof item['version'] === 'number'
          ? [{ publicId: item['public_id'], version: item['version'] }]
          : [],
      )
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

export const createCloudinaryClient = (
  config: CloudinaryConfig,
  fetchFn: Fetch = (input, init) => fetch(input, init),
): CloudinaryClient => ({
  list: async (tag) => {
    const response = await fetchFn(listEndpoint(config, tag), { cache: 'no-store' });
    // Cloudinary answers 404 when a tag has no resources yet.
    if (response.status === 404) {
      return [];
    }
    const resources = parseListResponse(await ensureOk(response, 'list').json());
    return resources.map((resource) => deliveryUrl(config, resource));
  },
  download: async (url) => {
    const response = ensureOk(await fetchFn(url), 'download');
    return new Uint8Array(await response.arrayBuffer());
  },
  upload: async (bytes, tags) => {
    const body = new FormData();
    body.append('file', new Blob([bytes], { type: 'application/octet-stream' }));
    body.append('upload_preset', config.uploadPreset);
    if (tags.length > 0) {
      body.append('tags', tags.join(','));
    }
    const response = ensureOk(
      await fetchFn(uploadEndpoint(config), { method: 'POST', body }),
      'upload',
    );
    const url = parseUploadResponse(await response.json());
    if (url === null) {
      throw new Error('Cloudinary upload response did not include a URL');
    }
    return url;
  },
});
