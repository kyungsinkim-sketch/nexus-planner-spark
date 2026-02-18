/**
 * Korean Regex Parser — Client-side Korean NLP for CRUD action extraction
 *
 * Replaces LLM (Claude) calls for simple CRUD operations:
 * - create_todo: "~에게 ~해줘", "~까지 ~하기"
 * - create_event: "~에 회의", "~시에 만나자"
 * - share_location: "~에서 만나자", "장소: ~"
 *
 * Uses regex pattern matching + Korean honorific stripping + date parsing.
 * No API calls — runs entirely on the client.
 */

// ============================================================
// Types
// ============================================================

interface ChatMember {
  id: string;
  name: string;
}

export interface ParseResult {
  hasAction: boolean;
  replyMessage: string;
  actions: ParsedAction[];
}

export interface ParsedAction {
  type: 'create_todo' | 'create_event' | 'share_location';
  confidence: number;
  data: ParsedTodoData | ParsedEventData | ParsedLocationData;
}

export interface ParsedTodoData {
  title: string;
  assigneeNames: string[];
  assigneeIds: string[];
  dueDate: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  projectId: string | null;
}

export interface ParsedEventData {
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  locationUrl: string | null;
  attendeeIds: string[];
  type: 'MEETING' | 'TASK' | 'DEADLINE' | 'DELIVERY';
  projectId: string | null;
}

export interface ParsedLocationData {
  title: string;
  address: string;
  searchQuery: string;
}

// ============================================================
// Constants
// ============================================================

// Korean honorific suffixes to strip for name matching
const HONORIFICS = [
  '님', '씨', '선배', '후배',
  '과장', '대리', '부장', '차장', '사장', '실장', '이사', '본부장',
  '팀장', '대표', '사원', '주임', '계장',
];

// Day name mapping (Korean → JS day number, 0=Sunday)
const DAY_NAMES: Record<string, number> = {
  '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3,
  '목요일': 4, '금요일': 5, '토요일': 6,
  '일': 0, '월': 1, '화': 2, '수': 3,
  '목': 4, '금': 5, '토': 6,
};

// Priority keywords
const HIGH_PRIORITY_KEYWORDS = ['급한', '급하게', '긴급', '긴급하게', 'ASAP', 'asap', '빨리', '급히', '당장', '지금 바로', '최우선'];
const LOW_PRIORITY_KEYWORDS = ['여유있게', '천천히', '시간될 때', '시간 될 때', '시간나면', '시간 나면', '나중에', '여유롭게'];

// Location place markers
const PLACE_MARKERS = [
  '카페', '사무실', '역', '센터', '빌딩', '건물', '층', '호점',
  '식당', '레스토랑', '호텔', '회의실', '스튜디오', '공원',
  '도서관', '학교', '병원', '마트', '백화점', '극장',
];

// ============================================================
// False Positive Filters (for @ai-free auto-parsing)
// ============================================================

// Past tense endings — these indicate reports, not commands
const PAST_TENSE_ENDINGS = /(?:했어|했다|했네|했음|했어요|했습니다|갔어|갔다|왔어|왔다|봤어|봤다|만났어|만났다|줬어|줬다|됐어|됐다|였어|이었어|끝났어|끝났다|완료했어|완료했다|했었어|마쳤어|마쳤다|마쳤습니다|했거든|갔거든|왔거든|났어|났다)(?:\s*[.!?~ㅎㅋ]*)$/;

// Report/past context starters — indicate describing what happened, not requesting action
const REPORT_STARTERS = /^(?:어제|아까|그때|방금|조금\s*전|지난\s*번에|지난주에|저번에|예전에|그저께|엊그제)/;

// Gratitude/acknowledgment — not commands
const GRATITUDE_PATTERNS = /(?:고마워|고맙습니다|감사합니다|감사해|수고했어|수고하셨|잘\s*했어|잘\s*했다|잘했네|덕분에|다행이다|다행이야|해줘서|해주셔서)/;

// ============================================================
// Main Parser
// ============================================================

/**
 * Parse a Korean message and extract CRUD actions using regex patterns.
 * Designed for auto-parsing (no @ai trigger) — includes false positive guards.
 */
