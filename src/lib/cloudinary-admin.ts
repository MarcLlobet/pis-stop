/**
 * Cloudinary Admin API calls used by the organizer's scripts only (never by
 * the web app, which has no credentials). They open and close an event by
 * creating and deleting its own upload preset.
 */
import { toHex } from './encoding';
import type { Bytes } from './types';

export interface AdminCredentials {
  readonly cloudName: string;
  readonly apiKey: string;
  readonly apiSecret: string;
}

type Env = Readonly<Record<string, unknown>>;

const CLOUD = /^[A-Za-z0-9_-]+$/;
const API_KEY = /^\d{6,30}$/;
const API_SECRET = /^[A-Za-z0-9_-]{10,100}$/;

const read = (env: Env, key: string, pattern: RegExp): string | null => {
  const value = env[key];
  return typeof value === 'string' && pattern.test(value.trim()) ? value.trim() : null;
};

/** `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`: secret, never prefixed with VITE_. */
export const parseAdminCredentials = (env: Env): AdminCredentials | null => {
  const cloudName = read(env, 'VITE_CLOUDINARY_CLOUD_NAME', CLOUD);
  const apiKey = read(env, 'CLOUDINARY_API_KEY', API_KEY);
  const apiSecret = read(env, 'CLOUDINARY_API_SECRET', API_SECRET);
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
};

/** 128 random bits: nobody can guess it, so nobody outside the group can upload with it. */
export const presetName = (random: Bytes): string => `ps_${toHex(random)}`;

/**
 * Unsigned (the phones have no credentials), with Cloudinary choosing every
 * file name: an uploader can neither pick nor overwrite an existing file.
 */
export const PRESET_SETTINGS = {
  unsigned: true,
  disallow_public_id: true,
  use_filename: false,
  unique_filename: true,
  overwrite: false,
} as const;

export interface AdminRequest {
  readonly url: string;
  readonly init: RequestInit;
}

const presetsUrl = ({ cloudName }: AdminCredentials): string =>
  `https://api.cloudinary.com/v1_1/${cloudName}/upload_presets`;

const headers = ({ apiKey, apiSecret }: AdminCredentials): Readonly<Record<string, string>> => ({
  Authorization: `Basic ${btoa(`${apiKey}:${apiSecret}`)}`,
  'Content-Type': 'application/json',
});

export const createPresetRequest = (credentials: AdminCredentials, name: string): AdminRequest => ({
  url: presetsUrl(credentials),
  init: {
    method: 'POST',
    headers: headers(credentials),
    body: JSON.stringify({ name, ...PRESET_SETTINGS }),
  },
});

export const deletePresetRequest = (credentials: AdminCredentials, name: string): AdminRequest => ({
  url: `${presetsUrl(credentials)}/${encodeURIComponent(name)}`,
  init: { method: 'DELETE', headers: headers(credentials) },
});
