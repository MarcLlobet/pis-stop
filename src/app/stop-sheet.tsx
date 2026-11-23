import { photosOfStop } from '../lib/selectors';
import type { PhotoView, Snapshot } from '../lib/snapshot';
import type { Stop } from '../lib/types';
import { PhotoSheet } from './photo-sheet';

interface StopSheetProps {
  readonly stop: Stop;
  readonly snapshot: Snapshot;
  readonly onOpen: (photo: PhotoView) => void;
  readonly onClose: () => void;
}

export const StopSheet = ({ stop, snapshot, onOpen, onClose }: StopSheetProps) => (
  <PhotoSheet
    title={stop.name}
    badge={`Parada ${stop.order}`}
    photos={photosOfStop(snapshot.photos, stop.id)}
    profiles={snapshot.profiles}
    empty="Encara ningú ha penjat res aquí."
    onOpen={onOpen}
    onClose={onClose}
  />
);
