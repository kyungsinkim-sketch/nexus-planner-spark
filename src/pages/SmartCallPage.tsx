/**
 * SmartCallPage — Phone contacts + call + auto-recording pipeline.
 *
 * Features:
 * - Contact list with search
 * - Tap to call + auto-record
 * - Call history with analysis status
 * - RAG ingestion indicator
 *
 * Mobile-first design. Falls back to manual recording on desktop/web.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Search,
  Mic,
  MicOff,
  Loader2,
  CheckCircle2,
  Brain,
  Clock,
  User,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { PhoneContact, CallState } from '@/services/phoneService';
import {
  getContacts,
  searchContacts,
  makeCall,
  getCallState,
  isPhoneCallSupported,
} from '@/services/phoneService';
import {
  startRecording,
  stopRecording,
  getAnalyserNode,
} from '@/services/audioService';

// ─── Contact List Item ───────────────────────────────

function ContactItem({
  contact,
  onCall,
}: {
  contact: PhoneContact;
  onCall: (contact: PhoneContact) => void;
}) {
  return (
    <button
      onClick={() => onCall(contact)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/20"
    >
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        {contact.thumbnail ? (
          <img src={contact.thumbnail} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <User className="w-5 h-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-medium truncate">{contact.name}</div>
        {contact.company && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="w-3 h-3" />
            {contact.company}
          </div>
        )}
        <div className="text-xs text-muted-foreground truncate">
          {contact.phoneNumbers[0] || 'No number'}
        </div>
      </div>
      <Phone className="w-5 h-5 text-emerald-500 shrink-0" />
    </button>
  );
}

// ─── Active Call View ────────────────────────────────

function ActiveCallView({
  contactName,
  phoneNumber,
  callState,
  isRecording,
  duration,
  onEndCall,
}: {
  contactName?: string;
  phoneNumber: string;
  callState: CallState;
  isRecording: boolean;
  duration: number;
  onEndCall: () => void;
}) {
  const mm = String(Math.floor(duration / 60)).padStart(2, '0');
  const ss = String(Math.floor(duration % 60)).padStart(2, '0');

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
      {/* Contact avatar */}
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
        <User className="w-12 h-12 text-primary" />
      </div>

      {/* Contact info */}
      <div className="text-center">
        <div className="text-xl font-semibold">{contactName || phoneNumber}</div>
        <div className="text-sm text-muted-foreground mt-1">
          {callState === 'dialing' && '전화 거는 중...'}
          {callState === 'active' && '통화 중'}
          {callState === 'ended' && '통화 종료'}
        </div>
      </div>

      {/* Timer */}
      <div className="font-mono text-3xl tabular-nums">
        {mm}:{ss}
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 text-sm">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          녹음 중
        </div>
      )}

      {/* End call button */}
      <button
        onClick={onEndCall}
        className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg"
      >
        <PhoneOff className="w-7 h-7" />
      </button>
    </div>
  );
}

// ─── Call History Item ───────────────────────────────

