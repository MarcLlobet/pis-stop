import { useMemo, useState } from 'react';

import { pluralize } from '../lib/format';
import { filterByAuthors, toggleInSet } from '../lib/selectors';
import type { PhotoView, Snapshot } from '../lib/snapshot';
import { AuthorFilter } from './AuthorFilter';
import { PhotoGrid } from './PhotoGrid';

interface GalleryProps {
  readonly snapshot: Snapshot;
  readonly onOpen: (photo: PhotoView) => void;
}

export const Gallery = ({ snapshot, onOpen }: GalleryProps) => {
  const [authors, setAuthors] = useState<ReadonlySet<string>>(new Set());
  const profiles = useMemo(
    () => [...snapshot.profiles.values()].sort((a, b) => a.name.localeCompare(b.name, 'ca')),
    [snapshot.profiles],
  );
  const photos = filterByAuthors(snapshot.photos, authors);

  return (
    <section className="h-full space-y-3 overflow-y-auto p-3 pb-28">
      <AuthorFilter
        profiles={profiles}
        selected={authors}
        onToggle={(id) => {
          setAuthors((current) => toggleInSet(current, id));
        }}
        onClear={() => {
          setAuthors(new Set());
        }}
      />
      <p className="text-sm text-stone-500" aria-live="polite">
        {pluralize(photos.length, 'foto', 'fotos')}
      </p>
      <PhotoGrid photos={photos} profiles={snapshot.profiles} onOpen={onOpen} />
    </section>
  );
};
