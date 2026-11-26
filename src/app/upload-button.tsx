import { Camera01 } from '@untitledui/icons';
import { FileTrigger as AriaFileTrigger } from 'react-aria-components';

import { Button } from '@/components/base/buttons/button';

import type { UploadStatus } from '../hooks/use-upload';

interface UploadButtonProps {
  readonly status: UploadStatus;
  readonly onFiles: (files: readonly File[]) => void;
  readonly onDismiss: () => void;
}

export const UploadButton = ({ status, onFiles, onDismiss }: UploadButtonProps) => {
  const busy = status.kind === 'uploading';
  const select = (files: FileList | null) => {
    onFiles(Array.from(files ?? []));
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      {status.kind === 'error' && (
        <div
          role="alert"
          className="pointer-events-auto flex items-center gap-3 rounded-xl bg-error-solid px-4 py-2 text-sm text-white shadow-lg"
        >
          {status.message}
          <Button color="link-gray" size="sm" className="text-white!" onPress={onDismiss}>
            D’acord
          </Button>
        </div>
      )}
      {/* No gallery picker on purpose: every photo here is of the moment,
          taken with the camera, never an old one from the library. */}
      <AriaFileTrigger
        acceptedFileTypes={['image/*']}
        defaultCamera="environment"
        onSelect={select}
      >
        <Button
          size="xl"
          iconLeading={Camera01}
          isLoading={busy}
          showTextWhileLoading
          className="pointer-events-auto rounded-full shadow-xl"
        >
          <span aria-live="polite">
            {busy ? `Pujant ${status.done + 1} de ${status.total}…` : 'Fes una foto'}
          </span>
        </Button>
      </AriaFileTrigger>
    </div>
  );
};
