import { Lock01, MarkerPin01, QrCode01, UserCircle } from '@untitledui/icons';
import type { FC } from 'react';

import { Button } from '@/components/base/buttons/button';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';

interface LandingProps {
  readonly onDemo: () => void;
  readonly notice?: string;
}

const STEPS: readonly {
  readonly icon: FC<{ className?: string }>;
  readonly title: string;
  readonly text: string;
}[] = [
  {
    icon: QrCode01,
    title: 'Escaneja el QR',
    text: 'La clau del grup viatja dins l’enllaç. No has d’escriure cap codi.',
  },
  {
    icon: UserCircle,
    title: 'Fes-te un perfil',
    text: 'El teu mòbil genera una clau de signatura: ningú més pot penjar fotos en nom teu.',
  },
  {
    icon: MarkerPin01,
    title: 'Penja fotos a cada pis',
    text: 'Es queden clavades al mapa, a la parada on les has fet.',
  },
];

export const Landing = ({ onDemo, notice }: LandingProps) => (
  <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-10 px-6 py-12">
    <header className="flex flex-col gap-4">
      <FeaturedIcon icon={Lock01} color="brand" theme="gradient" size="lg" />
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm font-semibold text-primary">Pis Stop</h1>
        <p className="text-lg text-tertiary">
          El mapa de fotos del vostre correpisos. Les fotos es xifren i se signen al mòbil abans de
          sortir-ne: ni el servidor les pot veure.
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

    <ol className="flex flex-col gap-5">
      {STEPS.map(({ icon, title, text }) => (
        <li key={title} className="flex gap-4">
          <FeaturedIcon icon={icon} color="gray" theme="modern" size="md" />
          <div>
            <p className="text-md font-semibold text-secondary">{title}</p>
            <p className="text-sm text-tertiary">{text}</p>
          </div>
        </li>
      ))}
    </ol>

    <div className="flex flex-col gap-3">
      <Button size="xl" onPress={onDemo}>
        Prova la demo
      </Button>
      <p className="text-center text-sm text-tertiary">
        Tens un QR? Obre’l amb la càmera del mòbil i entraràs directament.
      </p>
    </div>
  </main>
);
