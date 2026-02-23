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
  const brainData = (message.brainActionData as unknown) as {
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

  // Poll for status updates when any action is in 'confirmed' (Processing) state
  // The auto-execute flow changes status to 'confirmed' then 'executed',
  // but the embedded brainActionData in the chat message is never updated.
  useEffect(() => {
    const hasProcessing = resolvedActions.some(
      (a) => a.status === 'confirmed' || a.status === 'pending',
    );
    if (!hasProcessing || !fetchedIds) return;

    let cancelled = false;
    let retries = 0;
    const maxRetries = 10; // poll up to ~20 seconds

    const poll = async () => {
      if (cancelled || retries >= maxRetries) return;
      retries++;

      try {
        const dbActions = await brainService.getActionsByMessage(message.id);
        if (cancelled || dbActions.length === 0) return;

        const merged = resolvedActions.map((a, idx) => {
          const dbAction = dbActions[idx] || dbActions.find((d) => d.actionType === a.type);
          if (!dbAction) return a;
          return {
            ...a,
            id: dbAction.id || a.id,
            status: dbAction.status || a.status,
          };
        });

        setResolvedActions(merged);

        // If still processing, continue polling
        const stillProcessing = merged.some(
          (a) => a.status === 'confirmed' || a.status === 'pending',
        );
        if (stillProcessing && !cancelled) {
          setTimeout(poll, 2000);
        }
      } catch (err) {
        console.warn('Failed to poll brain action statuses:', err);
      }
    };

    const timer = setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [resolvedActions, fetchedIds, message.id]);

  if (!brainData) {
    return (
      <div className="w-fit max-w-full rounded-2xl px-4 py-2 text-sm bg-muted text-foreground" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
        {message.content}
      </div>
    );
  }

  // Check if all actions are terminal (executed/rejected/failed) — show compact inline status
  const allTerminal = brainData.hasAction &&
    resolvedActions.length > 0 &&
    resolvedActions.every((a) => a.status === 'executed' || a.status === 'rejected' || a.status === 'failed');

  return (
    <div className="space-y-2 max-w-full overflow-hidden">
      {/* Bot reply message — with inline completion badges when all actions are done */}
      <div className="w-fit max-w-full rounded-2xl px-4 py-2.5 text-sm bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 border border-violet-200/50 dark:border-violet-800/50" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Brain className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">Brain AI</span>
        </div>
        <p className="text-foreground leading-relaxed">{brainData.replyMessage}</p>

        {/* Inline compact completion badges — shown when all actions finished */}
        {allTerminal && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-violet-200/30 dark:border-violet-700/30">
            {resolvedActions.map((action, idx) => (
              <InlineActionBadge key={action.id || idx} action={action} />
            ))}
          </div>
        )}
      </div>

      {/* Full action cards — only shown when actions are still pending/processing */}
      {brainData.hasAction && !allTerminal && resolvedActions.map((action, idx) => (
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
  const { t } = useTranslation();
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
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm max-w-full">
      {/* Action header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
        <div className="flex items-center gap-2">
          <ActionIcon type={action.type} />
          <span className="text-xs font-semibold">
            {action.type === 'create_todo' && t('todo')}
            {(action.type === 'create_event' || action.type === 'update_event') && t('events')}
            {action.type === 'share_location' && t('currentLocation')}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Action body */}
      <div className="p-3">
        {action.type === 'create_todo' && (
          <TodoActionBody data={action.data as unknown as BrainExtractedTodo} />
        )}
        {(action.type === 'create_event' || action.type === 'update_event') && (
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
            {actionId ? t('brainConfirm') : t('brainLoading')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-xs h-8"
            onClick={handleReject}
            disabled={processing || !actionId}
          >
            <X className="w-3.5 h-3.5" />
            {t('brainReject')}
          </Button>
        </div>
      )}
    </div>
  );
}

function ActionIcon({ type, className }: { type: string; className?: string }) {
  const iconClass = className || 'w-4 h-4';
  switch (type) {
    case 'create_todo':
      return <ListTodo className={`${iconClass} text-blue-500`} />;
    case 'create_event':
      return <CalendarDays className={`${iconClass} text-green-500`} />;
    case 'update_event':
      return <CalendarDays className={`${iconClass} text-amber-500`} />;
    case 'share_location':
      return <MapPin className={`${iconClass} text-orange-500`} />;
    default:
      return <Brain className={`${iconClass} text-violet-500`} />;
  }
}

/** Compact inline badge for completed/rejected/failed actions — shown inside the reply bubble */
function InlineActionBadge({ action }: { action: { type: string; status?: string; data: Record<string, unknown> } }) {
  const { t } = useTranslation();
  const status = action.status || 'pending';
  const title = (action.data?.title as string) || (action.data?.originalTitle as string) || '';

  const statusConfig = {
    executed: {
      icon: CheckCircle2,
      label: t('brainDone'),
      colors: 'text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50',
    },
    rejected: {
      icon: XCircle,
      label: t('brainRejected'),
      colors: 'text-gray-500 bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800/50',
    },
    failed: {
      icon: AlertTriangle,
      label: t('brainFailed'),
      colors: 'text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50',
    },
  }[status] || null;

  if (!statusConfig) return null;
  const StatusIcon = statusConfig.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusConfig.colors}`}>
      <ActionIcon type={action.type} className="w-3 h-3" />
      <StatusIcon className="w-3 h-3" />
      {title && <span className="truncate max-w-[120px]">{title}</span>}
      {!title && <span>{statusConfig.label}</span>}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-300">
          <Clock className="w-2.5 h-2.5" />
          {t('brainPending')}
        </Badge>
      );
    case 'confirmed':
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-blue-600 border-blue-300">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          {t('brainProcessing')}
        </Badge>
      );
    case 'executed':
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-green-600 border-green-300">
          <CheckCircle2 className="w-2.5 h-2.5" />
          {t('brainDone')}
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-gray-500 border-gray-300">
          <XCircle className="w-2.5 h-2.5" />
          {t('brainRejected')}
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-red-600 border-red-300">
          <AlertTriangle className="w-2.5 h-2.5" />
          {t('brainFailed')}
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
  const { t } = useTranslation();
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
        {t('openInMaps')}
      </a>
    </div>
  );
}