export function parseMessageWithRegex(
  content: string,
  chatMembers: ChatMember[],
  projectId?: string,
): ParseResult {
  // ── False Positive Guard: skip past tense, reports, gratitude ──
  if (
    PAST_TENSE_ENDINGS.test(content) ||
    REPORT_STARTERS.test(content) ||
    GRATITUDE_PATTERNS.test(content)
  ) {
    return { hasAction: false, replyMessage: '', actions: [] };
  }

  // Skip very short messages (< 4 chars) — not enough info
  if (content.trim().length < 4) {
    return { hasAction: false, replyMessage: '', actions: [] };
  }

  const actions: ParsedAction[] = [];

  // Try each pattern type — prioritize by specificity
  const todoAction = parseTodoPatterns(content, chatMembers, projectId);
  if (todoAction) actions.push(todoAction);

  const eventAction = parseEventPatterns(content, chatMembers, projectId);
  if (eventAction) actions.push(eventAction);

  const locationAction = parseLocationPatterns(content);
  if (locationAction) actions.push(locationAction);

  // ── Merge: Event + Location → location info absorbed into Event ──
  // When both event and location are detected in the same message,
  // merge the location data into the event's `location` field and
  // drop the standalone share_location action.
  // e.g., "강남역 9번출구에서 3시에 미팅" → Event with location="강남역 9번출구"
  if (eventAction && locationAction) {
    const eventData = eventAction.data as ParsedEventData;
    const locationData = locationAction.data as ParsedLocationData;

    // Set event's location field from the extracted location title
    eventData.location = locationData.title;
    if (locationData.address) {
      eventData.location = locationData.address; // Prefer explicit address if available
    }

    // Remove the standalone share_location action from the array
    const locIdx = actions.findIndex(a => a.type === 'share_location');
    if (locIdx !== -1) {
      actions.splice(locIdx, 1);
    }
  }

  // If no patterns matched, return silently (no bot message in auto-parse mode)
  if (actions.length === 0) {
    return {
      hasAction: false,
      replyMessage: '',
      actions: [],
    };
  }

  // Generate a natural reply message
  const replyMessage = generateReplyMessage(actions);

  return {
    hasAction: true,
    replyMessage,
    actions,
  };
}

// ============================================================
// Todo Pattern Parser
// ============================================================

function parseTodoPatterns(
  content: string,
  chatMembers: ChatMember[],
  projectId?: string,
): ParsedAction | null {
  let title = '';
  let assigneeNames: string[] = [];
  let assigneeIds: string[] = [];
  let dueDateStr: string | null = null;
  let matched = false;

  // Pattern 1: "~에게 ~해줘/해달라/부탁/해주세요"
  // e.g., "민규에게 디자인 완성 해줘", "민규님한테 보고서 작성 부탁"
  const assignPattern = /(.+?)(?:님|씨|선배)?(?:에게|한테)\s+(.+?)(?:해줘|해달라|부탁|해주세요|해주십시오|해주시겠어요|맡겨|전달|시켜)\s*$/;
  const assignMatch = content.match(assignPattern);

  if (assignMatch) {
    const rawName = assignMatch[1].trim();
    title = assignMatch[2].trim();
    assigneeNames = [rawName];
    const resolved = resolveNames([rawName], chatMembers);
    assigneeIds = resolved.resolvedIds;
    matched = true;
  }

  // Pattern 2: "~까지 ~하기/완성/제출/마감"
  // e.g., "내일까지 디자인 완성", "금요일까지 보고서 제출"
  if (!matched) {
    const deadlinePattern = /(.+?)까지\s+(.+?)(?:하기|완성|제출|마감|끝내기|완료|마무리)\s*$/;
    const deadlineMatch = content.match(deadlinePattern);

    if (deadlineMatch) {
      const dateExpr = deadlineMatch[1].trim();
      title = deadlineMatch[2].trim();
      const parsed = parseDateExpression(dateExpr);
      if (parsed.date) {
        dueDateStr = parsed.date;
      }
      matched = true;
    }
  }

  // Pattern 3: "~할 일: ~" or "할일: ~" or "TODO: ~"
  // e.g., "할 일: 디자인 시안 3개 만들기", "TODO: 최종 검토"
  if (!matched) {
    const todoLabelPattern = /(?:할\s*일|할일|TODO|todo|To-do|to-do)\s*[:：]\s*(.+)/;
    const todoLabelMatch = content.match(todoLabelPattern);

    if (todoLabelMatch) {
      title = todoLabelMatch[1].trim();
      matched = true;
    }
  }

  // Pattern 4: General task assignment — "~ 해줘/해달라/부탁/해주세요" (without explicit assignee)
  // e.g., "보고서 작성 해줘", "디자인 수정 부탁"
  if (!matched) {
    const generalTaskPattern = /(.+?)\s*(?:해줘|해달라|부탁해|부탁합니다|해주세요|해주십시오|만들어줘|만들어주세요|작성해줘|작성해주세요|완성해줘|완성해주세요)\s*$/;
    const generalMatch = content.match(generalTaskPattern);

    if (generalMatch) {
      title = generalMatch[1].trim();
      matched = true;
    }
  }

  if (!matched || !title) return null;

  // Extract date if not already found
  if (!dueDateStr) {
    const dateInfo = extractDateFromText(content);
    if (dateInfo) {
      dueDateStr = dateInfo;
    }
  }

  // Extract assignee names from content if not already found
  if (assigneeNames.length === 0) {
    const nameExtraction = extractNamesFromText(content, chatMembers);
    assigneeNames = nameExtraction.names;
    assigneeIds = nameExtraction.ids;
  }

  // Detect priority
  const priority = detectPriority(content);

  return {
    type: 'create_todo',
    confidence: assigneeIds.length > 0 ? 0.85 : 0.7,
    data: {
      title,
      assigneeNames,
      assigneeIds,
      dueDate: dueDateStr,
      priority,
      projectId: projectId || null,
    },
  };
}

