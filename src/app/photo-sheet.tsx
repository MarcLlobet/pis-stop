import { Badge } from '@/components/base/badges/badges';
import { CloseButton } from '@/components/base/buttons/close-button';

import { pluralize } from '../lib/format';
import type { PhotoView, ProfileView } from '../lib/snapshot';
import { FloatingPanel } from './floating-panel';
import { PhotoGrid } from './photo-grid';

interface PhotoSheetProps {
  readonly title: string;
  readonly badge: string;
  readonly photos: readonly PhotoView[];
  readonly profiles: ReadonlyMap<string, ProfileView>;
  readonly empty: string;
  readonly onOpen: (photo: PhotoView) => void;
  readonly onClose: () => void;
}

/** A list of photos in a panel over the map, so it stays in view behind it. */
export const PhotoSheet = ({
  title,
  badge,
  photos,
  profiles,
  empty,
  onOpen,
  onClose,
}: PhotoSheetProps) => (
  <FloatingPanel label={title} onClose={onClose} className="bg-primary">
    <header className="flex items-start justify-between gap-4 p-4 pb-0 sm:p-6 sm:pb-0">
      <div className="flex flex-col gap-1">
        <Badge type="pill-color" color="brand" size="sm">
          {badge}
        </Badge>
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        <p className="text-sm text-tertiary">{pluralize(photos.length, 'foto', 'fotos')}</p>
      </div>
      <CloseButton label="Tanca" onPress={onClose} />
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <PhotoGrid photos={photos} profiles={profiles} onOpen={onOpen} empty={empty} />
    </div>
  </FloatingPanel>
);
