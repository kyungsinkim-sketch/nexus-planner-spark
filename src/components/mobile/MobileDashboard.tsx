/**
 * MobileDashboard — 모바일 전용 대시보드
 * 카드 기반, 드래그 없음. 핵심 정보만 축약 표시.
 *
 * 구조:
 * - 오늘의 일정 카드 (최대 3건)
 * - 알림 요약 카드
 * - 프로젝트 목록 (카드 형태)
 * - 근태 상태 빠른 변경
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Calendar,
  Bell,
  ChevronRight,
  Clock,
  FolderKanban,
} from 'lucide-react';
import { format, isToday, parseISO, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

export function MobileDashboard() {
  const {
    currentUser,
    projects,
    events,
    companyNotifications,
    dismissedNotificationIds,
  } = useAppStore();
  const { openProjectTab, setActiveTab } = useWidgetStore();
  const { t, language } = useTranslation();

  const locale = language === 'ko' ? ko : enUS;

  // Today's events
  const todayEvents = useMemo(() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    return events
      .filter(e => {
        try {
          const start = parseISO(e.startAt);
          return !isBefore(start, dayStart) && !isAfter(start, dayEnd);
        } catch { return false; }
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 4);
  }, [events]);

  // Active notifications count
  const activeNotifications = useMemo(() => {
    return companyNotifications.filter(n => !dismissedNotificationIds.includes(n.id));
  }, [companyNotifications, dismissedNotificationIds]);

  // Active projects (IN_PROGRESS)
  const activeProjects = useMemo(() => {
    return projects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'PLANNING');
  }, [projects]);

  const handleProjectClick = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    openProjectTab(projectId, project.title, project.keyColor);
    setActiveTab(projectId);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="p-4 space-y-4 pb-6">

        {/* Today's Schedule Card */}
        <section className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">
                {language === 'ko' ? '오늘의 일정' : "Today's Schedule"}
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {format(new Date(), language === 'ko' ? 'M월 d일 EEEE' : 'EEE, MMM d', { locale })}
            </span>
          </div>

          {todayEvents.length === 0 ? (
            <div className="px-4 pb-4 text-sm text-muted-foreground/60">
              {language === 'ko' ? '오늘 일정이 없습니다' : 'No events today'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {todayEvents.map(event => {
                const project = projects.find(p => p.id === event.projectId);
                return (
                  <div key={event.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex flex-col items-center w-12 shrink-0">
                      <span className="text-xs font-medium text-primary">
                        {format(parseISO(event.startAt), 'HH:mm')}
                      </span>
                    </div>
                    <div
                      className="w-0.5 h-8 rounded-full shrink-0"
                      style={{ backgroundColor: project?.keyColor || 'hsl(var(--primary))' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      {project && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {project.title}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Notifications Card */}
        {activeNotifications.length > 0 && (
          <section className="bg-card rounded-2xl border shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold flex-1">
                {t('notifications')}
              </h2>
              <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                {activeNotifications.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {activeNotifications[0]?.title || activeNotifications[0]?.content}
            </p>
          </section>
        )}

        {/* Projects List */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <FolderKanban className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold flex-1">
              {t('projects')}
            </h2>
            <span className="text-xs text-muted-foreground">
              {activeProjects.length}{language === 'ko' ? '개 진행 중' : ' active'}
            </span>
          </div>

          <div className="space-y-2">
            {activeProjects.map(project => {
              // Count today's events for this project
              const projectTodayEvents = todayEvents.filter(e => e.projectId === project.id).length;

              return (
                <button
                  key={project.id}
                  onClick={() => handleProjectClick(project.id)}
                  className="w-full bg-card rounded-2xl border shadow-sm p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
                >
                  {/* Color dot or thumbnail */}
                  {project.thumbnail ? (
                    <div
                      className="w-10 h-10 rounded-xl shrink-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${project.thumbnail})` }}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: project.keyColor || 'hsl(var(--primary))' }}
                    >
                      {project.title.charAt(0)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{project.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        project.status === 'IN_PROGRESS'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {project.status === 'IN_PROGRESS'
                          ? (language === 'ko' ? '진행 중' : 'In Progress')
                          : (language === 'ko' ? '기획' : 'Planning')}
                      </span>
                      {projectTodayEvents > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {projectTodayEvents}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default MobileDashboard;
