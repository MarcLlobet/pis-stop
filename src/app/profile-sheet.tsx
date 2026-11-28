import { Camera01 } from '@untitledui/icons';
import { type SyntheticEvent, useState } from 'react';
import {
  FileTrigger as AriaFileTrigger,
  Form as AriaForm,
  Heading as AriaHeading,
} from 'react-aria-components';

import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal';
import { Avatar } from '@/components/base/avatar/avatar';
import { Button } from '@/components/base/buttons/button';
import { CloseButton } from '@/components/base/buttons/close-button';
import { Input } from '@/components/base/input/input';

import { initialOf } from '../lib/format';
import type { ProfileView } from '../lib/snapshot';
import { type OnboardingValues, usePreview } from './onboarding';

interface ProfileSheetProps {
  readonly me: ProfileView;
  /** `avatar` is `null` when the photo does not change. */
  readonly onSave: (values: OnboardingValues) => Promise<void>;
  readonly onClose: () => void;
}

/** Edit one's own profile: photo, name and e-mail. Everybody sees the new version. */
export const ProfileSheet = ({ me, onSave, onClose }: ProfileSheetProps) => {
  const [name, setName] = useState(me.name);
  const [email, setEmail] = useState(me.email);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = usePreview(avatar);
  const unchanged = avatar === null && name.trim() === me.name && email.trim() === me.email;

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), email: email.trim(), avatar });
      onClose();
    } catch (failure) {
      setSaving(false);
      setError(failure instanceof Error ? failure.message : 'No s’ha pogut desar el perfil');
    }
  };

  return (
    <ModalOverlay
      isDismissable={!saving}
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
              El meu perfil
            </AriaHeading>
            <CloseButton label="Tanca" onPress={onClose} />
          </div>

          <AriaForm
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              void submit(event);
            }}
          >
            <div className="flex items-center gap-4">
              <Avatar size="2xl" src={preview ?? me.avatarUrl} initials={initialOf(name)} alt="" />
              <AriaFileTrigger
                acceptedFileTypes={['image/*']}
                defaultCamera="user"
                onSelect={(files) => {
                  setAvatar(files?.[0] ?? null);
                }}
              >
                <Button color="secondary" size="md" iconLeading={Camera01}>
                  Canvia la foto
                </Button>
              </AriaFileTrigger>
            </div>

            <Input
              isRequired
              label="Nom"
              name="name"
              autoComplete="nickname"
              maxLength={40}
              value={name}
              onChange={setName}
            />
            <Input
              isRequired
              label="Correu"
              type="email"
              name="email"
              autoComplete="email"
              hint="Només el veurà la colla."
              value={email}
              onChange={setEmail}
            />

            {error !== null && (
              <p role="alert" className="text-sm text-error-primary">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              isLoading={saving}
              isDisabled={name.trim() === '' || unchanged}
            >
              Desa
            </Button>
          </AriaForm>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
