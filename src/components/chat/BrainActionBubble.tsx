/**
 * BrainActionBubble — Renders the Bot's brain_action message with action cards.
 *
 * Displays:
 * - Bot's reply message
 * - Action cards for each extracted action (todo, event, location)
 * - Confirm/Reject buttons for pending actions
 * - Status badges for processed actions
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  X,
  ListTodo,
  CalendarDays,
  MapPin,
  Loader2,
  Brain,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import * as brainService from '@/services/brainService';
import type {
  ChatMessage,
  BrainAction,
  BrainExtractedTodo,
  BrainExtractedEvent,
  BrainExtractedLocation,
  BrainActionStatus,
} from '@/types/core';

interface BrainActionBubbleProps {
  message: ChatMessage;
  onConfirmAction?: (actionId: string) => void;
  onRejectAction?: (actionId: string) => void;
}

export function BrainActionBubble({
  message,
  onConfirmAction,
  onRejectAction,
}: BrainActionBubbleProps) {
  const { t } = useTranslation();
  const brainData = message.brainActionData as {
    hasAction: boolean;
    replyMessage: string;
    actions: Array<{
      id?: string;
      type: string;
      confidence: number;
      data: Record<string, unknown>;
      status?: BrainActionStatus;
    }>;
  } | undefined;

  // When actions lack real IDs (realtime delivered before UPDATE),
  // fetch them from the brain_actions table by message_id.
  const [resolvedActions, setResolvedActions] = useState<typeof brainData extends undefined ? never : NonNullable<typeof brainData>['actions']>(
    brainData?.actions || [],
  );
  const [fetchedIds, setFetchedIds] = useState(false);

  useEffect(() => {
    if (!brainData?.hasAction || !brainData.actions.length) return;
    if (fetchedIds) return;

    // Check if any action is missing an ID
    const missingIds = brainData.actions.some((a) => !a.id);
    if (!missingIds) {
      setResolvedActions(brainData.actions);
      return;
    }

    // Fetch real action IDs from the database
    let cancelled = false;
    const fetchIds = async () => {
      try {
        const dbActions = await brainService.getActionsByMessage(message.id);
        if (cancelled) return;

        if (dbActions.length > 0) {
          // Merge DB IDs + statuses into the display actions
          const merged = brainData.actions.map((a, idx) => {
            const dbAction = dbActions[idx] || dbActions.find((d) => d.actionType === a.type);
            return {
              ...a,
              id: dbAction?.id || a.id,
              status: dbAction?.status || a.status,
            };
          });
          setResolvedActions(merged);
          setFetchedIds(true);
        } else {
          // DB actions not yet written — retry after a short delay
          setTimeout(() => {
            if (!cancelled) fetchIds();
          }, 1500);
        }
      } catch (err) {
        console.warn('Failed to fetch brain action IDs:', err);
      }
    };

    fetchIds();
    return () => { cancelled = true; };
  }, [brainData, message.id, fetchedIds]);

  // Also sync when brainData.actions change (e.g., realtime UPDATE arrives)
  useEffect(() => {
    if (brainData?.actions) {
      const hasAllIds = brainData.actions.every((a) => !!a.id);
      if (hasAllIds) {
        setResolvedActions(brainData.actions);
        setFetchedIds(true);
      }
    }
  }, [brainData?.actions]);

  if (!brainData) {
    return (
      <div className="inline-block rounded-2xl px-4 py-2 text-sm bg-muted text-foreground">
        {message.content}
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full" style={{ maxWidth: 'min(380px, 100%)' }}>
      {/* Bot reply message */}
      <div className="inline-block rounded-2xl px-4 py-2.5 text-sm bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border border-violet-200/50 dark:border-violet-800/50">
        <div className="flex items-center gap-1.5 mb-1">
          <Brain className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">Re-Be Brain</span>
        </div>
        <p className="text-foreground leading-relaxed">{brainData.replyMessage}</p>
      </div>

      {/* Action cards */}
      {brainData.hasAction && resolvedActions.map((action, idx) => (
        <ActionCard
          key={action.id || idx}
          action={action}
          messageId={message.id}
          actionIndex={idx}
          onConfirm={onConfirmAction}
          onReject={onRejectAction}
        />
      ))}
    </div>
  );
}