// ============================================================
// Event Pattern Parser
// ============================================================

function parseEventPatterns(
  content: string,
  chatMembers: ChatMember[],
  projectId?: string,
): ParsedAction | null {
  let title = '';
  let startAt = '';
  let endAt = '';
  let eventType: 'MEETING' | 'TASK' | 'DEADLINE' | 'DELIVERY' = 'MEETING';
  let matched = false;
  let capturedTimeExpr: string | null = null; // For inline location extraction

  // Event type keywords
  const meetingKeywords = ['회의', '미팅', '모임', '스크럼', '스탠드업', '킥오프', '브리핑', '워크샵'];
  const deadlineKeywords = ['마감', '데드라인', '마감일', '기한', '마감기한'];
  const deliveryKeywords = ['납품', '전달', '배송', '딜리버리', '인도'];

  // Detect event type
  for (const kw of deadlineKeywords) {
    if (content.includes(kw)) { eventType = 'DEADLINE'; break; }
  }
  for (const kw of deliveryKeywords) {
    if (content.includes(kw)) { eventType = 'DELIVERY'; break; }
  }

  // Pattern 1: "~에 회의/미팅/모임"
  // e.g., "금요일 3시에 팀 회의", "다음주 월요일에 클라이언트 미팅"
  const eventTimePattern = /(.+?)(?:에|날)\s+(.*?(?:회의|미팅|모임|스크럼|스탠드업|킥오프|브리핑|워크샵|약속|일정|마감|데드라인|납품).*)/;
  const eventMatch = content.match(eventTimePattern);

  if (eventMatch) {
    const timeExpr = eventMatch[1].trim();
    capturedTimeExpr = timeExpr; // Save for inline location extraction
    title = eventMatch[2].trim();
    const parsed = parseDateTimeExpression(timeExpr);
    if (parsed.dateTime) {
      startAt = parsed.dateTime;
      endAt = parsed.endDateTime || addHours(startAt, 1);
      matched = true;
    }
  }

  // Pattern 2: "~시에 만나자/모이자"
  // e.g., "3시에 만나자", "오후 2시에 모이자"
  if (!matched) {
    const meetAtPattern = /(.+?)(?:시에?|에)\s*(?:만나자|모이자|모여|시작|봐요|만나요|만남)/;
    const meetMatch = content.match(meetAtPattern);

    if (meetMatch) {
      const timeExpr = meetMatch[1].trim();
      title = content; // Use full content as title
      const parsed = parseDateTimeExpression(timeExpr);
      if (parsed.dateTime) {
        startAt = parsed.dateTime;
        endAt = addHours(startAt, 1);
        matched = true;
      }
    }
  }

  // Pattern 3: Explicit meeting — contains meeting keywords + time
  if (!matched) {
    const hasMeetingKeyword = meetingKeywords.some(kw => content.includes(kw));
    if (hasMeetingKeyword) {
      const timeInfo = extractTimeFromText(content);
      if (timeInfo) {
        startAt = timeInfo;
        endAt = addHours(startAt, 1);
        title = content;
        matched = true;
      }
    }
  }

  if (!matched || !startAt) return null;

  // Extract attendee IDs from all names mentioned in the content
  const nameExtraction = extractNamesFromText(content, chatMembers);
  let attendeeIds = nameExtraction.ids;

  // Also check for explicit attendee patterns: "~참석", "~참여", "~포함"
  if (attendeeIds.length === 0) {
    const attendeePattern = /(.+?)(?:\s*참석|\s*참여|\s*포함)/;
    const attendeeMatch = content.match(attendeePattern);
    if (attendeeMatch) {
      const attendeeText = attendeeMatch[1].trim();
      // Split by comma or connectors and try to resolve
      const nameTokens = attendeeText
        .split(/[,，]\s*|\s+(?:과|와|하고|이랑|랑)\s+/)
        .map(n => n.trim())
        .filter(n => n.length > 0);
      const resolved = resolveNames(nameTokens, chatMembers);
      if (resolved.resolvedIds.length > 0) {
        attendeeIds = resolved.resolvedIds;
      }
    }
  }

  // ── Inline location extraction from event time expression ──
  // When the time expression contains "에서", the text before it is a location.
  // e.g., "민규님 2월 16일 강남역 9번출구에서 3시" → location = "강남역 9번출구"
  let extractedLocation: string | null = null;
  if (capturedTimeExpr) {
    const eoseoIdx = capturedTimeExpr.indexOf('에서');
    if (eoseoIdx > 0) {
      let locCandidate = capturedTimeExpr.substring(0, eoseoIdx).trim();

      // Strip date expressions (e.g., "2월 16일", "내일", "다음주")
      locCandidate = locCandidate
        .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일?/g, '')  // "2월 16일"
        .replace(/\d{1,2}\s*[월/]\s*\d{1,2}/g, '')      // "2/16"
        .replace(/(?:오늘|내일|모레|다음\s*주|이번\s*주)/g, '')
        .replace(/(?:월|화|수|목|금|토|일)요일/g, '')
        .trim();

      // Strip person names (chatMembers-based)
      // Match both full name (박민규) and given name (민규) + honorifics
      for (const member of chatMembers) {
        const bare = stripHonorifics(member.name);
        // Build variants: full name, bare name, given name (last 2 chars)
        const variants = [member.name, bare];
        const givenName = bare.length >= 2 ? bare.slice(-2) : bare;
        if (givenName !== bare) {
          variants.push(givenName);
        }
        // Add honorific variants for each base form
        for (const base of [bare, givenName]) {
          for (const h of HONORIFICS) {
            variants.push(base + h);
          }
        }
        // Sort by length descending — longest match first to prevent
        // partial match (e.g., "민규" matching before "민규님")
        const sortedVariants = [...new Set(variants)].sort((a, b) => b.length - a.length);
        for (const v of sortedVariants) {
          if (locCandidate.startsWith(v)) {
            locCandidate = locCandidate.substring(v.length).trim();
          }
        }
      }

      // Only use if meaningful location string remains (2+ chars)
      if (locCandidate.length >= 2) {
        extractedLocation = locCandidate;
      }
    }
  }

  // Clean event title: strip attendee names, honorifics, request phrases
  const cleanedTitle = cleanEventTitle(title, chatMembers);

  return {
    type: 'create_event',
    confidence: 0.75,
    data: {
      title: cleanedTitle,
      startAt,
      endAt,
      location: extractedLocation,
      locationUrl: null,
      attendeeIds,
      type: eventType,
      projectId: projectId || null,
    },
  };
}

