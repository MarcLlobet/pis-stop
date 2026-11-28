import { Check, Edit01, LogOut01 } from '@untitledui/icons';
import { Heading as AriaHeading } from 'react-aria-components';

import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { Avatar } from '@/components/base/avatar/avatar';
import { Button } from '@/components/base/buttons/button';
import { CloseButton } from '@/components/base/buttons/close-button';

import { initialOf } from '../lib/format';
import type { Invite } from '../lib/invite';
import type { EventSummary } from '../lib/session';
import type { ProfileView } from '../lib/snapshot';
import { JoinForm } from './join-form';

/** Everything the event list needs, handed down from the app. */
export interface EventSwitcher {
  readonly events: readonly EventSummary[];
  /** The open event's tag; `null` in the demo. */
  readonly current: string | null;
  readonly canScan: boolean;
  readonly onSwitch: (tag: string) => void;
  readonly onJoin: (invite: Invite) => void;
}

interface EventsSheetProps {
  readonly switcher: EventSwitcher;
  readonly onLeave: () => void;
  readonly onClose: () => void;
  /** One's own profile in the open event, with a way to edit it. */
  readonly me?: ProfileView;
  readonly onEditProfile?: () => void;
}

const UNNAMED = 'Event sense nom';

/** The events joined on this device: open another, join a new one, or leave this one. */
export const EventsSheet = ({
  switcher,
  onLeave,
  onClose,
  me,
  onEditProfile,
}: EventsSheetProps) => (
  <ModalOverlay
    isDismissable
    isOpen
    onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}
  >
    <Modal className="max-w-md">
      <Dialog className="flex flex-col gap-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <AriaHeading slot="title" className="text-lg font-semibold text-primary">
            Els meus events
          </AriaHeading>
          <CloseButton label="Tanca" onPress={onClose} />
        </div>

        {me !== undefined && onEditProfile !== undefined && (
          <div className="flex items-center gap-3">
            <Avatar size="md" src={me.avatarUrl} initials={initialOf(me.name)} alt="" />
            <span className="min-w-0 flex-1 truncate text-md font-semibold text-primary">
              {me.name}
            </span>
            <Button color="secondary" size="sm" iconLeading={Edit01} onPress={onEditProfile}>
              Edita el perfil
            </Button>
          </div>
        )}

        {switcher.events.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Events d’aquest mòbil">
            {switcher.events.map(({ tag, name }) =>
              tag === switcher.current ? (
                <li
                  key={tag}
                  aria-current="true"
                  className="flex items-center justify-between gap-3 rounded-xl bg-brand-primary px-4 py-3 ring-1 ring-brand"
                >
                  <span className="truncate text-md font-semibold text-primary">
                    {name ?? UNNAMED}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm text-brand-secondary">
                    <Check aria-hidden="true" className="size-4" />
                    Obert
                  </span>
                </li>
              ) : (
                <li key={tag}>
                  <Button
                    size="lg"
                    color="secondary"
                    className="w-full justify-start"
                    onPress={() => {
                      switcher.onSwitch(tag);
                    }}
                  >
                    {name ?? UNNAMED}
                  </Button>
                </li>
              ),
            )}
          </ul>
        )}

        <section className="flex flex-col gap-3">
          <h3 className="text-md font-semibold text-secondary">Afegeix un event</h3>
          <JoinForm onJoin={switcher.onJoin} canScan={switcher.canScan} />
        </section>

        <Button color="secondary-destructive" iconLeading={LogOut01} onPress={onLeave}>
          Surt d’aquest event
        </Button>
      </Dialog>
    </Modal>
  </ModalOverlay>
);
