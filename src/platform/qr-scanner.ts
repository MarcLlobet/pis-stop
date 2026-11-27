/**
 * QR scanning with the browser's own decoder (`BarcodeDetector`): no image
 * leaves the device and no extra library is shipped. Where it is missing
 * (Safari, Firefox), the landing page offers the phone camera or a pasted
 * link instead.
 */

interface DetectedBarcode {
  readonly rawValue: string;
}

interface BarcodeDetectorLike {
  readonly detect: (source: HTMLVideoElement) => Promise<readonly DetectedBarcode[]>;
}

type BarcodeDetectorClass = new (options: {
  readonly formats: readonly string[];
}) => BarcodeDetectorLike;

const detectorClass = (): BarcodeDetectorClass | null => {
  const value: unknown = Reflect.get(globalThis, 'BarcodeDetector');
  return typeof value === 'function' ? (value as BarcodeDetectorClass) : null;
};

export const canScanQr = (): boolean =>
  detectorClass() !== null && typeof navigator !== 'undefined' && 'mediaDevices' in navigator;

/** How often a frame is decoded: fast enough to feel instant, light on the battery. */
const SCAN_INTERVAL_MS = 250;

const wait = (milliseconds: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * Shows the back camera in `video` and resolves with the first code that
 * `accept` takes, or `null` once `signal` aborts. The camera is always
 * released before the promise settles. Rejects if the camera cannot be
 * opened (no permission, no camera, no decoder).
 */
export const scanQr = async (
  video: HTMLVideoElement,
  accept: (text: string) => boolean,
  signal: AbortSignal,
): Promise<string | null> => {
  const Detector = detectorClass();
  if (Detector === null) {
    throw new Error('Aquest navegador no pot llegir QR');
  }
  const detector = new Detector({ formats: ['qr_code'] });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'environment' },
  });
  try {
    // eslint-disable-next-line functional/immutable-data -- the DOM API to show a camera stream
    video.srcObject = stream;
    await video.play();
    const next = async (): Promise<string | null> => {
      if (signal.aborted) {
        return null;
      }
      const codes = await detector.detect(video).catch(() => []);
      const found = codes.map(({ rawValue }) => rawValue).find(accept);
      if (found !== undefined) {
        return found;
      }
      await wait(SCAN_INTERVAL_MS, signal);
      return next();
    };
    return await next();
  } finally {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }
};