// ============================================================
// Event Title Cleaning
// ============================================================

/**
 * Clean event title by stripping:
 * - Attendee names and honorifics ("민규님, 송희님 요한님 포함해서요")
 * - Request/polite suffixes ("부탁합니다", "해주세요", "포함해서요")
 * - Sentence-ending particles and connectors
 *
 * e.g., "내부 미팅 부탁합니다. 민규님, 송희님 요한님 포함해서요" → "내부 미팅"
 */
function cleanEventTitle(rawTitle: string, chatMembers: ChatMember[]): string {
  let title = rawTitle;

  // Split by sentence boundary (period, comma followed by space)
  // The first sentence is likely the core title; rest may be attendee info
  const sentences = title.split(/[.。]\s*/);
  if (sentences.length > 1) {
    // Check if later sentences are mostly attendee names / inclusion phrases
    const firstSentence = sentences[0].trim();
    const restText = sentences.slice(1).join('. ').trim();

    // If rest contains attendee/inclusion patterns, use only first sentence
    const attendeePattern = /(?:포함|참석|참여|함께|같이|불러|초대)/;
    if (attendeePattern.test(restText)) {
      title = firstSentence;
    }
  }

  // Remove attendee name mentions with honorifics
  // e.g., "민규님", "송희님", "요한님"
  for (const member of chatMembers) {
    const bare = stripHonorifics(member.name);
    const givenName = bare.length >= 2 ? bare.slice(-2) : bare;
    const variants = [member.name, bare, givenName];

    for (const base of [bare, givenName]) {
      for (const h of HONORIFICS) {
        variants.push(base + h);
      }
    }

    // Sort longest first to prevent partial replacement
    const sorted = [...new Set(variants)].sort((a, b) => b.length - a.length);
    for (const v of sorted) {
      // Replace name + optional trailing comma/space/connector
      title = title.replace(new RegExp(v + '[,，\\s]*', 'g'), '');
    }
  }

  // Remove request/polite suffixes
  title = title.replace(/\s*(?:부탁합니다|부탁해요|부탁해|부탁드립니다|해주세요|해줘|잡아주세요|잡아줘|포함해서요|포함해서|포함해주세요|포함해줘|참석시켜주세요|참석시켜줘)\s*/g, '');

  // Remove trailing connectors and particles
  title = title.replace(/\s*(?:과|와|하고|이랑|랑|도)\s*$/g, '');

  // Remove leading/trailing punctuation and whitespace
  title = title.replace(/^[\s,，.。]+|[\s,，.。]+$/g, '').trim();

  // If title became empty after cleaning, fall back to first meeting keyword found
  if (!title) {
    const meetingKeywords = ['회의', '미팅', '모임', '스크럼', '스탠드업', '킥오프', '브리핑', '워크샵', '약속', '일정'];
    for (const kw of meetingKeywords) {
      if (rawTitle.includes(kw)) {
        title = kw;
        break;
      }
    }
  }

  // Final fallback
  if (!title) {
    title = rawTitle.split(/[.。,，]/)[0].trim();
  }

  return title;
}

