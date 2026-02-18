/**
 * SuggestionReviewDialog — Editable review popup for Brain email suggestions.
 *
 * When user clicks "확인" on a Brain suggestion, this dialog opens allowing them to:
 * - Toggle which items to create (event, todo, note) via checkboxes
 * - Edit all fields (title, date, project, assignees, priority, etc.)
 * - On "적용" → calls confirmEmailSuggestionWithEdits() which:
 *   1. Creates the selected items with edited data
 *   2. Stores feedback (original vs corrected) for Brain learning
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserSearchInput } from '@/components/ui/user-search-input';
import {
  Brain,
  Calendar,
  CheckSquare,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/stores/appStore';
import type {
  EmailBrainSuggestion,
  BrainExtractedEvent,
  BrainExtractedTodo,
  User,
} from '@/types/core';

interface SuggestionReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: EmailBrainSuggestion | null;
}

// ─── Helpers ────────────────────────────────────────

/** Extract date part (YYYY-MM-DD) from ISO string */
function isoToDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/** Extract time part (HH:mm) from ISO string in KST */
function isoToTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

/** Combine date (YYYY-MM-DD) + time (HH:mm) into ISO string */
function dateTimeToIso(date: string, time: string): string {
  if (!date) return new Date().toISOString();
  if (!time) return new Date(`${date}T00:00:00`).toISOString();
  return new Date(`${date}T${time}:00`).toISOString();
}

// ─── Component ──────────────────────────────────────

