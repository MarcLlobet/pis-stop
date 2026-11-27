import {
  Grid01,
  LogOut01,
  Map01,
  NavigationPointer01,
  NavigationPointerOff01,
  QrCode01,
  RefreshCcw02,
  ShieldTick,
} from '@untitledui/icons';
import { useState } from 'react';
import { Heading as AriaHeading } from 'react-aria-components';

import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { Tab, TabList, TabPanel, Tabs } from '@/components/application/tabs/tabs';
import { Avatar } from '@/components/base/avatar/avatar';
import { Button } from '@/components/base/buttons/button';

import type { LiveLocationState } from '../hooks/use-live-location';
import { useUpload } from '../hooks/use-upload';
import { initialOf } from '../lib/format';
import type { Identity } from '../lib/identity';
import { buildInviteUrl, type Invite } from '../lib/invite';
import type { EventRepository } from '../lib/repository';
import type { PhotoView, ProfileView, Snapshot } from '../lib/snapshot';
import { EventsSheet, type EventSwitcher } from './events-sheet';
import { Gallery } from './gallery';
import { InviteSheet } from './invite-sheet';
import { ItineraryPanel } from './itinerary-panel';
import { Lightbox } from './lightbox';
import { MapView } from './map-view';
import { PhotoSheet } from './photo-sheet';
import { SecuritySheet } from './security-sheet';
import { UploadButton } from './upload-button';

interface EventScreenProps {
  readonly snapshot: Snapshot;
  readonly me: ProfileView;
  readonly identity: Identity;
  readonly repository: EventRepository;
  readonly onPhoto: (photo: PhotoView) => void;
  readonly onReload: () => void;
  readonly onLeave: () => void;
  readonly live: LiveLocationState;
  /** Shown as a QR to bring someone else in; `null` hides the button. */
  readonly invite: Invite | null;
  readonly switcher: EventSwitcher;
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
  live,
  invite,
  switcher,
}: EventScreenProps) => {
  const [view, setView] = useState<View>('map');
  const [opened, setOpened] = useState<PhotoView | null>(null);
  const [group, setGroup] = useState<readonly PhotoView[] | null>(null);
  /** Which way to go for each leg (leg index → option index). */
  const [choices, setChoices] = useState<ReadonlyMap<number, number>>(new Map());
  const [panel, setPanel] = useState<'events' | 'invite' | 'security' | 'leave' | null>(null);
  const upload = useUpload({ repository, identity, onPhoto });

  return (
    <>
      <Tabs
        selectedKey={view}
        onSelectionChange={(key) => {
          setView(key === 'gallery' ? 'gallery' : 'map');
        }}
        className="flex h-full flex-col bg-primary"
      >
        <header className="flex items-center gap-2 border-b border-secondary px-4 py-2">
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-primary">
            <span className="text-brand-secondary">Pis Stop</span> –{' '}
            {snapshot.eventName ?? 'Correpisos'}
          </h1>
          <TabList type="button-gray" size="sm" aria-label="Vista" className="shrink-0">
            <Tab id="map" icon={Map01} label={<span className="max-sm:sr-only">Mapa</span>} />
            <Tab
              id="gallery"
              icon={Grid01}
              label={<span className="max-sm:sr-only">Galeria</span>}
              badge={snapshot.photos.length}
            />
          </TabList>
          {live.available && (
            <Button
              color={live.sharing ? 'primary' : 'tertiary'}
              size="sm"
              iconLeading={live.sharing ? NavigationPointer01 : NavigationPointerOff01}
              aria-label="Comparteix la meva ubicació"
              aria-pressed={live.sharing}
              onPress={() => {
                live.setSharing(!live.sharing);
              }}
            />
          )}
          {invite !== null && (
            <Button
              color="tertiary"
              size="sm"
              iconLeading={QrCode01}
              aria-label="Convida"
              onPress={() => {
                setPanel('invite');
              }}
            />
          )}
          <Button
            color="tertiary"
            size="sm"
            iconLeading={ShieldTick}
            aria-label="Seguretat"
            onPress={() => {
              setPanel('security');
            }}
            className="rounded-full transition-transform active:scale-95"
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
            aria-label={`Els meus events (${me.name})`}
            onPress={() => {
              setPanel('events');
            }}
            className="rounded-full p-0!"
          >
            <Avatar size="sm" src={me.avatarUrl} initials={initialOf(me.name)} alt="" />
          </Button>
        </header>

        {/* Kept mounted (just hidden) when you visit the gallery: remounting the
            map would reset its zoom and position, and build it at size 0. */}
        <TabPanel id="map" shouldForceMount className="relative min-h-0 flex-1">
          <MapView
            snapshot={snapshot}
            onOpenPhoto={setOpened}
            onOpenGroup={setGroup}
            choices={choices}
            peers={live.peers}
          />
          <ItineraryPanel
            stops={snapshot.stops}
            legs={snapshot.legs}
            choices={choices}
            onChoose={(leg, option) => {
              setChoices((current) => new Map([...current, [leg, option]]));
            }}
          />
        </TabPanel>
        <TabPanel id="gallery" className="min-h-0 flex-1 overflow-y-auto">
          <Gallery snapshot={snapshot} onOpen={setOpened} />
        </TabPanel>

        <UploadButton
          status={upload.status}
          onFiles={(files) => {
            void upload.uploadFiles(files);
          }}
          onDismiss={upload.dismiss}
        />
      </Tabs>

      {/* Overlays stay outside <Tabs>: React Aria renders the content of a
          collection twice (once hidden, to build it), and a modal in there
          would open twice, each copy hiding the other from screen readers. */}
      {group !== null && (
        <PhotoSheet
          title="Fotos properes"
          badge="Al mateix lloc"
          photos={group}
          profiles={snapshot.profiles}
          empty=""
          onOpen={setOpened}
          onClose={() => {
            setGroup(null);
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

      {panel === 'events' && (
        <EventsSheet
          switcher={switcher}
          onLeave={() => {
            setPanel('leave');
          }}
          onClose={() => {
            setPanel(null);
          }}
        />
      )}

      {panel === 'invite' && invite !== null && (
        <InviteSheet
          eventName={snapshot.eventName}
          // The app's own address: the invite always opens this same web.
          inviteUrl={buildInviteUrl(window.location.href, invite)}
          onClose={() => {
            setPanel(null);
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
                  Vols sortir d’aquest event?
                </AriaHeading>
                <p className="text-sm text-tertiary">
                  Aquest mòbil oblidarà la clau del grup i deixarà l’event fora de la llista. Per
                  tornar a entrar necessitaràs el QR. La teva identitat es manté, així que tornaràs
                  a ser tu. Els altres events no canvien.
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
    </>
  );
};