function CallHistoryItem({
  recording,
}: {
  recording: {
    title: string;
    duration: number;
    status: string;
    ragIngested: boolean;
    createdAt: string;
  };
}) {
  const mm = Math.floor(recording.duration / 60);
  const ss = recording.duration % 60;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
        <Phone className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{recording.title}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{mm}:{String(ss).padStart(2, '0')}</span>
          <span>·</span>
          <span>{new Date(recording.createdAt).toLocaleDateString('ko-KR', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {recording.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        {(recording.status === 'transcribing' || recording.status === 'analyzing') && (
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        )}
        {recording.ragIngested && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">
            RAG
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────

export default function SmartCallPage() {
  const voiceRecordings = useAppStore(s => s.voiceRecordings);
  const currentUser = useAppStore(s => s.currentUser);
  const startVoiceRecording = useAppStore(s => s.startVoiceRecording);

  const [contacts, setContacts] = useState<PhoneContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeCall, setActiveCall] = useState<{ name?: string; number: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callSupported = isPhoneCallSupported();

  // Load contacts on mount
  useEffect(() => {
    async function loadContacts() {
      setLoading(true);
      try {
        const result = await getContacts();
        setContacts(result);
      } catch (err) {
        console.error('[SmartCall] Failed to load contacts:', err);
      } finally {
        setLoading(false);
      }
    }
    loadContacts();
  }, []);

  // Search contacts
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(async () => {
      const results = await searchContacts(searchQuery);
      if (results.length > 0) {
        setContacts(results);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Call duration timer
  useEffect(() => {
    if (callState !== 'active') return;
    const interval = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callState]);

  // Filter phone call recordings
  const callHistory = useMemo(() =>
    voiceRecordings
      .filter(r => r.recordingType === 'phone_call')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20),
    [voiceRecordings]
  );

  // ─── Call Handler ────────
  const handleCall = useCallback(async (contact: PhoneContact) => {
    const phoneNumber = contact.phoneNumbers[0];
    if (!phoneNumber) return;

    setActiveCall({ name: contact.name, number: phoneNumber });
    setCallState('dialing');
    setCallDuration(0);

    try {
      // Start recording first
      await startRecording();
      setIsRecording(true);

      // Then make the call
      const result = await makeCall(phoneNumber, contact.name);
      setCallState(result.state === 'dialing' ? 'active' : result.state);
    } catch (err) {
      console.error('[SmartCall] Call failed:', err);
      setCallState('idle');
      setActiveCall(null);
    }
  }, []);

  // ─── End Call Handler ────
  const handleEndCall = useCallback(async () => {
    setCallState('ended');

    if (isRecording) {
      try {
        const { blob } = await stopRecording();
        setIsRecording(false);

        // Auto-pipeline: upload → STT → Brain → RAG
        if (blob.size > 0 && currentUser) {
          await startVoiceRecording(blob, {
            title: `📞 ${activeCall?.name || activeCall?.number || 'Unknown'}`,
            recordingType: 'phone_call',
          });
        }
      } catch (err) {
        console.error('[SmartCall] Stop recording error:', err);
      }
    }

    // Reset after brief delay
    setTimeout(() => {
      setCallState('idle');
      setActiveCall(null);
      setCallDuration(0);
    }, 2000);
  }, [isRecording, activeCall, currentUser, startVoiceRecording]);

  // ─── Active call view ────
  if (callState !== 'idle' && activeCall) {
    return (
      <div className="h-full bg-background">
        <ActiveCallView
          contactName={activeCall.name}
          phoneNumber={activeCall.number}
          callState={callState}
          isRecording={isRecording}
          duration={callDuration}
          onEndCall={handleEndCall}
        />
      </div>
    );
  }

  // ─── Main view ────
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <PhoneCall className="w-5 h-5 text-primary" />
          Smart Call
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          전화 걸면 자동 녹음 → 분석 → 업무 정리
        </p>
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="이름 또는 전화번호 검색..."
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {!callSupported && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
            📱 전화 기능은 모바일 앱에서 사용 가능합니다. 현재는 수동 녹음을 사용해주세요.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length > 0 ? (
          <>
            <div className="px-4 py-1.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                연락처 ({contacts.length})
              </span>
            </div>
            {contacts.map(contact => (
              <ContactItem
                key={contact.id}
                contact={contact}
                onCall={handleCall}
              />
            ))}
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {searchQuery ? '검색 결과 없음' : '연락처를 불러오는 중...'}
          </div>
        )}

        {/* Call History */}
        {callHistory.length > 0 && (
          <>
            <div className="px-4 py-2 mt-4 border-t border-border/30">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                최근 통화 ({callHistory.length})
              </span>
            </div>
            {callHistory.map(recording => (
              <CallHistoryItem
                key={recording.id}
                recording={recording}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