// ============================================================
// Location Pattern Parser
// ============================================================

function parseLocationPatterns(content: string): ParsedAction | null {
  let title = '';
  let address = '';
  let matched = false;

  // Pattern 1: "~에서 만나자/만나요/모이자"
  // e.g., "강남역 카페에서 만나자", "사무실에서 만나요"
  const meetAtPlacePattern = /(.+?)에서\s*(?:만나자|만나요|만남|모이자|모여|봐요|보자)/;
  const meetMatch = content.match(meetAtPlacePattern);

  if (meetMatch) {
    title = meetMatch[1].trim();
    matched = true;
  }

  // Pattern 2: "장소: ~" or "위치: ~"
  if (!matched) {
    const locationLabelPattern = /(?:장소|위치|Place|place)\s*[:：]\s*(.+)/;
    const labelMatch = content.match(locationLabelPattern);

    if (labelMatch) {
      title = labelMatch[1].trim();
      matched = true;
    }
  }

  // Pattern 3 REMOVED — PLACE_MARKERS standalone matching caused too many false
  // positives (e.g., "어제 카페 갔어" → unwanted location share). Only explicit
  // patterns (Pattern 1: "~에서 만나자", Pattern 2: "장소: ~") are kept.

  if (!matched || !title) return null;

  // Try to extract address if present
  const addressPattern = /(?:주소|address)\s*[:：]\s*(.+)/i;
  const addressMatch = content.match(addressPattern);
  if (addressMatch) {
    address = addressMatch[1].trim();
  }

  return {
    type: 'share_location',
    confidence: 0.7,
    data: {
      title,
      address,
      searchQuery: title,
    },
  };
}

// ============================================================
// Name Resolution
// ============================================================

/**
 * Strip Korean honorifics from a name.
 */
export function stripHonorifics(name: string): string {
  let stripped = name.trim();
  for (const h of HONORIFICS) {
    if (stripped.endsWith(h)) {
      stripped = stripped.slice(0, -h.length).trim();
      break; // Only strip one suffix
    }
  }
  return stripped;
}

/**
 * Resolve raw names against chat members using partial matching.
 */
function resolveNames(
  rawNames: string[],
  chatMembers: ChatMember[],
): { resolvedIds: string[]; originalNames: string[] } {
  const resolvedIds: string[] = [];
  const originalNames: string[] = [];

  for (const raw of rawNames) {
    const stripped = stripHonorifics(raw);
    if (!stripped) continue;

    // Try exact match first
    let found = chatMembers.find(m => m.name === stripped);

    // Try partial match (stripped name contained in member name or vice versa)
    if (!found) {
      found = chatMembers.find(m =>
        m.name.includes(stripped) || stripped.includes(m.name),
      );
    }

    if (found) {
      resolvedIds.push(found.id);
      originalNames.push(raw);
    }
  }

  return { resolvedIds, originalNames };
}

/**
 * Extract potential person names from text by matching against chat members.
 */
function extractNamesFromText(
  content: string,
  chatMembers: ChatMember[],
): { names: string[]; ids: string[] } {
  const names: string[] = [];
  const ids: string[] = [];

  for (const member of chatMembers) {
    // Check if member's full name or partial name appears in content
    const memberName = member.name;
    const nameParts = memberName.split('');

    // Full name match
    if (content.includes(memberName)) {
      if (!ids.includes(member.id)) {
        names.push(memberName);
        ids.push(member.id);
      }
      continue;
    }

    // Last name + first name partial (e.g., "민규" in "박민규")
    // For Korean names, try the last 2 characters (given name)
    if (memberName.length >= 2) {
      const givenName = memberName.slice(-2); // Last 2 chars = given name
      if (givenName.length >= 2 && content.includes(givenName)) {
        // Verify it's not a common word false positive
        const withHonorific = HONORIFICS.some(h => content.includes(givenName + h));
        const standalone = new RegExp(`(?:^|[\\s,，])${givenName}(?:님|씨|에게|한테|이|가|은|는|[\\s,，]|$)`).test(content);

        if (withHonorific || standalone) {
          if (!ids.includes(member.id)) {
            names.push(givenName);
            ids.push(member.id);
          }
        }
      }
    }
  }

  return { names, ids };
}

