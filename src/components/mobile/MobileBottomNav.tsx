/**
 * MobileBottomNav — Vercel-inspired minimal bottom nav
 *
 * 5탭: 홈, 관계, 캘린더, 이메일, 더보기
 * 흑백 모노크롬, 활성 탭만 white
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Sparkles,
  Users,
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

  const tabs = [
    { id: 'home' as const, icon: Sparkles, labelKo: '홈', labelEn: 'Home' },
    { id: 'constellation' as const, icon: Users, labelKo: '관계', labelEn: 'People' },
    { id: 'calendar' as const, icon: Calendar, labelKo: '캘린더', labelEn: 'Calendar' },
    { id: 'email' as const, icon: Mail, labelKo: '이메일', labelEn: 'Email' },
  ];

  const handleNav = (view: 'home' | 'constellation' | 'calendar' | 'email') => {
    setMobileView(view);
    if (isSubRoute) navigate('/');
  };

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div className="flex items-center justify-around px-1 py-1.5">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = !isSubRoute && mobileView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleNav(tab.id)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg min-w-0 flex-1"
            >
              <Icon
                className={cn('w-[18px] h-[18px] transition-colors',
                  active ? 'text-white' : 'text-white/25'
                )}
                strokeWidth={active ? 2 : 1.5}
              />
              <span className={cn(
                'text-[9px] font-medium transition-colors',
                active ? 'text-white' : 'text-white/25'
              )}>
                {language === 'ko' ? tab.labelKo : tab.labelEn}
              </span>
            </button>
          );
        })}

        {/* More */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg min-w-0 flex-1">
              <MoreHorizontal className="w-[18px] h-[18px] text-white/25" strokeWidth={1.5} />
              <span className="text-[9px] font-medium text-white/25">
                {language === 'ko' ? '더보기' : 'More'}
              </span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl max-h-[70vh] border-t border-white/[0.06]"
            style={{ background: 'rgb(10, 10, 10)' }}
          >
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-white text-black text-sm font-semibold">
                    {currentUser?.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle className="text-left text-sm text-white">{currentUser?.name}</SheetTitle>
                  <p className="text-[11px] text-white/30">{currentUser?.role}</p>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-0.5 pb-6">
              {isAdmin && (
                <button
                  onClick={() => { navigate('/admin'); setMoreOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  <Crown className="w-4 h-4 text-white/40" />
                  <span className="text-[13px] text-white/80">{t('admin')}</span>
                </button>
              )}

              <button
                onClick={() => { setMobileView('projects'); setMoreOpen(false); if (isSubRoute) navigate('/'); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <FolderKanban className="w-4 h-4 text-white/40" />
                <span className="text-[13px] text-white/80">{language === 'ko' ? '프로젝트' : 'Projects'}</span>
              </button>

              <button
                onClick={() => { navigate('/settings'); setMoreOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <Settings className="w-4 h-4 text-white/40" />
                <span className="text-[13px] text-white/80">{t('settings')}</span>
              </button>

              <Separator className="bg-white/[0.06] my-2" />

              <button
                onClick={toggleLanguage}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Languages className="w-4 h-4 text-white/40" />
                  <span className="text-[13px] text-white/80">{language === 'ko' ? '한국어' : 'English'}</span>
                </div>
                <span className="text-[11px] text-white/30 font-mono">{language === 'ko' ? 'EN' : 'KO'}</span>
              </button>

              <Separator className="bg-white/[0.06] my-2" />

              <button
                onClick={async () => {
                  try { await signOut(); setMoreOpen(false); toast.success(t('loggedOut')); }
                  catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-500/5 transition-colors"
              >
                <LogOut className="w-4 h-4 text-red-400/60" />
                <span className="text-[13px] text-red-400/80">{t('logOut')}</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

export default MobileBottomNav;
