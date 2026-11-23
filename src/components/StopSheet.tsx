import { pluralize } from '../lib/format';
import { photosOfStop } from '../lib/selectors';
import type { PhotoView, Snapshot } from '../lib/snapshot';
import type { Stop } from '../lib/types';
import { PhotoGrid } from './PhotoGrid';

interface StopSheetProps {
  readonly stop: Stop;
  readonly snapshot: Snapshot;
  readonly onOpen: (photo: PhotoView) => void;
  readonly onClose: () => void;
}

export const StopSheet = ({ stop, snapshot, onOpen, onClose }: StopSheetProps) => {
  const photos = photosOfStop(snapshot.photos, stop.id);
  return (
    <section
      aria-label={stop.name}
      className="absolute inset-x-0 bottom-0 z-[1000] max-h-[65%] overflow-y-auto rounded-t-3xl bg-white p-4 pb-28 shadow-2xl"
    >
      <header className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">
            Parada {stop.order}
          </p>
          <h2 className="text-xl font-bold">{stop.name}</h2>
          <p className="text-sm text-stone-500">{pluralize(photos.length, 'foto', 'fotos')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700 hover:bg-stone-200"
        >
          Tanca
        </button>
      </header>
      <PhotoGrid
        photos={photos}
        profiles={snapshot.profiles}
        onOpen={onOpen}
        empty="Encara ningú ha penjat res aquí."
      />
    </section>
  );
};