// ============================================================
// Date/Time Parsing
// ============================================================

/**
 * Parse a Korean date expression and return an ISO date string.
 */
function parseDateExpression(text: string): { date: string | null } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // "오늘"
  if (text.includes('오늘')) {
    return { date: toISODate(today) };
  }

  // "내일"
  if (text.includes('내일')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { date: toISODate(tomorrow) };
  }

  // "모레"
  if (text.includes('모레')) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return { date: toISODate(dayAfter) };
  }

  // "다음주 ~요일"
  const nextWeekDayMatch = text.match(/다음\s*주\s*(월|화|수|목|금|토|일)(?:요일)?/);
  if (nextWeekDayMatch) {
    const targetDay = DAY_NAMES[nextWeekDayMatch[1]] ?? DAY_NAMES[nextWeekDayMatch[1] + '요일'];
    if (targetDay !== undefined) {
      const result = getNextWeekday(today, targetDay, true);
      return { date: toISODate(result) };
    }
  }

  // Specific date: "M월 D일" or "M/D"
  // IMPORTANT: Must check BEFORE day-of-week pattern to prevent
  // "16일" → "일(Sunday)" false match
  const specificDateMatch = text.match(/(\d{1,2})\s*[월/]\s*(\d{1,2})\s*일?/);
  if (specificDateMatch) {
    const month = parseInt(specificDateMatch[1], 10) - 1;
    const day = parseInt(specificDateMatch[2], 10);
    const result = new Date(now.getFullYear(), month, day);
    // If the date is in the past, assume next year
    if (result < today) {
      result.setFullYear(result.getFullYear() + 1);
    }
    return { date: toISODate(result) };
  }

  // "이번주 ~요일" or just "~요일"
  // Negative lookbehind (?<!\d) prevents "16일" from matching as day-of-week "일"
  const thisDayMatch = text.match(/(?:이번\s*주\s*)?(?<!\d)(월|화|수|목|금|토|일)(?:요일)?/);
  if (thisDayMatch) {
    const targetDay = DAY_NAMES[thisDayMatch[1]] ?? DAY_NAMES[thisDayMatch[1] + '요일'];
    if (targetDay !== undefined) {
      const result = getNextWeekday(today, targetDay, false);
      return { date: toISODate(result) };
    }
  }

  // "N일 후" / "N일 뒤"
  const daysLaterMatch = text.match(/(\d+)\s*일\s*(?:후|뒤)/);
  if (daysLaterMatch) {
    const days = parseInt(daysLaterMatch[1], 10);
    const result = new Date(today);
    result.setDate(result.getDate() + days);
    return { date: toISODate(result) };
  }

  // "다음주"
  if (text.includes('다음주') || text.includes('다음 주')) {
    const nextMonday = getNextWeekday(today, 1, true);
    return { date: toISODate(nextMonday) };
  }

  return { date: null };
}

/**
 * Parse a Korean date+time expression and return an ISO datetime string.
 */
function parseDateTimeExpression(text: string): { dateTime: string | null; endDateTime: string | null } {
  const dateInfo = parseDateExpression(text);
  const timeInfo = parseTimeExpression(text);

  if (!dateInfo.date && !timeInfo.hour) {
    return { dateTime: null, endDateTime: null };
  }

  // Build the datetime using LOCAL timezone
  // IMPORTANT: new Date("YYYY-MM-DD") parses as UTC midnight, which shifts
  // the date in KST. We parse components and use new Date(y, m, d) instead.
  const dateStr = dateInfo.date || toISODate(new Date());
  const [year, month, dayOfMonth] = dateStr.split('-').map(Number);
  const baseDate = new Date(year, month - 1, dayOfMonth);

  if (timeInfo.hour !== null) {
    baseDate.setHours(timeInfo.hour, timeInfo.minute, 0, 0);
  } else {
    // Default to 10:00 AM KST if no time specified
    baseDate.setHours(10, 0, 0, 0);
  }

  // Use toLocalISOString to preserve KST timezone and prevent UTC date shifting
  const startAt = toLocalISOString(baseDate);
  let endDateTime: string | null = null;

  if (timeInfo.endHour !== null) {
    const endDate = new Date(baseDate);
    endDate.setHours(timeInfo.endHour, timeInfo.endMinute, 0, 0);
    endDateTime = toLocalISOString(endDate);
  }

  return { dateTime: startAt, endDateTime };
}

/**
 * Parse Korean time expressions.
 */
