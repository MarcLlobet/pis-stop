export interface Size {
  readonly width: number;
  readonly height: number;
}

export const FULL_MAX_SIDE = 1600;
export const THUMB_MAX_SIDE = 480;
export const AVATAR_MAX_SIDE = 256;

/** Scales a size down (never up) so its longest side fits `maxSide`. */
export const fitWithin = ({ width, height }: Size, maxSide: number): Size => {
  const scale = Math.min(1, maxSide / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};
