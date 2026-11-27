import { create } from 'qrcode';

export interface QrShape {
  /** Modules per side, without the quiet zone. */
  readonly size: number;
  /** SVG path data: one 1×1 square per dark module. */
  readonly path: string;
}

/**
 * The shape of a QR code, as data for an SVG `<path>` rather than markup, so
 * the invite never goes through `innerHTML`. Medium error correction keeps
 * a long invite link easy to scan from a phone screen.
 */
export const qrShape = (text: string): QrShape => {
  const { size, data } = create(text, { errorCorrectionLevel: 'M' }).modules;
  const indices = Array.from({ length: size }, (_, index) => index);
  const path = indices
    .flatMap((row) =>
      indices
        .filter((column) => data[row * size + column] === 1)
        .map((column) => `M${String(column)} ${String(row)}h1v1h-1z`),
    )
    .join('');
  return { size, path };
};