function parseTimeExpression(text: string): {
  hour: number | null;
  minute: number;
  endHour: number | null;
  endMinute: number;
} {
  let hour: number | null = null;
  let minute = 0;
  let endHour: number | null = null;
  let endMinute = 0;

  // "오후 N시 M분" or "오전 N시 M분"
  const fullTimeMatch = text.match(/(오전|오후|AM|PM|am|pm)?\s*(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분)?/);
  if (fullTimeMatch) {
    const period = fullTimeMatch[1];
    hour = parseInt(fullTimeMatch[2], 10);
    minute = fullTimeMatch[3] ? parseInt(fullTimeMatch[3], 10) : 0;

    if (period === '오후' || period === 'PM' || period === 'pm') {
      if (hour < 12) hour += 12;
    } else if (period === '오전' || period === 'AM' || period === 'am') {
      if (hour === 12) hour = 0;
    } else {
      // No period specified — assume PM for hours 1-6, AM for 7-11
      if (hour >= 1 && hour <= 6) hour += 12;
    }
  }

  // "점심시간" or "점심"
  if (hour === null && (text.includes('점심시간') || text.includes('점심'))) {
    hour = 12;
    minute = 0;
  }

  // "아침"
  if (hour === null && text.includes('아침')) {
    hour = 9;
    minute = 0;
  }

  // "저녁"
  if (hour === null && text.includes('저녁')) {
    hour = 18;
    minute = 0;
  }

  // Check for end time: "~시부터 ~시까지" or "~시~시"
  const rangeMatch = text.match(/(\d{1,2})\s*시\s*(?:부터|에서)\s*(\d{1,2})\s*시/);
  if (rangeMatch) {
    endHour = parseInt(rangeMatch[2], 10);
    if (endHour <= 6) endHour += 12; // Assume PM for small numbers
  }

  return { hour, minute, endHour, endMinute };
}

/**
 * Extract a date from general text (looks for date keywords anywhere in the string).
 */
function extractDateFromText(text: string): string | null {
  // Check common date keywords
  const dateKeywords = ['오늘', '내일', '모레', '다음주', '이번주', '다음 주', '이번 주'];
  for (const kw of dateKeywords) {
    if (text.includes(kw)) {
      const result = parseDateExpression(kw);
      if (result.date) return result.date;
    }
  }

  // Check "~까지" pattern
  const deadlineMatch = text.match(/(.+?)까지/);
  if (deadlineMatch) {
    const result = parseDateExpression(deadlineMatch[1].trim());
    if (result.date) return result.date;
  }

  // Check day names
  const dayMatch = text.match(/(월|화|수|목|금|토|일)(?:요일)?/);
  if (dayMatch) {
    const result = parseDateExpression(dayMatch[0]);
    if (result.date) return result.date;
  }

  return null;
}

/**
 * Extract time from general text.
 */
function extractTimeFromText(text: string): string | null {
  const dateInfo = extractDateFromText(text);
  const timeInfo = parseTimeExpression(text);

  if (timeInfo.hour === null && !dateInfo) return null;

  const dateStr = dateInfo || toISODate(new Date());
  const baseDate = new Date(dateStr);

  if (timeInfo.hour !== null) {
    baseDate.setHours(timeInfo.hour, timeInfo.minute, 0, 0);
  } else {
    baseDate.setHours(10, 0, 0, 0);
  }

  return toLocalISOString(baseDate);
}

// ============================================================
// Priority Detection
// ============================================================

function detectPriority(content: string): 'LOW' | 'NORMAL' | 'HIGH' {
  for (const kw of HIGH_PRIORITY_KEYWORDS) {
    if (content.includes(kw)) return 'HIGH';
  }
  for (const kw of LOW_PRIORITY_KEYWORDS) {
    if (content.includes(kw)) return 'LOW';
  }
  return 'NORMAL';
}

// ============================================================
// Follow-up / Context-dependent Pattern Detection
// ============================================================

/**
 * Detect patterns that reference previous messages (context-dependent).
 * Since regex can't access conversation history, we return a helpful message
 * guiding the user to include all info in a single message.
 */
