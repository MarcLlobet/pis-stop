import type { ProfileView } from '../lib/snapshot';
import { Avatar } from './Avatar';

interface AuthorFilterProps {
  readonly profiles: readonly ProfileView[];
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly onClear: () => void;
}

const CHIP =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-sm font-medium ring-1 transition';

export const AuthorFilter = ({ profiles, selected, onToggle, onClear }: AuthorFilterProps) => (
  <div role="group" aria-label="Filtra per persona" className="flex gap-2 overflow-x-auto pb-1">
    <button
      type="button"
      aria-pressed={selected.size === 0}
      onClick={onClear}
      className={`${CHIP} pl-3 ${selected.size === 0 ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white text-stone-700 ring-stone-300'}`}
    >
      Tothom
    </button>
    {profiles.map((profile) => {
      const active = selected.has(profile.id);
      return (
        <button
          key={profile.id}
          type="button"
          aria-pressed={active}
          onClick={() => {
            onToggle(profile.id);
          }}
          className={`${CHIP} ${active ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-stone-700 ring-stone-300'}`}
        >
          <Avatar name={profile.name} url={profile.avatarUrl} size="sm" />
          {profile.name}
        </button>
      );
    })}
  </div>
);
