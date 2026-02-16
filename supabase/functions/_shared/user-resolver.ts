// Korean name → userId resolution utility
// Strips honorifics and matches against chat room member list

import type { ChatMember } from './brain-types.ts';

/**
 * Korean honorifics to strip during matching.
 */
const KOREAN_HONORIFICS = [
  '님',
  '씨',
  '선배',
  '후배',
  '과장',
  '대리',
  '부장',
  '사장',
  '팀장',
  '실장',
  '이사',
  '사원',
  '주임',
  '차장',
  '상무',
  '전무',
  '회장',
  '대표',
];

/**
 * Strip Korean honorifics from a name string.
 * e.g., "민규님" → "민규", "요한 선배" → "요한"
 */
export function stripHonorifics(name: string): string {
  let cleaned = name.trim();
  for (const h of KOREAN_HONORIFICS) {
    // Remove suffix honorifics (민규님 → 민규)
    if (cleaned.endsWith(h)) {
      cleaned = cleaned.slice(0, -h.length).trim();
    }
    // Remove separated honorifics (요한 선배 → 요한)
    if (cleaned.endsWith(` ${h}`)) {
      cleaned = cleaned.slice(0, -(h.length + 1)).trim();
    }
  }
  return cleaned;
}

/**
 * Resolve a possibly-informal name to a chat member.
 * Strategy:
 * 1. Exact match on full name
 * 2. Partial match (given name only, e.g., "민규" → "박민규")
 * 3. Strip honorifics then retry
 *
 * Returns the member or undefined if no match.
 */
export function resolveMember(
  rawName: string,
  members: ChatMember[],
): ChatMember | undefined {
  const stripped = stripHonorifics(rawName);

  // 1. Exact match
  const exact = members.find(
    (m) => m.name === rawName || m.name === stripped,
  );
  if (exact) return exact;

  // 2. Partial match — the stripped name is a suffix of a member's full name
  //    e.g., "민규" matches "박민규"
  const partial = members.find(
    (m) => m.name.endsWith(stripped) && stripped.length >= 2,
  );
  if (partial) return partial;

  // 3. Contains match — for English names or middle-of-string matches
  const contains = members.find(
    (m) => m.name.includes(stripped) && stripped.length >= 2,
  );
  if (contains) return contains;

  return undefined;
}

/**
 * Resolve multiple names at once, returning a parallel array of IDs.
 * Unresolved names get an empty string.
 */
export function resolveMembers(
  rawNames: string[],
  members: ChatMember[],
): { resolvedIds: string[]; unresolvedNames: string[] } {
  const resolvedIds: string[] = [];
  const unresolvedNames: string[] = [];

  for (const name of rawNames) {
    const member = resolveMember(name, members);
    if (member) {
      resolvedIds.push(member.id);
    } else {
      resolvedIds.push('');
      unresolvedNames.push(name);
    }
  }

  return { resolvedIds, unresolvedNames };
}
