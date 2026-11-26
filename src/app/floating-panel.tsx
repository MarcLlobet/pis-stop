import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { cx } from '@/utils/cx';

interface FloatingPanelProps {
  readonly label: string;
  readonly onClose: () => void;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * A panel over the map or gallery, not a full-screen dialog: no backdrop, so
 * whatever is behind it — the map, its pins, the photo grid — stays visible.
 * Dismisses on Escape; its content supplies its own close button.
 */
export const FloatingPanel = ({ label, onClose, className, children }: FloatingPanelProps) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <section
      role="dialog"
      aria-label={label}
      className={cx(
        'fixed inset-x-3 bottom-24 z-30 flex max-h-[70dvh] flex-col overflow-hidden rounded-2xl shadow-xl ring-1 ring-secondary sm:inset-x-auto sm:right-4 sm:w-96',
        className,
      )}
    >
      {children}
    </section>
  );
};
