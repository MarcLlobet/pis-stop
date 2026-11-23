import { describe, expect, it, vi } from 'vitest';

import {
  type CloudinaryConfig,
  createCloudinaryClient,
  deliveryUrl,
  isDeliveryUrl,
  isValidName,
  listEndpoint,
  parseListResponse,
  parseUploadResponse,
  uploadEndpoint,
} from './cloudinary';

const config: CloudinaryConfig = { cloudName: 'demo-cloud', uploadPreset: 'pis_stop' };

const own = 'https://res.cloudinary.com/demo-cloud/raw/upload/v1/a';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('endpoints', () => {
  it('builds the raw upload, list and delivery URLs', () => {
    expect(uploadEndpoint(config)).toBe('https://api.cloudinary.com/v1_1/demo-cloud/raw/upload');
    expect(listEndpoint(config, 'ps_abc')).toBe(
      'https://res.cloudinary.com/demo-cloud/raw/list/ps_abc.json',
    );
    expect(deliveryUrl(config, { publicId: 'abc.bin', version: 12 })).toBe(
      'https://res.cloudinary.com/demo-cloud/raw/upload/v12/abc.bin',
    );
  });

  it('validates account and preset names', () => {
    expect(isValidName('my_cloud-1')).toBe(true);
    expect(isValidName('evil.com/x')).toBe(false);
    expect(isValidName('')).toBe(false);
  });
});

describe('isDeliveryUrl', () => {
  it('only allows plain delivery URLs of this account', () => {
    const ok = 'https://res.cloudinary.com/demo-cloud/raw/upload/v1/abc';
    expect(isDeliveryUrl(config, ok)).toBe(true);
    expect(isDeliveryUrl(config, 'https://res.cloudinary.com/other/raw/upload/v1/abc')).toBe(false);
    expect(isDeliveryUrl(config, 'https://evil.example/raw/upload/v1/abc')).toBe(false);
    expect(isDeliveryUrl(config, `${ok}?track=1`)).toBe(false);
    expect(isDeliveryUrl(config, 'https://res.cloudinary.com/demo-cloud/raw/upload/../../x')).toBe(
      false,
    );
    expect(isDeliveryUrl(config, 'https://res.cloudinary.com/demo-cloud/raw/upload/ x')).toBe(
      false,
    );
  });
});

describe('response parsing', () => {
  it('keeps only well-formed resources', () => {
    expect(
      parseListResponse({
        resources: [
          { public_id: 'a', version: 1 },
          { public_id: 2 },
          null,
          { version: 3 },
          { public_id: '../x', version: 1 },
          { public_id: 'a', version: 1.5 },
        ],
      }),
    ).toEqual([{ publicId: 'a', version: 1 }]);
    expect(parseListResponse({})).toEqual([]);
    expect(parseListResponse('nope')).toEqual([]);
  });

  it('reads the secure URL of an upload', () => {
    expect(parseUploadResponse({ secure_url: 'https://x' })).toBe('https://x');
    expect(parseUploadResponse({ url: 'http://x' })).toBeNull();
  });
});

describe('createCloudinaryClient', () => {
  it('lists delivery URLs for a tag', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(json({ resources: [{ public_id: 'a', version: 7 }] })),
    );
    const client = createCloudinaryClient(config, fetchFn);
    expect(await client.list('ps_tag')).toEqual([
      'https://res.cloudinary.com/demo-cloud/raw/upload/v7/a',
    ]);
    expect(fetchFn).toHaveBeenCalledWith(listEndpoint(config, 'ps_tag'), {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  });

  it('treats a 404 list as an event without entries', async () => {
    const client = createCloudinaryClient(config, () => Promise.resolve(json({}, 404)));
    expect(await client.list('ps_tag')).toEqual([]);
  });

  it('fails loudly on other errors', async () => {
    const client = createCloudinaryClient(config, () => Promise.resolve(json({}, 401)));
    await expect(client.list('ps_tag')).rejects.toThrow('status 401');
    await expect(client.download(own, 10)).rejects.toThrow('download failed');
  });

  it('downloads bytes from the account only, within the size limit', async () => {
    const client = createCloudinaryClient(config, () =>
      Promise.resolve(new Response(Uint8Array.of(1, 2, 3))),
    );
    expect(await client.download(own, 3)).toEqual(Uint8Array.of(1, 2, 3));
    await expect(client.download(own, 2)).rejects.toThrow('larger than 2');
    await expect(client.download('https://evil.example/x', 10)).rejects.toThrow('outside');
  });

  it('trusts a Content-Length that is already too large', async () => {
    const client = createCloudinaryClient(config, () =>
      Promise.resolve(new Response('', { headers: { 'Content-Length': '999' } })),
    );
    await expect(client.download(own, 10)).rejects.toThrow('larger than 10');
  });

  it('uploads with the preset and tags, and returns the secure URL', async () => {
    const fetchFn = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(json({ secure_url: own })),
    );
    const client = createCloudinaryClient(config, fetchFn);

    expect(await client.upload(Uint8Array.of(1), ['ps_tag'])).toBe(own);
    const [url, init] = fetchFn.mock.calls[0]!;
    const body = init?.body as FormData;
    expect(url).toBe(uploadEndpoint(config));
    expect(init?.method).toBe('POST');
    expect(body.get('upload_preset')).toBe('pis_stop');
    expect(body.get('tags')).toBe('ps_tag');
    expect(body.get('file')).toBeInstanceOf(Blob);
  });

  it('omits tags when there are none', async () => {
    const fetchFn = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(json({ secure_url: own })),
    );
    await createCloudinaryClient(config, fetchFn).upload(Uint8Array.of(1), []);
    expect((fetchFn.mock.calls[0]![1]?.body as FormData).has('tags')).toBe(false);
  });

  it('rejects an upload response without a URL of this account', async () => {
    const empty = createCloudinaryClient(config, () => Promise.resolve(json({})));
    const foreign = createCloudinaryClient(config, () =>
      Promise.resolve(json({ secure_url: 'https://evil.example/a' })),
    );
    await expect(empty.upload(Uint8Array.of(1), [])).rejects.toThrow('valid URL');
    await expect(foreign.upload(Uint8Array.of(1), [])).rejects.toThrow('valid URL');
  });
});
