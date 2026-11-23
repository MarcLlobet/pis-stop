import type { Bytes, Entry, EventInfo, Leg, Meta, Photo, Profile, Stop } from './types';

export interface ProfileView extends Profile {
  readonly avatarUrl: string | null;
}

export interface PhotoView extends Photo {
  readonly thumbUrl: string;
}

export interface Snapshot {
  readonly eventName: string | null;
  readonly legs: readonly Leg[];
  readonly stops: readonly Stop[];
  readonly profiles: ReadonlyMap<string, ProfileView>;
  readonly photos: readonly PhotoView[];
}

/** Turns bytes into something an <img> can show (an object URL in the browser). */
export type ToImageUrl = (bytes: Bytes, type: string) => string;

export const EMPTY_SNAPSHOT: Snapshot = {
  eventName: null,
  legs: [],
  stops: [],
  profiles: new Map(),
  photos: [],
};

const isKind =
  <K extends Meta['kind']>(kind: K) =>
  (entry: Entry): entry is Entry<Extract<Meta, { kind: K }>> =>
    entry.meta.kind === kind;

export const toProfileView = (entry: Entry<Profile>, toUrl: ToImageUrl): ProfileView => ({
  ...entry.meta,
  avatarUrl: entry.payload.length > 0 ? toUrl(entry.payload, entry.meta.imageType) : null,
});

export const toPhotoView = (entry: Entry<Photo>, toUrl: ToImageUrl): PhotoView => ({
  ...entry.meta,
  thumbUrl: toUrl(entry.payload, entry.meta.imageType),
});

const byTakenAtDesc = (a: Photo, b: Photo): number => b.takenAt.localeCompare(a.takenAt);

/** Latest profile version wins, so people can update their name or avatar. */
const latestProfiles = (entries: readonly Entry<Profile>[]): readonly Entry<Profile>[] => [
  ...new Map(
    [...entries]
      .sort((a, b) => a.meta.createdAt.localeCompare(b.meta.createdAt))
      .map((entry) => [entry.meta.id, entry] as const),
  ).values(),
];

export const buildSnapshot = (entries: readonly Entry[], toUrl: ToImageUrl): Snapshot => {
  const events = entries.filter(isKind('event')).map((entry): EventInfo => entry.meta);
  const profiles = latestProfiles(entries.filter(isKind('profile'))).map((entry) =>
    toProfileView(entry, toUrl),
  );
  return {
    eventName: events.at(-1)?.name ?? null,
    legs: events.at(-1)?.legs ?? [],
    stops: entries
      .filter(isKind('stop'))
      .map((entry) => entry.meta)
      .sort((a, b) => a.order - b.order),
    profiles: new Map(profiles.map((profile) => [profile.id, profile])),
    photos: [
      ...new Map(
        entries
          .filter(isKind('photo'))
          .map((entry) => [entry.meta.id, toPhotoView(entry, toUrl)] as const),
      ).values(),
    ].sort(byTakenAtDesc),
  };
};

/** Immutable merges used for optimistic updates after an upload. */
export const withPhoto = (snapshot: Snapshot, photo: PhotoView): Snapshot => ({
  ...snapshot,
  photos: [photo, ...snapshot.photos.filter(({ id }) => id !== photo.id)].sort(byTakenAtDesc),
});

export const withProfile = (snapshot: Snapshot, profile: ProfileView): Snapshot => ({
  ...snapshot,
  profiles: new Map([...snapshot.profiles, [profile.id, profile]]),
});
