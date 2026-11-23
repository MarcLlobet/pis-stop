import { useState } from 'react';

import type { UploadStatus } from '../hooks/useUpload';
import { Spinner } from './Spinner';

interface UploadButtonProps {
  readonly status: UploadStatus;
  readonly onFiles: (files: readonly File[]) => void;
  readonly onDismiss: () => void;
}

export const UploadButton = ({ status, onFiles, onDismiss }: UploadButtonProps) => {
  // Remounting the input (new key) resets it without mutating the DOM node.
  const [inputKey, setInputKey] = useState(0);
  const busy = status.kind === 'uploading';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1500] flex flex-col items-center gap-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      {status.kind === 'error' && (
        <div
          role="alert"
          className="pointer-events-auto flex items-center gap-3 rounded-xl bg-red-600 px-4 py-2 text-sm text-white shadow-lg"
        >
          {status.message}
          <button type="button" onClick={onDismiss} className="font-semibold underline">
            D’acord
          </button>
        </div>
      )}
      <label
        className={`pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full bg-brand-600 px-6 py-4 text-base font-bold text-white shadow-xl ring-4 ring-white transition hover:bg-brand-700 has-focus-visible:outline-2 has-focus-visible:outline-brand-600 ${busy ? 'cursor-wait opacity-80' : ''}`}
      >
        {busy ? <Spinner /> : <span aria-hidden="true">📸</span>}
        <span aria-live="polite">
          {busy ? `Pujant ${status.done + 1} de ${status.total}…` : 'Penja fotos'}
        </span>
        <input
          key={inputKey}
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          className="sr-only"
          onChange={(event) => {
            onFiles(Array.from(event.currentTarget.files ?? []));
            setInputKey((key) => key + 1);
          }}
        />
      </label>
    </div>
  );
};