// Individual action card
function ActionCard({
  action,
  messageId,
  actionIndex,
  onConfirm,
  onReject,
}: {
  action: {
    type: string;
    confidence: number;
    data: Record<string, unknown>;
    id?: string;
    status?: BrainActionStatus;
  };
  messageId: string;
  actionIndex: number;
  onConfirm?: (actionId: string) => void;
  onReject?: (actionId: string) => void;
}) {
  const [processing, setProcessing] = useState(false);
  const status = action.status || 'pending';
  const actionId = action.id;

  const handleConfirm = async () => {
    if (!actionId) {
      console.warn('Cannot confirm action: no action ID yet');
      return;
    }
    setProcessing(true);
    try {
      await onConfirm?.(actionId);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!actionId) {
      console.warn('Cannot reject action: no action ID yet');
      return;
    }
    setProcessing(true);
    try {
      await onReject?.(actionId);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      {/* Action header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
        <div className="flex items-center gap-2">
          <ActionIcon type={action.type} />
          <span className="text-xs font-semibold">
            {action.type === 'create_todo' && 'Todo'}
            {action.type === 'create_event' && 'Event'}
            {action.type === 'share_location' && 'Location'}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Action body */}
      <div className="p-3">
        {action.type === 'create_todo' && (
          <TodoActionBody data={action.data as unknown as BrainExtractedTodo} />
        )}
        {action.type === 'create_event' && (
          <EventActionBody data={action.data as unknown as BrainExtractedEvent} />
        )}
        {action.type === 'share_location' && (
          <LocationActionBody data={action.data as unknown as BrainExtractedLocation} />
        )}
      </div>

      {/* Action buttons (only for pending actions with resolved IDs) */}
      {status === 'pending' && (
        <div className="flex gap-2 p-3 pt-0">
          <Button
            size="sm"
            variant="default"
            className="flex-1 gap-1.5 text-xs h-8"
            onClick={handleConfirm}
            disabled={processing || !actionId}
          >
            {processing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : !actionId ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {actionId ? 'Confirm' : 'Loading...'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-xs h-8"
            onClick={handleReject}
            disabled={processing || !actionId}
          >
            <X className="w-3.5 h-3.5" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

function ActionIcon({ type }: { type: string }) {
  switch (type) {
    case 'create_todo':
      return <ListTodo className="w-4 h-4 text-blue-500" />;
    case 'create_event':
      return <CalendarDays className="w-4 h-4 text-green-500" />;
    case 'share_location':
      return <MapPin className="w-4 h-4 text-orange-500" />;
    default:
      return <Brain className="w-4 h-4 text-violet-500" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-300">
          <Clock className="w-2.5 h-2.5" />
          Pending
        </Badge>
      );
    case 'confirmed':
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-blue-600 border-blue-300">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          Processing
        </Badge>
      );
    case 'executed':
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-green-600 border-green-300">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Done
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-gray-500 border-gray-300">
          <XCircle className="w-2.5 h-2.5" />
          Rejected
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-red-600 border-red-300">
          <AlertTriangle className="w-2.5 h-2.5" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}

function TodoActionBody({ data }: { data: BrainExtractedTodo }) {
  const { getUserById } = useAppStore();

  const assigneeNames = data.assigneeIds
    ?.map((id) => getUserById(id)?.name)
    .filter(Boolean);

  const displayNames = assigneeNames?.length
    ? assigneeNames.join(', ')
    : data.assigneeNames?.join(', ') || '-';

  return (
    <div className="space-y-1.5 text-sm">
      <p className="font-medium">{data.title}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="w-3 h-3" />
        <span>{displayNames}</span>
      </div>
      {data.dueDate && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{new Date(data.dueDate).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            weekday: 'short',
          })}</span>
        </div>
      )}
      {data.priority && data.priority !== 'NORMAL' && (
        <Badge
          variant={data.priority === 'HIGH' ? 'destructive' : 'secondary'}
          className="text-[10px]"
        >
          {data.priority}
        </Badge>
      )}
    </div>
  );
}

function EventActionBody({ data }: { data: BrainExtractedEvent }) {
  const { getUserById } = useAppStore();

  const startDate = data.startAt ? new Date(data.startAt) : null;
  const endDate = data.endAt ? new Date(data.endAt) : null;

  const attendeeNames = data.attendeeIds
    ?.map((id) => getUserById(id)?.name)
    .filter(Boolean);

  return (
    <div className="space-y-1.5 text-sm">
      <p className="font-medium">{data.title}</p>
      {startDate && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="w-3 h-3" />
          <span>
            {startDate.toLocaleDateString('ko-KR', {
              month: 'short',
              day: 'numeric',
              weekday: 'short',
            })}
            {' '}
            {startDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            {endDate && ` ~ ${endDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
          </span>
        </div>
      )}
      {data.location && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span>{data.location}</span>
        </div>
      )}
      {attendeeNames && attendeeNames.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>{attendeeNames.join(', ')}</span>
        </div>
      )}
      <Badge variant="secondary" className="text-[10px]">
        {data.type || 'MEETING'}
      </Badge>
    </div>
  );
}

function LocationActionBody({ data }: { data: BrainExtractedLocation }) {
  const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    data.searchQuery || data.title,
  )}`;

  return (
    <div className="space-y-1.5 text-sm">
      <p className="font-medium">{data.title}</p>
      {data.address && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span>{data.address}</span>
        </div>
      )}
      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <MapPin className="w-3 h-3" />
        Open in Maps
      </a>
    </div>
  );
}
