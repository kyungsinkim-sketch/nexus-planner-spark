import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  ExternalLink,
  CalendarDays,
  Clock,
  Users,
  ListChecks,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import type { ChatMessage, DecisionVote } from '@/types/core';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isCurrentUser: boolean;
  onVoteDecision?: (messageId: string, optionId: string, reason: string) => void;
  onAcceptSchedule?: (messageId: string) => void;
}

export function ChatMessageBubble({ message, isCurrentUser, onVoteDecision, onAcceptSchedule }: ChatMessageBubbleProps) {
  const { messageType } = message;

  if (messageType === 'location' && message.locationData) {
    return <LocationBubble data={message.locationData} isCurrentUser={isCurrentUser} />;
  }

  if (messageType === 'schedule' && message.scheduleData) {
    return (
      <ScheduleBubble
        data={message.scheduleData}
        isCurrentUser={isCurrentUser}
        onAccept={() => onAcceptSchedule?.(message.id)}
      />
    );
  }

  if (messageType === 'decision' && message.decisionData) {
    return (
      <DecisionBubble
        data={message.decisionData}
        messageId={message.id}
        isCurrentUser={isCurrentUser}
        onVote={(optionId, reason) => onVoteDecision?.(message.id, optionId, reason)}
      />
    );
  }

  // Default text message
  return (
    <div
      className={`inline-block rounded-2xl px-4 py-2 text-sm ${
        isCurrentUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-foreground'
      }`}
    >
      {message.content}
    </div>
  );
}

// Location bubble with map preview
function LocationBubble({ data, isCurrentUser }: { data: NonNullable<ChatMessage['locationData']>; isCurrentUser: boolean }) {
  const providerLabel = { google: 'Google Maps', naver: 'Naver Map', kakao: 'Kakao Map', other: 'Map' }[data.provider];

  return (
    <div className={`rounded-2xl overflow-hidden border max-w-[320px] ${isCurrentUser ? 'bg-primary/5 border-primary/20' : 'bg-muted border-border'}`}>
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-sm">{data.title}</p>
            {data.address && <p className="text-xs text-muted-foreground mt-0.5">{data.address}</p>}
          </div>
        </div>
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          {providerLabel}에서 열기
        </a>
      </div>
      {/* Map preview iframe */}
      {data.provider === 'google' && data.url.includes('google') && (
        <div className="h-32 bg-muted border-t">
          <iframe
            src={`https://maps.google.com/maps?q=${encodeURIComponent(data.address || data.title)}&output=embed`}
            className="w-full h-full border-0"
            loading="lazy"
            title="Map preview"
          />
        </div>
      )}
      {data.provider !== 'google' && (
        <div className="h-20 bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-t flex items-center justify-center">
          <Badge variant="secondary" className="text-xs">{providerLabel}</Badge>
        </div>
      )}
    </div>
  );
}

// Schedule bubble with accept button
function ScheduleBubble({ data, isCurrentUser, onAccept }: {
  data: NonNullable<ChatMessage['scheduleData']>;
  isCurrentUser: boolean;
  onAccept: () => void;
}) {
  const { getUserById } = useAppStore();
  const startDate = new Date(data.startAt);
  const endDate = new Date(data.endAt);

  const formatDate = (d: Date) => d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
  const formatTime = (d: Date) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`rounded-2xl overflow-hidden border max-w-[320px] ${isCurrentUser ? 'bg-primary/5 border-primary/20' : 'bg-muted border-border'}`}>
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <CalendarDays className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          <p className="font-medium text-sm">{data.title}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatDate(startDate)} {formatTime(startDate)} ~ {formatTime(endDate)}</span>
        </div>
        {data.location && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{data.location}</span>
          </div>
        )}
        {data.description && (
          <p className="text-xs text-muted-foreground">{data.description}</p>
        )}
        {data.inviteeIds.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>
              {data.inviteeIds.map(id => getUserById(id)?.name).filter(Boolean).join(', ')}
            </span>
          </div>
        )}
        {!isCurrentUser && (
          <Button size="sm" variant="outline" className="w-full text-xs mt-1 gap-1" onClick={onAccept}>
            <CalendarDays className="w-3 h-3" />
            캘린더에 추가
          </Button>
        )}
      </div>
    </div>
  );
}

// Decision bubble with voting
function DecisionBubble({ data, messageId, isCurrentUser, onVote }: {
  data: NonNullable<ChatMessage['decisionData']>;
  messageId: string;
  isCurrentUser: boolean;
  onVote: (optionId: string, reason: string) => void;
}) {
  const { currentUser, getUserById } = useAppStore();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [expanded, setExpanded] = useState(false);

  const myVote = data.votes.find(v => v.userId === currentUser?.id);
  const isClosed = data.status === 'closed';

  const handleVote = () => {
    if (!selectedOption || !reason.trim()) return;
    onVote(selectedOption, reason.trim());
    setSelectedOption(null);
    setReason('');
  };

  return (
    <div className={`rounded-2xl overflow-hidden border max-w-[360px] ${isCurrentUser ? 'bg-primary/5 border-primary/20' : 'bg-muted border-border'}`}>
      <div className="p-3 space-y-3">
        <div className="flex items-start gap-2">
          <ListChecks className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">{data.title}</p>
            {data.description && <p className="text-xs text-muted-foreground mt-0.5">{data.description}</p>}
          </div>
        </div>

        {isClosed && (
          <Badge variant="secondary" className="text-xs">결정 완료</Badge>
        )}

        {/* Options */}
        <div className="space-y-2">
          {data.options.map((option) => {
            const optionVotes = data.votes.filter(v => v.optionId === option.id);
            const isSelected = data.selectedOptionId === option.id;
            const isMyVote = myVote?.optionId === option.id;

            return (
              <div key={option.id} className={`rounded-lg border p-2.5 transition-colors ${
                isSelected ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
                selectedOption === option.id ? 'border-primary bg-primary/5' : 'border-border'
              }`}>
                <div
                  className={`flex items-center justify-between ${!myVote && !isClosed ? 'cursor-pointer' : ''}`}
                  onClick={() => { if (!myVote && !isClosed) setSelectedOption(option.id); }}
                >
                  <div className="flex items-center gap-2">
                    {isSelected && <Check className="w-4 h-4 text-green-500" />}
                    <span className="text-sm font-medium">{option.title}</span>
                    {isMyVote && <Badge variant="outline" className="text-[10px]">내 선택</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{optionVotes.length}표</span>
                </div>
                {option.description && (
                  <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                )}

                {/* Show votes for this option */}
                {optionVotes.length > 0 && expanded && (
                  <div className="mt-2 space-y-1.5 border-t pt-2">
                    {optionVotes.map(vote => (
                      <div key={vote.userId} className="text-xs">
                        <span className="font-medium">{getUserById(vote.userId)?.name}</span>
                        <span className="text-muted-foreground ml-1">: {vote.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Vote reason input */}
        {selectedOption && !myVote && !isClosed && (
          <div className="space-y-2">
            <Input
              placeholder="선택 이유를 입력하세요 (필수)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVote()}
            />
            <Button size="sm" className="w-full text-xs" onClick={handleVote} disabled={!reason.trim()}>
              투표하기
            </Button>
          </div>
        )}

        {/* Toggle votes visibility */}
        {data.votes.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground gap-1"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? '투표 접기' : `${data.votes.length}개 투표 보기`}
          </Button>
        )}
      </div>
    </div>
  );
}
