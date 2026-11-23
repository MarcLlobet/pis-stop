import { Image01 } from '@untitledui/icons';
import { Button as AriaButton } from 'react-aria-components';

import { Avatar } from '@/components/base/avatar/avatar';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';

import { formatTime, initialOf } from '../lib/format';
import type { PhotoView, ProfileView } from '../lib/snapshot';

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
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <FeaturedIcon icon={Image01} color="gray" theme="modern" size="lg" />
      <p className="text-md text-tertiary">{empty}</p>
    </div>
  ) : (
    <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4">
      {photos.map((photo) => {
        const author = profiles.get(photo.authorId);
        const authorName = author?.name ?? 'Algú';
        return (
          <li key={photo.id}>
            <AriaButton
              onPress={() => {
                onOpen(photo);
              }}
              className="group relative block aspect-square w-full cursor-pointer overflow-hidden rounded-md bg-tertiary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <img
                src={photo.thumbUrl}
                alt={`Foto de ${authorName} a les ${formatTime(photo.takenAt)}`}
                loading="lazy"
                decoding="async"
                className="size-full object-cover transition duration-100 ease-linear group-hover:scale-105"
              />
              <span className="absolute bottom-1 left-1">
                <Avatar
                  size="xs"
                  src={author?.avatarUrl ?? null}
                  initials={initialOf(authorName)}
                  alt=""
                  contrastBorder
                />
              </span>
            </AriaButton>
          </li>
        );
      })}
    </ul>
  );
