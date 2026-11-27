import { Lock01 } from '@untitledui/icons';

import { Button } from '@/components/base/buttons/button';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';

import type { Invite } from '../lib/invite';
import { JoinForm } from './join-form';

interface LandingProps {
  readonly onJoin: (invite: Invite) => void;
  /** Whether this browser can read a QR with the camera inside the app. */
  readonly canScan: boolean;
  /** Only on a demo-only deployment (no photo account configured). */
  readonly onDemo?: () => void;
  readonly notice?: string;
}

/** Without an event there is nothing to see: this page only lets you join one. */
export const Landing = ({ onJoin, canScan, onDemo, notice }: LandingProps) => (
  <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-6 py-12">
    <header className="flex flex-col gap-4">
      <FeaturedIcon icon={Lock01} color="brand" theme="gradient" size="lg" />
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm font-semibold text-primary">Pis Stop</h1>
        <p className="text-lg text-tertiary">
          Necessites un event per fer servir Pis Stop. Demana el QR a qui organitza el correpisos.
        </p>
      </div>
    </header>

    {notice !== undefined && (
      <p
        role="alert"
        className="rounded-xl bg-warning-primary p-4 text-sm text-warning-primary ring-1 ring-secondary"
      >
        {notice}
      </p>
    )}

    <JoinForm onJoin={onJoin} canScan={canScan} />

    {onDemo !== undefined && (
      <Button size="lg" color="link-gray" onPress={onDemo}>
        Prova la demo
      </Button>
    )}
  </main>
);
