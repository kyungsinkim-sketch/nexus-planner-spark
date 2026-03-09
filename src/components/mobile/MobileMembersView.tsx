import { useState, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Search, MessageCircle, Phone, Video, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { createCall } from '@/services/callService';
import type { User } from '@/types/core';

export function MobileMembersView() {
  const { users, projects, events, boardTasks, currentUser } = useAppStore();
  const { t, language } = useTranslation();
  const locale = language === 'ko' ? ko : enUS;

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

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

  const handleChat = () => {
    toast.info('Coming soon');
  };

  const handleVoiceCall = (user: User) => {
    createCall(user.id, undefined, undefined, false);
  };

  const handleVideoCall = (user: User) => {
    createCall(user.id, undefined, undefined, true);
  };

  // ─── Detail View ─────────────────────────────────────────
  if (selectedUser) {
    const today = new Date();
    const startDay = getDay(startOfMonth(calendarMonth)); // 0=Sun

    return (
      <div className="flex flex-col h-full widget-area-bg">
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

        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {/* Profile */}
          <div className="flex flex-col items-center gap-2 mt-2 mb-6">
            <Avatar className="w-20 h-20">
              <AvatarImage src={selectedUser.avatar} />
              <AvatarFallback className="text-2xl">{selectedUser.name[0]}</AvatarFallback>
            </Avatar>
            <h3 className="typo-h3 font-bold">{selectedUser.name}</h3>
            <span className="typo-widget-sub text-muted-foreground">
              {selectedUser.department ?? ''} {selectedUser.role ? `· ${selectedUser.role}` : ''}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-3 mb-8">
            {[
              { icon: MessageCircle, label: 'Chat', action: handleChat },
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
          <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-4">
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
                return (
                  <div key={dateStr} className="flex flex-col items-center py-0.5">
                    <span
                      className={cn(
                        'w-7 h-7 flex items-center justify-center rounded-full text-xs',
                        isToday && 'bg-primary text-primary-foreground font-bold',
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {hasActivity && (
                      <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── List View ───────────────────────────────────────────
  return (
    <div className="flex flex-col h-full widget-area-bg">
      {/* Header */}
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
          className="w-full rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          autoFocus={showSearch}
        />
      </div>

      {/* Project filter chips */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
        <button
          onClick={() => setFilterProjectId(null)}
          className={cn(
            'flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
            !filterProjectId
              ? 'bg-primary text-primary-foreground'
              : 'border border-white/20 dark:border-white/10 text-muted-foreground',
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
                : 'border border-white/20 dark:border-white/10 text-muted-foreground',
            )}
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* 2-column grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="grid grid-cols-2 gap-3">
          {filteredUsers.map(user => (
            <button
              key={user.id}
              onClick={() => setSelectedUserId(user.id)}
              className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-4 flex flex-col items-start gap-2 active:scale-[0.98] transition-transform text-left min-h-[140px]"
            >
              <Avatar className="w-12 h-12">
                <AvatarImage src={user.avatar} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">{user.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="typo-widget-body font-bold leading-tight line-clamp-1">{user.name}</p>
                <p className="typo-caption text-muted-foreground leading-tight line-clamp-2 mt-0.5">
                  {[user.department, user.role].filter(Boolean).join(' · ') || ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MobileMembersView;
