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
