import { useState } from 'react';

import { useUpload } from '../hooks/useUpload';
import type { EventRepository } from '../lib/repository';
import type { PhotoView, ProfileView, Snapshot } from '../lib/snapshot';
import { Avatar } from './Avatar';
import { Gallery } from './Gallery';
import { Lightbox } from './Lightbox';
import { MapView } from './MapView';
import { StopSheet } from './StopSheet';
import { UploadButton } from './UploadButton';

interface EventScreenProps {
  readonly snapshot: Snapshot;
  readonly me: ProfileView;
  readonly repository: EventRepository;
  readonly onPhoto: (photo: PhotoView) => void;
  readonly onReload: () => void;
  readonly onLeave: () => void;
}

const TABS = [
  { id: 'map', label: 'Mapa' },
  { id: 'gallery', label: 'Galeria' },
] as const;

type Tab = (typeof TABS)[number]['id'];

export const EventScreen = ({
  snapshot,
  me,
  repository,
  onPhoto,
  onReload,
  onLeave,
}: EventScreenProps) => {
  const [tab, setTab] = useState<Tab>('map');
  const [stopId, setStopId] = useState<string | null>(null);
  const [opened, setOpened] = useState<PhotoView | null>(null);
  const upload = useUpload({ repository, stops: snapshot.stops, authorId: me.id, onPhoto });
  const stop = snapshot.stops.find(({ id }) => id === stopId);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-brand-600 uppercase">Pis Stop</p>
          <h1 className="truncate text-lg font-bold">{snapshot.eventName ?? 'Correpisos'}</h1>
        </div>
        <button
          type="button"
          onClick={onReload}
          className="rounded-full px-3 py-1 text-sm font-semibold text-stone-600 hover:bg-stone-100"
        >
          Actualitza
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Vols sortir? Per tornar a entrar necessitaràs el QR.')) {
              onLeave();
            }
          }}
          aria-label={`Surt (${me.name})`}
          className="rounded-full"
        >
          <Avatar name={me.name} url={me.avatarUrl} />
        </button>
      </header>

      <div role="tablist" aria-label="Vista" className="flex gap-1 bg-white px-4 pb-2">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => {
              setTab(id);
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${tab === id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <main
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="relative flex-1 overflow-hidden"
      >
        {tab === 'map' ? (
          <MapView
            snapshot={snapshot}
            onSelectStop={({ id }) => {
              setStopId(id);
            }}
            onOpenPhoto={setOpened}
          />
        ) : (
          <Gallery snapshot={snapshot} onOpen={setOpened} />
        )}
        {tab === 'map' && stop !== undefined && (
          <StopSheet
            stop={stop}
            snapshot={snapshot}
            onOpen={setOpened}
            onClose={() => {
              setStopId(null);
            }}
          />
        )}
      </main>

      <UploadButton
        status={upload.status}
        onFiles={(files) => {
          void upload.uploadFiles(files);
        }}
        onDismiss={upload.dismiss}
      />

      {opened !== null && (
        <Lightbox
          photo={opened}
          snapshot={snapshot}
          openPhoto={repository.openPhoto}
          onClose={() => {
            setOpened(null);
          }}
        />
      )}
    </div>
  );
};
