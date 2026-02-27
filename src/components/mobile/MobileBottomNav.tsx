/**
 * MobileBottomNav — 코스모스 하단 네비게이션
 *
 * 5개 탭: 홈, 별자리(관계), 캘린더, 이메일, 더보기
 * Liquid Glass 스타일 + 금색 아이콘
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Sparkles,
  Stars,
  Calendar,
  Mail,
  MoreHorizontal,
  Settings,
  Crown,
  Languages,
  LogOut,
  FolderKanban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mobileView, setMobileView } = useWidgetStore();
  const { currentUser, signOut } = useAppStore();
  const { t, language, toggleLanguage } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
  const isSubRoute = location.pathname !== '/';

  const isHomeActive = !isSubRoute && mobileView === 'home';
  const isConstellationActive = !isSubRoute && mobileView === 'constellation';
  const isCalendarActive = !isSubRoute && mobileView === 'calendar';
  const isEmailActive = !isSubRoute && mobileView === 'email';

  const handleNav = (view: 'home' | 'constellation' | 'calendar' | 'email') => {
    setMobileView(view);
    if (isSubRoute) navigate('/');
  };

  const tabs = [
    { id: 'home' as const, icon: Sparkles, labelKo: '홈', labelEn: 'Home', active: isHomeActive },
    { id: 'constellation' as const, icon: Stars, labelKo: '관계', labelEn: 'People', active: isConstellationActive },
    { id: 'calendar' as const, icon: Calendar, labelKo: '캘린더', labelEn: 'Calendar', active: isCalendarActive },
    { id: 'email' as const, icon: Mail, labelKo: '이메일', labelEn: 'Email', active: isEmailActive },
  ];

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'hsla(240, 10%, 4%, 0.85)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderTop: '1px solid hsla(43, 74%, 55%, 0.08)',
      }}
    >
      <div className="flex items-center justify-around px-1 py-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleNav(tab.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl transition-all duration-300 min-w-0 flex-1',
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'w-5 h-5 transition-colors duration-300',
                    tab.active
                      ? 'text-[hsl(43,74%,55%)]'
                      : 'text-[hsl(45,10%,40%)]'
                  )}
                />
                {tab.active && (
                  <div
                    className="absolute -inset-1 rounded-full -z-10"
                    style={{
                      background: 'radial-gradient(circle, hsla(43, 74%, 55%, 0.15) 0%, transparent 70%)',
                    }}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-[9px] font-medium truncate transition-colors duration-300',
                  tab.active
                    ? 'text-[hsl(43,74%,55%)]'
                    : 'text-[hsl(45,10%,40%)]'
                )}
              >
                {language === 'ko' ? tab.labelKo : tab.labelEn}
              </span>
            </button>
          );
        })}

        {/* More (Sheet) */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl transition-colors min-w-0 flex-1">
              <MoreHorizontal className="w-5 h-5 text-[hsl(45,10%,40%)]" />
              <span className="text-[9px] font-medium truncate text-[hsl(45,10%,40%)]">
                {language === 'ko' ? '더보기' : 'More'}
              </span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl max-h-[70vh]"
            style={{
              background: 'hsla(240, 10%, 6%, 0.95)',
              backdropFilter: 'blur(24px)',
              borderColor: 'hsla(43, 74%, 55%, 0.1)',
            }}
          >
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback
                    className="text-sm font-bold"
                    style={{
                      background: 'linear-gradient(135deg, hsl(43, 74%, 55%), hsla(43, 85%, 70%, 0.8))',
                      color: '#1a1a1a',
                    }}
                  >
                    {currentUser?.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle className="text-left text-sm text-[hsl(var(--foreground))]">{currentUser?.name}</SheetTitle>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{currentUser?.role}</p>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-1 pb-6">
              {isAdmin && (
                <button
                  onClick={() => { navigate('/admin'); setMoreOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <Crown className="w-5 h-5 text-[hsl(43,74%,55%)]" />
                  <span className="text-sm font-medium">{t('admin')}</span>
                </button>
              )}

              {/* Projects shortcut */}
              <button
                onClick={() => { setMobileView('projects'); setMoreOpen(false); if (isSubRoute) navigate('/'); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                <FolderKanban className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                <span className="text-sm font-medium">{language === 'ko' ? '프로젝트' : 'Projects'}</span>
              </button>

              <button
                onClick={() => { navigate('/settings'); setMoreOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                <Settings className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                <span className="text-sm font-medium">{t('settings')}</span>
              </button>

              <Separator className="bg-white/5" />

              <button
                onClick={toggleLanguage}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Languages className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-sm">{language === 'ko' ? '한국어' : 'English'}</span>
                </div>
                <span className="text-xs text-[hsl(var(--muted-foreground))] font-bold">
                  {language === 'ko' ? 'EN' : 'KO'}
                </span>
              </button>

              <Separator className="bg-white/5" />

              <button
                onClick={async () => {
                  try {
                    await signOut();
                    setMoreOpen(false);
                    toast.success(t('loggedOut'));
                  } catch (error: unknown) {
                    toast.error(error instanceof Error ? error.message : 'Failed');
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-destructive/10 transition-colors text-destructive"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">{t('logOut')}</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

export default MobileBottomNav;
