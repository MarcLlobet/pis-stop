import { formatTime } from '../lib/format';
import type { PhotoView, ProfileView } from '../lib/snapshot';
import { Avatar } from './Avatar';

interface PhotoGridProps {
  readonly photos: readonly PhotoView[];
  readonly profiles: ReadonlyMap<string, ProfileView>;
  readonly onOpen: (photo: PhotoView) => void;
  readonly empty?: string;
}

export const PhotoGrid = ({
  photos,
  profiles,
  onOpen,
  empty = 'Encara no hi ha fotos.',
}: PhotoGridProps) =>
  photos.length === 0 ? (
    <p className="py-12 text-center text-stone-500">{empty}</p>
  ) : (
    <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4">
      {photos.map((photo) => {
        const author = profiles.get(photo.authorId);
        const authorName = author?.name ?? 'Algú';
        return (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => {
                onOpen(photo);
              }}
              className="group relative block aspect-square w-full overflow-hidden rounded-md bg-stone-200 focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <img
                src={photo.thumbUrl}
                alt={`Foto de ${authorName} a les ${formatTime(photo.takenAt)}`}
                loading="lazy"
                className="size-full object-cover transition group-hover:scale-105"
              />
              <span className="absolute bottom-1 left-1">
                <Avatar name={authorName} url={author?.avatarUrl ?? null} size="sm" />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
