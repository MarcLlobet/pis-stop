/**
 * Keeps a copy of a photo on the phone. A web page cannot write to the photo
 * library by itself, so it hands the original file to the phone: through the
 * share sheet where there is one ("Desa la imatge" on iPhone, "Desa" or Google
 * Photos on Android), otherwise as a download. Must run from a tap.
 */
const download = (file: File): void => {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', file.name || 'pis-stop.jpg');
  link.click();
  // Give the browser time to start the download before freeing the file.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
};

export const savePhotos = async (files: readonly File[]): Promise<void> => {
  const shareable = { files: [...files] };
  if ('canShare' in navigator && navigator.canShare(shareable)) {
    // Cancelling the share sheet rejects too: nothing to do then.
    await navigator.share(shareable).catch(() => undefined);
    return;
  }
  files.forEach(download);
};