function detectFollowUpPattern(
  content: string,
  chatMembers: ChatMember[],
): ParseResult | null {
  // Pattern: "~초대 부탁" / "~초대해줘" / "~추가해줘" / "~참석"
  // e.g., "민규님, 송희님 초대 부탁", "형화님 추가해줘"
  const invitePattern = /(.+?)(?:초대\s*(?:부탁|해줘|해주세요)|추가\s*(?:해줘|해주세요|부탁)|참석\s*(?:시켜|부탁))/;
  const inviteMatch = content.match(invitePattern);

  if (inviteMatch) {
    // Extract the names mentioned
    const namesText = inviteMatch[1].trim();
    // Split by comma, space, or 과/와/하고 connectors
    const nameTokens = namesText
      .split(/[,，]\s*|\s+(?:과|와|하고|이랑|랑)\s+|\s+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);

    const resolved = resolveNames(nameTokens, chatMembers);
    const nameList = resolved.originalNames.length > 0
      ? resolved.originalNames.join(', ')
      : nameTokens.join(', ');

    return {
      hasAction: false,
      replyMessage: `${nameList}님을 초대/추가하시려는 것 같습니다.\n\n⚠️ 이전 대화의 맥락은 참조할 수 없어요. 한 메시지에 모든 정보를 포함해주세요.\n\n예시:\n• "금요일 3시에 팀 미팅, ${nameList} 참석"\n• "${nameList}에게 보고서 작성 부탁"`,
      actions: [],
    };
  }

  // Pattern: "~변경해줘" / "~수정해줘" / "~바꿔줘" (modification requests)
  // These are now handled by the LLM via update_event action type.
  // The Korean regex parser passes them through to the LLM instead of blocking.
  // (취소/삭제 are still not supported by regex parser — LLM handles these too)

  // Pattern: "누구누구" question-style (asking who/when/where)
  const questionPattern = /(?:누가|언제|어디서|몇시|어떻게)\s*(?:참석|올|가|할|하|만나)/;
  if (questionPattern.test(content)) {
    return {
      hasAction: false,
      replyMessage: '질문에 답변하는 기능은 아직 준비 중입니다. 현재는 다음 작업을 지원합니다:\n\n• 할 일 생성: "민규에게 보고서 작성 부탁"\n• 일정 생성: "금요일 3시에 팀 미팅"\n• 장소 공유: "강남역 카페에서 만나자"',
      actions: [],
    };
  }

  return null;
}

// ============================================================
// Reply Message Generation
// ============================================================

function generateReplyMessage(actions: ParsedAction[]): string {
  const parts: string[] = [];

  for (const action of actions) {
    switch (action.type) {
      case 'create_todo': {
        const data = action.data as ParsedTodoData;
        let msg = `할 일을 생성합니다: "${data.title}"`;
        if (data.assigneeNames.length > 0) {
          msg += ` (담당: ${data.assigneeNames.join(', ')})`;
        }
        if (data.dueDate) {
          const dueDate = new Date(data.dueDate);
          msg += ` — 기한: ${dueDate.getMonth() + 1}/${dueDate.getDate()}`;
        }
        if (data.priority !== 'NORMAL') {
          msg += ` [${data.priority}]`;
        }
        parts.push(msg);
        break;
      }
      case 'create_event': {
        const data = action.data as ParsedEventData;
        const startDate = new Date(data.startAt);
        const month = startDate.getMonth() + 1;
        const day = startDate.getDate();
        const hour = startDate.getHours();
        const min = String(startDate.getMinutes()).padStart(2, '0');
        const ampm = hour >= 12 ? '오후' : '오전';
        const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const timeStr = `${month}월 ${day}일 ${ampm} ${h12}:${min}`;
        let msg = `일정을 생성합니다: "${data.title}" — ${timeStr}`;
        if (data.location) {
          msg += ` 📍 ${data.location}`;
        }
        if (data.attendeeIds.length > 0) {
          msg += ` (${data.attendeeIds.length}명 참석)`;
        }
        parts.push(msg);
        break;
      }
      case 'share_location': {
        const data = action.data as ParsedLocationData;
        parts.push(`장소를 공유합니다: "${data.title}"`);
        break;
      }
    }
  }

  return parts.join('\n');
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get the next occurrence of a specific weekday.
 */
function getNextWeekday(from: Date, targetDay: number, nextWeek: boolean): Date {
  const result = new Date(from);
  const currentDay = result.getDay();
  let diff = targetDay - currentDay;

  if (nextWeek) {
    // Always go to next week
    diff = diff <= 0 ? diff + 7 : diff;
    if (diff <= 0) diff += 7;
  } else {
    // This week — if today or past, go to next occurrence
    if (diff <= 0) diff += 7;
  }

  result.setDate(result.getDate() + diff);
  return result;
}

/**
 * Convert a Date to ISO date string (YYYY-MM-DD) using LOCAL timezone.
 * IMPORTANT: .toISOString() converts to UTC, which shifts dates backward
 * in KST (UTC+9). We must use getFullYear/getMonth/getDate instead.
 */
function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convert a Date to ISO datetime string using LOCAL timezone.
 * Prevents UTC conversion from shifting dates in KST (UTC+9).
 */
function toLocalISOString(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  // Compute timezone offset (e.g., +09:00 for KST)
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const oh = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const om = String(absOffset % 60).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${oh}:${om}`;
}

/**
 * Add hours to an ISO datetime string.
 */
function addHours(isoStr: string, hours: number): string {
  const date = new Date(isoStr);
  date.setHours(date.getHours() + hours);
  return toLocalISOString(date);
}
