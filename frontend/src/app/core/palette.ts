/**
 * Colours shared by every chart. Channels 1-5 keep one colour everywhere (T1, RH1 and i1 alike),
 * so a measuring point is recognisable on every page. Checked for colour-vision deficiency
 * separation and contrast against the page background (#eef1ef).
 */
export const CHANNEL_COLORS = ['#1a78bd', '#c27c0e', '#4f9046', '#a8365c', '#7c5cb0'];

export const INK = '#1d2a33';
export const STEEL = '#5b6b76';
export const FROST = '#1a78bd';
export const OCHRE = '#c8a24a';
export const SIGNAL = '#b4452f';
export const LEAF = '#3f8a3a';

/** COP without the constant power, COP of the whole unit, compressor power - as in the original plots */
export const COP_COLOR = FROST;
export const COP_TOTAL_COLOR = LEAF;
export const POWER_COLOR = SIGNAL;
export const SUCTION_COLOR = FROST;
export const DISCHARGE_COLOR = '#d0761c';

export function channelColor(k: number): string {
  return CHANNEL_COLORS[(k - 1) % CHANNEL_COLORS.length];
}

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
