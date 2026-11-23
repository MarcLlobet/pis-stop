import { initialOf } from '../lib/format';

interface AvatarProps {
  readonly name: string;
  readonly url: string | null;
  readonly size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'size-6 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-20 text-2xl',
} as const;

export const Avatar = ({ name, url, size = 'md' }: AvatarProps) =>
  url === null ? (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 ring-2 ring-white`}
    >
      {initialOf(name)}
    </span>
  ) : (
    <img
      src={url}
      alt=""
      className={`${SIZES[size]} shrink-0 rounded-full object-cover ring-2 ring-white`}
    />
  );
