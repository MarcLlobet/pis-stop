import { type CloudinaryConfig, isValidName } from './cloudinary';

type Env = Readonly<Record<string, unknown>>;

const read = (env: Env, key: string): string | null => {
  const value = env[key];
  return typeof value === 'string' && isValidName(value.trim()) ? value.trim() : null;
};

/** `null` means the build has no Cloudinary account: only the demo works. */
export const parseCloudinaryConfig = (env: Env): CloudinaryConfig | null => {
  const cloudName = read(env, 'VITE_CLOUDINARY_CLOUD_NAME');
  const uploadPreset = read(env, 'VITE_CLOUDINARY_UPLOAD_PRESET');
  return cloudName && uploadPreset ? { cloudName, uploadPreset } : null;
};

export interface AblyConfig {
  readonly key: string;
}

/** `<appId>.<keyId>:<keySecret>`, the shape of every Ably API key (ably/api-key-regex). */
const ABLY_KEY = /^[\w-]{6}\.[\w-]{6}:(?:[\w-]{16}|[\w-]{43})$/;

/** `null` means no (or no restricted-capability) Ably key: live location stays hidden. */
export const parseAblyConfig = (env: Env): AblyConfig | null => {
  const value = env['VITE_ABLY_KEY'];
  const key = typeof value === 'string' ? value.trim() : '';
  return ABLY_KEY.test(key) ? { key } : null;
};
