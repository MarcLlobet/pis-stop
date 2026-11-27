import { useMemo } from 'react';

import { qrShape } from '../lib/qr';

interface QrCodeProps {
  readonly text: string;
  readonly label: string;
}

/** Modules of white margin around the code, as the QR standard asks. */
const QUIET_ZONE = 4;

/** Always black on white, also in dark mode: cameras read that best. */
export const QrCode = ({ text, label }: QrCodeProps) => {
  const { size, path } = useMemo(() => qrShape(text), [text]);
  const side = size + 2 * QUIET_ZONE;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${String(-QUIET_ZONE)} ${String(-QUIET_ZONE)} ${String(side)} ${String(side)}`}
      shapeRendering="crispEdges"
      className="aspect-square w-full rounded-xl bg-white"
    >
      <path d={path} fill="#000000" />
    </svg>
  );
};
