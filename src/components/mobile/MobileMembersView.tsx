import { useState, useMemo, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Search, MessageCircle, Phone, Video, ChevronLeft, ChevronRight, Clock, CheckSquare, Hash } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, addDays, eachDayOfInterval, getDay, isSameDay, isBefore, isAfter, addMonths, subMonths } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { createCall } from '@/services/callService';
import { useWidgetStore } from '@/stores/widgetStore';
import type { User } from '@/types/core';

function formatUserInfo(user: User, _language: string): { position: string; team: string } {
  return {
    position: user.position || '',
    team: user.team || '',
  };
}

export function MobileMembersView() {
  const { users, projects, events, boardTasks, boardGroups, currentUser, getGroupRooms } = useAppStore();
  const { openMobileDm, setMobileView } = useWidgetStore();
  const { t, language } = useTranslation();
  const locale = language === 'ko' ? ko : enUS;

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Filter users by project & search
  const filteredUsers = useMemo(() => {
    let result = users;
    if (filterProjectId) {
      const project = projects.find(p => p.id === filterProjectId);
      if (project?.teamMemberIds) {
        const ids = new Set(project.teamMemberIds);
        result = result.filter(u => ids.has(u.id));
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(u => u.name.toLowerCase().includes(q));
    }
    return result;
  }, [users, projects, filterProjectId, searchQuery]);

  const selectedUser = useMemo(
    () => (selectedUserId ? users.find(u => u.id === selectedUserId) ?? null : null),
    [selectedUserId, users],
  );

  // Sorted users for swipe navigation (가나다순)
  const sortedUsers = useMemo(() => [...users].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [users]);

  // Swipe gesture for member navigation
  const memberTouchStartX = useRef<number | null>(null);
  const handleMemberTouchStart = useCallback((e: React.TouchEvent) => {
    memberTouchStartX.current = e.touches[0].clientX;
  }, []);
  const handleMemberTouchEnd = useCallback((e: React.TouchEvent) => {
    if (memberTouchStartX.current === null || !selectedUserId) return;
    const diff = e.changedTouches[0].clientX - memberTouchStartX.current;
    memberTouchStartX.current = null;
    if (Math.abs(diff) < 60) return;
    const idx = sortedUsers.findIndex(u => u.id === selectedUserId);
    if (idx === -1) return;
    if (diff > 0 && idx > 0) {
      // Swipe right → previous member
      setSelectedUserId(sortedUsers[idx - 1].id);
    } else if (diff < 0 && idx < sortedUsers.length - 1) {
      // Swipe left → next member
      setSelectedUserId(sortedUsers[idx + 1].id);
    }
  }, [selectedUserId, sortedUsers]);

  // Events & tasks for selected user
  const userEvents = useMemo(() => {
    if (!selectedUser) return [];
    return events.filter(
      e => e.ownerId === selectedUser.id || e.attendeeIds?.includes(selectedUser.id),
    );
  }, [events, selectedUser]);

  const userTasks = useMemo(() => {
    if (!selectedUser) return [];
    return boardTasks.filter(t => t.ownerId === selectedUser.id);
  }, [boardTasks, selectedUser]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  const daysWithActivity = useMemo(() => {
    const dates = new Set<string>();
    for (const ev of userEvents) {
      dates.add(ev.startAt.slice(0, 10));
    }
    for (const task of userTasks) {
      if (task.dueDate) dates.add(task.dueDate.slice(0, 10));
      if (task.startDate) dates.add(task.startDate.slice(0, 10));
    }
    return dates;
  }, [userEvents, userTasks]);

  const handleChat = (user: User) => {
    openMobileDm(user.id);
  };

  const handleVoiceCall = (user: User) => {
    createCall(user.id, undefined, undefined, false);
  };

  const handleVideoCall = (user: User) => {
    createCall(user.id, undefined, undefined, true);
  };

  // Events & tasks for selected day
  const selectedDayEvents = useMemo(() => {
    if (!selectedDay || !selectedUser) return [];
    return userEvents.filter(e => {
      try { return e.startAt.slice(0, 10) === selectedDay; } catch { return false; }
    });
  }, [selectedDay, userEvents, selectedUser]);

  const selectedDayTasks = useMemo(() => {
    if (!selectedDay || !selectedUser) return [];
    return userTasks.filter(t => {
      if (t.dueDate?.slice(0, 10) === selectedDay) return true;
      if (t.startDate?.slice(0, 10) === selectedDay) return true;
      return false;
    });
  }, [selectedDay, userTasks, selectedUser]);

  // ─── Detail View ─────────────────────────────────────────
  if (selectedUser) {
    const today = new Date();
    const startDay = getDay(startOfMonth(calendarMonth)); // 0=Sun

    return (
      <div
        className="flex flex-col h-full widget-area-bg overflow-y-auto"
        onTouchStart={handleMemberTouchStart}
        onTouchEnd={handleMemberTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <button
            onClick={() => setSelectedUserId(null)}
            className="p-2 -ml-2 rounded-lg bg-white/40 dark:bg-white/10 hover:bg-white/60 dark:hover:bg-white/15 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <span className="typo-h4 font-semibold text-foreground">
            {language === 'ko' ? '멤버 상세' : 'Member Detail'}
          </span>
        </div>

        <div className="px-4 pb-8">
          {/* Profile */}
          <div className="flex flex-col items-center gap-2 mt-2 mb-6">
            <Avatar className="w-20 h-20">
              <AvatarImage src={selectedUser.avatar} />
              <AvatarFallback className="text-2xl">{selectedUser.name[0]}</AvatarFallback>
            </Avatar>
            <h3 className="typo-h3 font-bold">{selectedUser.name}</h3>
            {(() => { const info = formatUserInfo(selectedUser, language); return (<>
              {info.position && <span className="typo-widget-sub text-muted-foreground">{info.position}</span>}
              {info.team && <span className="typo-micro text-muted-foreground/70">{info.team}</span>}
            </>); })()}
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-3 mb-8">
            {[
              { icon: MessageCircle, label: 'Chat', action: () => handleChat(selectedUser) },
              { icon: Phone, label: language === 'ko' ? '음성' : 'Call', action: () => handleVoiceCall(selectedUser) },
              { icon: Video, label: 'Video', action: () => handleVideoCall(selectedUser) },
            ].map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                onClick={action}
                className="flex items-center gap-2 bg-primary dark:bg-primary text-primary-foreground rounded-full px-6 py-3 active:scale-[0.97] transition-transform"
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Tasks Schedule / Mini Calendar */}
          <div className="mobile-glass rounded-2xl p-4">
            <h4 className="typo-label font-semibold text-foreground mb-3">
              {language === 'ko' ? '일정 & 업무' : 'Tasks Schedule'}
            </h4>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setCalendarMonth(m => subMonths(m, 1))} className="p-1 rounded-full active:bg-black/5 dark:active:bg-white/10">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold">
                {format(calendarMonth, 'MMMM yyyy', { locale })}
              </span>
              <button onClick={() => setCalendarMonth(m => addMonths(m, 1))} className="p-1 rounded-full active:bg-black/5 dark:active:bg-white/10">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground mb-1">
              {(language === 'ko'
                ? ['일', '월', '화', '수', '목', '금', '토']
                : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
              ).map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 text-center text-xs gap-y-1">
              {/* Empty leading cells */}
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {calendarDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isToday = isSameDay(day, today);
                const hasActivity = daysWithActivity.has(dateStr);
                const isSelected = selectedDay === dateStr;
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    className="flex flex-col items-center py-0.5"
                  >
                    <span
                      className={cn(
                        'w-7 h-7 flex items-center justify-center rounded-full text-xs transition-colors',
                        isSelected && 'bg-primary text-primary-foreground font-bold',
                        !isSelected && isToday && 'bg-primary/20 text-primary font-bold',
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {hasActivity && (
                      <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day events & tasks */}
          {selectedDay && (selectedDayEvents.length > 0 || selectedDayTasks.length > 0) && (
            <div className="mt-4 space-y-3">
              <h4 className="typo-label font-semibold text-foreground">
                {format(new Date(selectedDay + 'T00:00:00'), language === 'ko' ? 'M월 d일' : 'MMM d', { locale })}
              </h4>

              {selectedDayEvents.map(ev => (
                <div key={ev.id} className="mobile-glass rounded-xl p-3 flex items-start gap-3">
                  <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="typo-widget-body font-medium text-foreground line-clamp-1">{ev.title}</p>
                    <p className="typo-micro text-muted-foreground mt-0.5">
                      {format(parseISO(ev.startAt), 'HH:mm')} – {format(parseISO(ev.endAt), 'HH:mm')}
                    </p>
                  </div>
                </div>
              ))}

              {selectedDayTasks.map(task => (
                <div key={task.id} className="mobile-glass rounded-xl p-3 flex items-start gap-3">
                  <CheckSquare className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="typo-widget-body font-medium text-foreground line-clamp-1">{task.title}</p>
                    <p className="typo-micro text-muted-foreground mt-0.5">{task.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedDay && selectedDayEvents.length === 0 && selectedDayTasks.length === 0 && (
            <p className="mt-4 typo-caption text-muted-foreground text-center">
              {language === 'ko' ? '이 날에는 일정이 없어요' : 'No events for this day'}
            </p>
          )}

          {/* ── Weekly Gantt Chart (board tasks with dates) ── */}
          {(() => {
            // Only show tasks that have start/end dates (actual Gantt items)
            const memberTasks = boardTasks.filter(
              t => t.ownerId === selectedUser?.id && t.startDate && t.endDate && t.status !== 'done'
            );
            if (memberTasks.length === 0) return null;

            const groupMap = new Map(boardGroups.map(g => [g.id, g]));
            const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
            const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

            return (
              <div className="mobile-glass rounded-2xl p-4 mt-4">
                <h4 className="typo-label font-semibold text-foreground mb-3">
                  {language === 'ko' ? '주간 업무' : 'Weekly Tasks'}
                </h4>

                {/* Week day headers */}
                <div className="grid grid-cols-[100px_repeat(7,1fr)] gap-0.5 mb-2">
                  <div />
                  {weekDays.map(day => (
                    <div key={day.toISOString()} className="text-center">
                      <span className={cn(
                        'text-[9px] font-medium',
                        isSameDay(day, new Date()) ? 'text-primary font-bold' : 'text-muted-foreground'
                      )}>
                        {format(day, 'EEE', { locale })}
                      </span>
                      <br />
                      <span className={cn(
                        'text-[10px]',
                        isSameDay(day, new Date()) ? 'text-primary font-bold' : 'text-muted-foreground/70'
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Task bars */}
                <div className="space-y-1.5">
                  {memberTasks.slice(0, 8).map(task => {
                    const taskStart = parseISO(task.startDate!);
                    const taskEnd = parseISO(task.endDate!);
                    const group = groupMap.get(task.boardGroupId);
                    const project = projects.find(p => p.id === task.projectId);
                    const barColor = group?.color || project?.keyColor || 'hsl(var(--primary))';

                    return (
                      <div key={task.id} className="grid grid-cols-[100px_repeat(7,1fr)] gap-0.5 items-center min-h-[32px]">
                        <div className="truncate pr-1" title={`${project?.title || ''} — ${task.title}`}>
                          <span className="text-[9px] text-muted-foreground truncate block leading-tight">{project?.title || ''}</span>
                          <span className="text-[10px] font-medium text-foreground truncate block leading-tight">{task.title}</span>
                        </div>
                        {weekDays.map(day => {
                          const inRange = !isBefore(day, taskStart) && !isAfter(day, taskEnd);
                          return (
                            <div key={day.toISOString()} className="h-5 flex items-center justify-center">
                              {inRange ? (
                                <div
                                  className="w-full h-3 rounded-sm"
                                  style={{ backgroundColor: barColor, opacity: 0.7 }}
                                />
                              ) : (
                                <div className="w-full h-3 rounded-sm bg-muted/30" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {memberTasks.length > 8 && (
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    +{memberTasks.length - 8} {language === 'ko' ? '개 더' : 'more'}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // ─── List View ───────────────────────────────────────────
  return (
    <div className="h-full widget-area-bg overflow-y-auto">
      {/* Header + filters — sticky with matching background */}
      <div className="sticky top-0 z-10 backdrop-blur-xl pt-1" style={{ WebkitBackdropFilter: 'blur(20px)' }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="typo-h2">Members</h2>
        <button
          onClick={() => { setShowSearch(s => !s); setSearchQuery(''); }}
          className="p-2 rounded-full active:bg-black/5 dark:active:bg-white/10"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* Search bar (animated) */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 px-4',
          showSearch ? 'max-h-12 opacity-100 mb-2' : 'max-h-0 opacity-0',
        )}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={language === 'ko' ? '이름 검색...' : 'Search name...'}
          className="w-full rounded-xl mobile-glass px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          autoFocus={showSearch}
        />
      </div>

      {/* Project filter + Group chips — single row */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide items-center">
        {/* Project filters (left) */}
        <button
          onClick={() => setFilterProjectId(null)}
          className={cn(
            'flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
            !filterProjectId
              ? 'bg-primary text-primary-foreground'
              : 'mobile-glass text-muted-foreground',
          )}
        >
          All
        </button>
        {projects.map(p => (
          <button
            key={p.id}
            onClick={() => setFilterProjectId(prev => (prev === p.id ? null : p.id))}
            className={cn(
              'flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
              filterProjectId === p.id
                ? 'bg-primary text-primary-foreground'
                : 'mobile-glass text-muted-foreground',
            )}
          >
            {p.title}
          </button>
        ))}

        {/* Spacer */}
        {getGroupRooms().length > 0 && <div className="flex-1 min-w-2" />}

        {/* Group chips (right) */}
        {getGroupRooms().map(room => (
          <button
            key={room.id}
            onClick={() => setMobileView('dm-chat')}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium mobile-glass text-muted-foreground active:scale-[0.97] transition-all whitespace-nowrap"
          >
            <Hash className="w-3 h-3" />
            {room.name || 'Group'}
          </button>
        ))}
      </div>

      </div>{/* end sticky header */}

      {/* 2-column grid */}
      <div className="px-4 pb-24">
        <div className="grid grid-cols-2 gap-3">
          {filteredUsers.map(user => (
            <button
              key={user.id}
              onClick={() => setSelectedUserId(user.id)}
              className="mobile-glass rounded-2xl p-4 flex flex-col items-start gap-2 active:scale-[0.98] transition-transform text-left min-h-[140px]"
            >
              <Avatar className="w-12 h-12">
                <AvatarImage src={user.avatar} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">{user.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="typo-widget-body font-bold leading-tight line-clamp-1">{user.name}</p>
                {(() => { const info = formatUserInfo(user, language); return (<>
                  {info.position && <p className="typo-caption text-muted-foreground leading-tight line-clamp-1 mt-0.5">{info.position}</p>}
                  {info.team && <p className="typo-micro text-muted-foreground/70 leading-tight line-clamp-1">{info.team}</p>}
                </>); })()}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MobileMembersView;
