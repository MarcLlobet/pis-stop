import type { ReactNode } from 'react';

export const Spinner = () => (
  <span
    aria-hidden="true"
    className="inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent"
  />
);

interface FullScreenProps {
  readonly children: ReactNode;
}

export const FullScreen = ({ children }: FullScreenProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
    {children}
  </div>
);