export function SuggestionReviewDialog({
  open,
  onOpenChange,
  suggestion,
}: SuggestionReviewDialogProps) {
  const { t } = useTranslation();
  const {
    projects,
    users,
    confirmEmailSuggestionWithEdits,
    gmailMessages,
  } = useAppStore();

  // Active projects for dropdown
  const activeProjects = useMemo(
    () => projects.filter(p => p.status === 'ACTIVE'),
    [projects],
  );

  // ─── State: toggles ────────
  const [includeEvent, setIncludeEvent] = useState(false);
  const [includeTodo, setIncludeTodo] = useState(false);
  const [includeNote, setIncludeNote] = useState(false);

  // ─── State: event fields ────────
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventType, setEventType] = useState<BrainExtractedEvent['type']>('MEETING');
  const [eventProjectId, setEventProjectId] = useState('');
  const [eventAttendees, setEventAttendees] = useState<User[]>([]);

  // ─── State: todo fields ────────
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDueDate, setTodoDueDate] = useState('');
  const [todoPriority, setTodoPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [todoProjectId, setTodoProjectId] = useState('');
  const [todoAssignees, setTodoAssignees] = useState<User[]>([]);

  // ─── State: note ────────
  const [noteContent, setNoteContent] = useState('');

  // ─── State: submitting ────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Populate fields when suggestion changes ────────
  useEffect(() => {
    if (!suggestion || !open) return;

    const ev = suggestion.suggestedEvent;
    const td = suggestion.suggestedTodo;

    setIncludeEvent(!!ev);
    setIncludeTodo(!!td);
    setIncludeNote(!!suggestion.suggestedNote);

    // Event fields
    if (ev) {
      setEventTitle(ev.title || '');
      setEventDate(isoToDate(ev.startAt));
      setEventStartTime(isoToTime(ev.startAt));
      setEventEndTime(isoToTime(ev.endAt));
      setEventLocation(ev.location || '');
      setEventType(ev.type || 'MEETING');
      setEventProjectId(ev.projectId || '');
      // Resolve attendee IDs to User objects
      const attendeeUsers = (ev.attendeeIds || [])
        .map(id => users.find(u => u.id === id))
        .filter(Boolean) as User[];
      setEventAttendees(attendeeUsers);
    } else {
      setEventTitle('');
      setEventDate('');
      setEventStartTime('');
      setEventEndTime('');
      setEventLocation('');
      setEventType('MEETING');
      setEventProjectId('');
      setEventAttendees([]);
    }

    // Todo fields
    if (td) {
      setTodoTitle(td.title || '');
      setTodoDueDate(isoToDate(td.dueDate));
      setTodoPriority(td.priority || 'MEDIUM');
      setTodoProjectId(td.projectId || '');
      const assigneeUsers = (td.assigneeIds || [])
        .map(id => users.find(u => u.id === id))
        .filter(Boolean) as User[];
      setTodoAssignees(assigneeUsers);
    } else {
      setTodoTitle('');
      setTodoDueDate('');
      setTodoPriority('MEDIUM');
      setTodoProjectId('');
      setTodoAssignees([]);
    }

    // Note
    setNoteContent(suggestion.suggestedNote || '');

    setIsSubmitting(false);
  }, [suggestion, open, users]);

  // ─── Build edited data & submit ────────
  const handleSubmit = async () => {
    if (!suggestion) return;
    setIsSubmitting(true);

    const editedEvent: BrainExtractedEvent | undefined = includeEvent
      ? {
          title: eventTitle,
          startAt: dateTimeToIso(eventDate, eventStartTime),
          endAt: dateTimeToIso(eventDate, eventEndTime),
          location: eventLocation || undefined,
          locationUrl: suggestion.suggestedEvent?.locationUrl,
          attendeeIds: eventAttendees.map(u => u.id),
          type: eventType,
          projectId: eventProjectId || undefined,
        }
      : undefined;

    const editedTodo: BrainExtractedTodo | undefined = includeTodo
      ? {
          title: todoTitle,
          assigneeNames: todoAssignees.map(u => u.name),
          assigneeIds: todoAssignees.map(u => u.id),
          dueDate: todoDueDate
            ? new Date(`${todoDueDate}T23:59:59`).toISOString()
            : new Date(Date.now() + 86400000).toISOString(),
          priority: todoPriority,
          projectId: todoProjectId || undefined,
        }
      : undefined;

    try {
      await confirmEmailSuggestionWithEdits(suggestion.id, {
        event: editedEvent,
        todo: editedTodo,
        note: includeNote ? noteContent : undefined,
        includeEvent,
        includeTodo,
        includeNote,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('[SuggestionReviewDialog] Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Find email for subject display ────────
  const email = suggestion
    ? gmailMessages.find(m => m.id === suggestion.emailId)
    : null;

  const canSubmit = !isSubmitting && (includeEvent || includeTodo || includeNote);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Brain className="w-4 h-4 text-primary" />
            {t('brainReviewTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground truncate">
            {email?.subject || ''}
          </DialogDescription>
        </DialogHeader>

        {suggestion && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-md bg-muted/30 p-2.5 text-xs text-foreground/80">
              <span className="font-medium text-primary">{t('brainSummary')}: </span>
              {suggestion.summary}
            </div>

            {/* ───── Event Section ───── */}
            {suggestion.suggestedEvent && (
              <section className="space-y-2.5 rounded-lg border border-border/50 p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-event"
                    checked={includeEvent}
                    onCheckedChange={(v) => setIncludeEvent(!!v)}
                  />
                  <label htmlFor="include-event" className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    {t('brainCreateEvent')}
                  </label>
                </div>

                {includeEvent && (
                  <div className="space-y-2 pl-6">
                    {/* Title */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{t('brainFieldTitle')}</Label>
                      <Input
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Date + Start + End */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{t('brainFieldDate')}</Label>
                        <Input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{t('brainFieldStartTime')}</Label>
                        <Input
                          type="time"
                          value={eventStartTime}
                          onChange={(e) => setEventStartTime(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{t('brainFieldEndTime')}</Label>
                        <Input
                          type="time"
                          value={eventEndTime}
                          onChange={(e) => setEventEndTime(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    {/* Location */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{t('brainFieldLocation')}</Label>
                      <Input
                        value={eventLocation}
                        onChange={(e) => setEventLocation(e.target.value)}
                        className="h-8 text-xs"
                        placeholder={t('brainFieldLocationPlaceholder')}
                      />
                    </div>

                    {/* Type + Project (side by side) */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{t('brainFieldType')}</Label>
                        <Select value={eventType} onValueChange={(v) => setEventType(v as BrainExtractedEvent['type'])}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEETING">{t('meeting')}</SelectItem>
                            <SelectItem value="TASK">{t('task')}</SelectItem>
                            <SelectItem value="DEADLINE">{t('deadline')}</SelectItem>
                            <SelectItem value="DELIVERY">{t('delivery')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{t('brainFieldProject')}</Label>
                        <Select value={eventProjectId || '__none__'} onValueChange={(v) => setEventProjectId(v === '__none__' ? '' : v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder={t('brainFieldProjectNone')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{t('brainFieldProjectNone')}</SelectItem>
                            {activeProjects.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Attendees */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{t('brainFieldAttendees')}</Label>
                      <UserSearchInput
                        users={users}
                        selectedUsers={eventAttendees}
                        onSelect={(user) => setEventAttendees(prev => [...prev, user])}
                        onRemove={(userId) => setEventAttendees(prev => prev.filter(u => u.id !== userId))}
                        placeholder={t('brainFieldSearchUser')}
                        multiple
                      />
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ───── Todo Section ───── */}
            {suggestion.suggestedTodo && (
              <section className="space-y-2.5 rounded-lg border border-border/50 p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-todo"
                    checked={includeTodo}
                    onCheckedChange={(v) => setIncludeTodo(!!v)}
                  />
                  <label htmlFor="include-todo" className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <CheckSquare className="w-3.5 h-3.5 text-green-500" />
                    {t('brainCreateTodo')}
                  </label>
                </div>

                {includeTodo && (
                  <div className="space-y-2 pl-6">
                    {/* Title */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{t('brainFieldTitle')}</Label>
                      <Input
                        value={todoTitle}
                        onChange={(e) => setTodoTitle(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Due Date + Priority */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{t('brainFieldDueDate')}</Label>
                        <Input
                          type="date"
                          value={todoDueDate}
                          onChange={(e) => setTodoDueDate(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{t('brainFieldPriority')}</Label>
                        <Select value={todoPriority} onValueChange={(v) => setTodoPriority(v as 'LOW' | 'MEDIUM' | 'HIGH')}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOW">{t('brainPriorityLow')}</SelectItem>
                            <SelectItem value="MEDIUM">{t('brainPriorityMedium')}</SelectItem>
                            <SelectItem value="HIGH">{t('brainPriorityHigh')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Project */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{t('brainFieldProject')}</Label>
                      <Select value={todoProjectId || '__none__'} onValueChange={(v) => setTodoProjectId(v === '__none__' ? '' : v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={t('brainFieldProjectNone')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('brainFieldProjectNone')}</SelectItem>
                          {activeProjects.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Assignees */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{t('brainFieldAssignees')}</Label>
                      <UserSearchInput
                        users={users}
                        selectedUsers={todoAssignees}
                        onSelect={(user) => setTodoAssignees(prev => [...prev, user])}
                        onRemove={(userId) => setTodoAssignees(prev => prev.filter(u => u.id !== userId))}
                        placeholder={t('brainFieldSearchUser')}
                        multiple
                      />
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ───── Note Section ───── */}
            {suggestion.suggestedNote && (
              <section className="space-y-2.5 rounded-lg border border-border/50 p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-note"
                    checked={includeNote}
                    onCheckedChange={(v) => setIncludeNote(!!v)}
                  />
                  <label htmlFor="include-note" className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <FileText className="w-3.5 h-3.5 text-violet-500" />
                    {t('brainCreateNote')}
                  </label>
                </div>

                {includeNote && (
                  <div className="pl-6">
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                      placeholder={t('brainFieldNotePlaceholder')}
                    />
                  </div>
                )}
              </section>
            )}

            {/* Empty state — no suggestions at all */}
            {!suggestion.suggestedEvent && !suggestion.suggestedTodo && !suggestion.suggestedNote && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                {t('brainNoSuggestions')}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Sparkles className="w-4 h-4 mr-1" />
            )}
            {isSubmitting ? t('brainApplying') : t('brainApply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
