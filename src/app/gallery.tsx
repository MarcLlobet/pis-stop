import { useMemo, useState } from 'react';

import { pluralize } from '../lib/format';
import { filterByAuthors, toggleInSet } from '../lib/selectors';
import type { PhotoView, Snapshot } from '../lib/snapshot';
import { AuthorFilter } from './author-filter';
import { PhotoGrid } from './photo-grid';

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
    <section className="flex flex-col gap-3 p-3 pb-28">
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
      <p className="text-sm text-tertiary" aria-live="polite">
        {pluralize(photos.length, 'foto', 'fotos')}
      </p>
      <PhotoGrid photos={photos} profiles={snapshot.profiles} onOpen={onOpen} />
    </section>
  );
};
