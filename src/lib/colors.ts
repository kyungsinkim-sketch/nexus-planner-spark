/**
 * Bojagi Brand Palette — 색동 보자기 (Korean Traditional Colors)
 *
 * Gold is the key color; the rest are secondary accents
 * for data visualization, group distinction, and charts.
 */

export const BOJAGI = {
  gold:   '#D4A843',  // Key color — 금색
  blue:   '#2B4EC7',  // Royal blue — 파랑
  pink:   '#E8368F',  // Hot pink — 핫핑크
  green:  '#1DA06A',  // Emerald — 초록
  purple: '#7B2D8E',  // Purple — 보라
  amber:  '#F0A830',  // Warm amber — 주황
  rose:   '#F4C4D0',  // Light rose — 연분홍
} as const;

/** Ordered array for sequential assignment (e.g. chart series, group colors) */
export const BOJAGI_SEQUENCE = [
  BOJAGI.gold,
  BOJAGI.blue,
  BOJAGI.pink,
  BOJAGI.green,
  BOJAGI.purple,
  BOJAGI.amber,
  BOJAGI.rose,
] as const;

/** Get a bojagi color by index (wraps around) */
export function bojagiColor(index: number): string {
  return BOJAGI_SEQUENCE[index % BOJAGI_SEQUENCE.length];
}
