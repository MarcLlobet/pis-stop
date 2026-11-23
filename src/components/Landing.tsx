interface LandingProps {
  readonly onDemo: () => void;
  readonly notice?: string;
}

const STEPS = [
  ['Escaneja el QR', 'L’organitzador el comparteix al grup. La clau viatja dins l’enllaç.'],
  ['Fes-te un perfil', 'Nom, correu i una foto. Només ho veu la colla.'],
  ['Penja fotos a cada pis', 'Es queden clavades al mapa, a la parada on les has fet.'],
] as const;

export const Landing = ({ onDemo, notice }: LandingProps) => (
  <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-6 py-12">
    <header className="space-y-3">
      <p className="text-5xl" aria-hidden="true">
        🍻
      </p>
      <h1 className="text-4xl font-black tracking-tight text-brand-700">Pis Stop</h1>
      <p className="text-lg text-stone-600">
        El mapa de fotos del vostre correpisos. Privat de debò: les fotos es xifren al mòbil abans
        de sortir-ne.
      </p>
    </header>

    {notice !== undefined && (
      <p
        role="alert"
        className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200"
      >
        {notice}
      </p>
    )}

    <ol className="space-y-4">
      {STEPS.map(([title, text], index) => (
        <li key={title} className="flex gap-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">
            {index + 1}
          </span>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-stone-600">{text}</p>
          </div>
        </li>
      ))}
    </ol>

    <div className="space-y-3">
      <button
        type="button"
        onClick={onDemo}
        className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        Prova la demo
      </button>
      <p className="text-center text-sm text-stone-500">
        Tens un QR? Obre’l amb la càmera del mòbil i entraràs directament.
      </p>
    </div>
  </main>
);
