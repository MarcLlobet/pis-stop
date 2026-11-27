import { ToggleButton as AriaToggleButton } from 'react-aria-components';

import { Avatar } from '@/components/base/avatar/avatar';
import { cx } from '@/utils/cx';

import { initialOf } from '../lib/format';
import type { ProfileView } from '../lib/snapshot';
import { pillToggle } from './pill-toggle';

interface AuthorFilterProps {
  readonly profiles: readonly ProfileView[];
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly onClear: () => void;
}

const chip = ({ isSelected }: { readonly isSelected: boolean }) =>
  cx(pillToggle(isSelected), 'py-1 pr-3 pl-1');

export const AuthorFilter = ({ profiles, selected, onToggle, onClear }: AuthorFilterProps) => (
  <div
    role="group"
    aria-label="Filtra per persona"
    className="scrollbar-hide flex gap-2 overflow-x-auto pb-1"
  >
    <AriaToggleButton
      isSelected={selected.size === 0}
      onChange={onClear}
      className={(state) => cx(chip(state), 'pl-3')}
    >
      Tothom
    </AriaToggleButton>
    {profiles.map((profile) => (
      <AriaToggleButton
        key={profile.id}
        isSelected={selected.has(profile.id)}
        onChange={() => {
          onToggle(profile.id);
        }}
        className={chip}
      >
        <Avatar size="xs" src={profile.avatarUrl} initials={initialOf(profile.name)} alt="" />
        {profile.name}
      </AriaToggleButton>
    ))}
  </div>
);
