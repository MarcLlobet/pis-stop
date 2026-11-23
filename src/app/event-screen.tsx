import { Grid01, LogOut01, Map01, RefreshCcw02, ShieldTick } from '@untitledui/icons';
import { useState } from 'react';
import { Heading as AriaHeading } from 'react-aria-components';

import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { Tab, TabList, TabPanel, Tabs } from '@/components/application/tabs/tabs';
import { Avatar } from '@/components/base/avatar/avatar';
import { Button } from '@/components/base/buttons/button';

import { useUpload } from '../hooks/use-upload';
import { initialOf } from '../lib/format';
import type { Identity } from '../lib/identity';
import type { EventRepository } from '../lib/repository';
import type { PhotoView, ProfileView, Snapshot } from '../lib/snapshot';
import { Gallery } from './gallery';
import { Lightbox } from './lightbox';
import { MapView } from './map-view';
import { SecuritySheet } from './security-sheet';
import { StopSheet } from './stop-sheet';
import { UploadButton } from './upload-button';

interface EventScreenProps {
  readonly snapshot: Snapshot;
  readonly me: ProfileView;
  readonly identity: Identity;
  readonly repository: EventRepository;
  readonly onPhoto: (photo: PhotoView) => void;
  readonly onReload: () => void;
  readonly onLeave: () => void;
}

type View = 'map' | 'gallery';

export const EventScreen = ({
  snapshot,
  me,
  identity,
  repository,
  onPhoto,
  onReload,
  onLeave,
}: EventScreenProps) => {
  const [view, setView] = useState<View>('map');
  const [stopId, setStopId] = useState<string | null>(null);
  const [opened, setOpened] = useState<PhotoView | null>(null);
  const [panel, setPanel] = useState<'security' | 'leave' | null>(null);
  const upload = useUpload({ repository, stops: snapshot.stops, identity, onPhoto });
  const stop = snapshot.stops.find(({ id }) => id === stopId);

  return (
    <div className="flex h-full flex-col bg-primary">
      <header className="flex items-center gap-2 border-b border-secondary px-4 py-3">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-primary">
          <span className="text-brand-secondary">Pis Stop</span> –{' '}
          {snapshot.eventName ?? 'Correpisos'}
        </h1>
        <Button
          color="tertiary"
          size="sm"
          iconLeading={ShieldTick}
          aria-label="Seguretat"
          onPress={() => {
            setPanel('security');
          }}
        />
        <Button
          color="tertiary"
          size="sm"
          iconLeading={RefreshCcw02}
          aria-label="Actualitza"
          onPress={onReload}
        />
        <Button
          color="tertiary"
          size="sm"
          aria-label={`Surt (${me.name})`}
          onPress={() => {
            setPanel('leave');
          }}
          className="rounded-full p-0!"
        >
          <Avatar size="sm" src={me.avatarUrl} initials={initialOf(me.name)} alt="" />
        </Button>
      </header>

      <Tabs
        selectedKey={view}
        onSelectionChange={(key) => {
          setView(key === 'gallery' ? 'gallery' : 'map');
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="px-4 py-2">
          <TabList type="button-gray" size="sm" fullWidth aria-label="Vista">
            <Tab id="map" label="Mapa" icon={Map01} />
            <Tab id="gallery" label="Galeria" icon={Grid01} badge={snapshot.photos.length} />
          </TabList>
        </div>
        <TabPanel id="map" className="relative min-h-0 flex-1">
          <MapView
            snapshot={snapshot}
            onSelectStop={({ id }) => {
              setStopId(id);
            }}
            onOpenPhoto={setOpened}
          />
        </TabPanel>
        <TabPanel id="gallery" className="min-h-0 flex-1 overflow-y-auto">
          <Gallery snapshot={snapshot} onOpen={setOpened} />
        </TabPanel>
      </Tabs>

      <UploadButton
        status={upload.status}
        onFiles={(files) => {
          void upload.uploadFiles(files);
        }}
        onDismiss={upload.dismiss}
      />

      {stop !== undefined && (
        <StopSheet
          stop={stop}
          snapshot={snapshot}
          onOpen={setOpened}
          onClose={() => {
            setStopId(null);
          }}
        />
      )}

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

      {panel === 'security' && (
        <SecuritySheet
          me={me}
          onClose={() => {
            setPanel(null);
          }}
        />
      )}

      <ModalOverlay
        isDismissable
        isOpen={panel === 'leave'}
        onOpenChange={(open) => {
          setPanel(open ? 'leave' : null);
        }}
      >
        <Modal className="max-w-sm">
          <Dialog className="flex flex-col gap-4 p-6">
            {({ close }) => (
              <>
                <AriaHeading slot="title" className="text-lg font-semibold text-primary">
                  Vols sortir del correpisos?
                </AriaHeading>
                <p className="text-sm text-tertiary">
                  Aquest mòbil oblidarà la clau del grup. Per tornar a entrar necessitaràs el QR. La
                  teva identitat es manté, així que tornaràs a ser tu.
                </p>
                <div className="flex gap-3">
                  <Button color="secondary" className="flex-1" onPress={close}>
                    Cancel·la
                  </Button>
                  <Button
                    color="primary-destructive"
                    className="flex-1"
                    iconLeading={LogOut01}
                    onPress={onLeave}
                  >
                    Surt
                  </Button>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
};
