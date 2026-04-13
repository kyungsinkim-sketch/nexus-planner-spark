/**
 * formatBrainMessage — Post-process Brain AI responses for readability.
 *
 * When the LLM outputs a wall of text (no line breaks), detect schedule/list
 * patterns and add proper formatting with bullets and line breaks.
 *
 * Example input:
 *   "오늘 일정은 다음과 같습니다. 오전 11시 미팅, 오후 1시 점검, 오후 3시 PT가 있습니다."
 *
 * Example output:
 *   "오늘 일정은 다음과 같습니다.\n\n• 오전 11시 미팅\n• 오후 1시 점검\n• 오후 3시 PT\n\n가 있습니다."
 */

import { Fragment } from 'react';
import type { ReactNode } from 'react';

// Korean time prefixes that mark the start of a schedule item
const TIME_PREFIXES = '오전|오후|저녁|새벽|아침|낮|밤';
const TIME_REGEX = new RegExp(`(?:${TIME_PREFIXES})\\s*\\d{1,2}시`);

// Patterns indicating a 24-hour time format like "11:00", "14:30"
const TIME_24H_REGEX = /\d{1,2}:\d{2}/;

// Intro sentence endings that should be followed by a line break
const INTRO_ENDINGS = [
  '다음과 같습니다',
  '알려드리겠습니다',
  '알려드릴게요',
  '브리핑입니다',
  '브리핑 드리겠습니다',
  '브리핑 드릴게요',
  '드리겠습니다',
  '정리해 드리겠습니다',
  '정리해드리겠습니다',
  '정리해 드릴게요',
  '정리해드릴게요',
  '안내해 드리겠습니다',
  '안내해드리겠습니다',
];

export function formatBrainMessage(text: string): string {
  // Check if this looks like a schedule/briefing text
  const hasTimePattern = TIME_REGEX.test(text) || TIME_24H_REGEX.test(text);

  // If already has line breaks AND no schedule pattern — return as-is
  if (text.includes('\n') && !hasTimePattern) return text;

  // No schedule pattern and no line breaks — return as-is
  if (!hasTimePattern) return text;

  let result = text;

  // 1. Add line break after intro sentence endings
  for (const ending of INTRO_ENDINGS) {
    const regex = new RegExp(`(${ending}[.!。]?)\\s*`, 'g');
    result = result.replace(regex, '$1\n\n');
  }

  // 2. Replace ", 오전/오후/... N시" with "\n• 오전/오후/... N시"
  const commaTimeRegex = new RegExp(
    `,\\s*((?:${TIME_PREFIXES})\\s*\\d{1,2}시)`,
    'g',
  );
  result = result.replace(commaTimeRegex, '\n• $1');

  // Also handle ", HH:MM" 24-hour format (e.g., ", 14:00 미팅")
  result = result.replace(/,\s*(\d{1,2}:\d{2}\s)/g, '\n• $1');

  // 3. Add bullet to the first schedule item after intro
  const firstTimeRegex = new RegExp(
    `\\n\\n((?:${TIME_PREFIXES})\\s*\\d{1,2}시)`,
  );
  result = result.replace(firstTimeRegex, '\n\n• $1');

  // Also handle first item with 24h time
  result = result.replace(/\n\n(\d{1,2}:\d{2}\s)/, '\n\n• $1');

  // 4. Collapse excessive line breaks (max 2 consecutive)
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

/**
 * Render Brain AI message as React nodes with explicit <br> tags.
 * This bypasses CSS whitespace-pre-wrap and guarantees line breaks render
 * correctly regardless of the parent container's CSS.
 */
export function renderBrainMessage(text: string): ReactNode {
  const formatted = formatBrainMessage(text);
  const lines = formatted.split('\n');
  return lines.map((line, i) => (
    <Fragment key={i}>
      {line}
      {i < lines.length - 1 && <br />}
    </Fragment>
  ));
}

