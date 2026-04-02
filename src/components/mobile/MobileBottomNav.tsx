/**
 * MobileBottomNav — Phase 3 redesign
 * 4 tabs + user avatar with bubble popup menu
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWidgetStore, type MobileView } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sparkles, FolderKanban, MessageSquare, Calendar, Sun, Moon, Languages, Settings } from 'lucide-react';

const tabs: { id: MobileView; icon: typeof Sparkles; labelKo: string; labelEn: string }[] = [
  { id: 'ai-chat', icon: Sparkles, labelKo: 'Be.Ark', labelEn: 'Be.Ark' },
  { id: 'projects', icon: FolderKanban, labelKo: '프로젝트', labelEn: 'Projects' },
  { id: 'chat-list', icon: MessageSquare, labelKo: '채팅', labelEn: 'Chat' },
  { id: 'calendar', icon: Calendar, labelKo: '캘린더', labelEn: 'Calendar' },
];

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mobileView, setMobileView } = useWidgetStore();
  const { currentUser, theme, setTheme } = useAppStore();
  const { language, toggleLanguage } = useTranslation();
  const [popupOpen, setPopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);

  const isSubRoute = location.pathname !== '/';
  const isDark = theme === 'dark';

  // Close popup on outside click
  useEffect(() => {
    if (!popupOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        avatarRef.current && !avatarRef.current.contains(e.target as Node)
      ) {
        setPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popupOpen]);

  const handleNav = (view: MobileView) => {
    setMobileView(view);
    if (isSubRoute) navigate('/');
  };

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 mobile-bottom-nav-wrapper"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Popup menu */}
      {popupOpen && (
        <div
          ref={popupRef}
          className="absolute right-3 bottom-[62px] rounded-2xl p-1.5 min-w-[180px] shadow-xl border z-[60]"
          style={{
            background: isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          }}
        >
          {/* Day/Night toggle */}
          <button
            onClick={() => { setTheme(isDark ? 'light' : 'dark'); setPopupOpen(false); }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
              isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-black/[0.04]'
            )}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
            <span className={cn('text-[13px] font-medium', isDark ? 'text-white/80' : 'text-black/70')}>
              {isDark ? (language === 'ko' ? '라이트 모드' : 'Light Mode') : (language === 'ko' ? '다크 모드' : 'Dark Mode')}
            </span>
          </button>

          {/* Language toggle */}
          <button
            onClick={() => { toggleLanguage(); setPopupOpen(false); }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
              isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-black/[0.04]'
            )}
          >
            <Languages className="w-4 h-4" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }} />
            <span className={cn('text-[13px] font-medium', isDark ? 'text-white/80' : 'text-black/70')}>
              {language === 'ko' ? '한국어 → English' : 'English → 한국어'}
            </span>
          </button>

          {/* Settings */}
          <button
            onClick={() => { navigate('/settings'); setPopupOpen(false); }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
              isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-black/[0.04]'
            )}
          >
            <Settings className="w-4 h-4" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }} />
            <span className={cn('text-[13px] font-medium', isDark ? 'text-white/80' : 'text-black/70')}>
              {language === 'ko' ? '설정' : 'Settings'}
            </span>
          </button>
        </div>
      )}

      {/* Nav bar — pill-shaped liquid glass, drag-proof */}
      <div className="px-4 pb-1.5">
        <div
          className="rounded-full border"
          style={{
            background: 'rgba(80, 80, 90, 0.55)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            borderColor: 'rgba(255,255,255,0.08)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.25), inset 0 0.5px 0 rgba(255,255,255,0.08)',
            touchAction: 'none',
            overscrollBehavior: 'none',
          }}
          onTouchMove={(e) => e.preventDefault()}
        >
          <div className="mobile-bottom-nav flex items-center justify-around px-2 h-14">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = !isSubRoute && (
              mobileView === tab.id ||
              // Chat sub-views (DM, group) should highlight the Chat tab
              (tab.id === 'chat-list' && mobileView === 'dm-chat')
            );
            return (
              <button
                key={tab.id}
                onClick={() => handleNav(tab.id)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-full transition-all duration-200',
                  active
                    ? 'bg-white/90 shadow-sm py-2 px-5'
                    : 'py-2 px-3'
                )}
              >
                <Icon
                  className={cn(
                    'transition-colors shrink-0',
                    active
                      ? 'w-5 h-5 text-black/80'
                      : 'w-[18px] h-[18px] text-white/40'
                  )}
                  strokeWidth={active ? 2 : 1.5}
                />
                {active && (
                  <span className="text-sm font-semibold whitespace-nowrap text-black/80">
                    {language === 'ko' ? tab.labelKo : tab.labelEn}
                  </span>
                )}
              </button>
            );
          })}

          {/* User Avatar */}
          <button
            ref={avatarRef}
            onClick={() => setPopupOpen(v => !v)}
            className="shrink-0"
          >
            <Avatar className="w-8 h-8 ring-2 ring-transparent hover:ring-primary/30 transition-all">
              <AvatarImage src={currentUser?.avatar} />
              <AvatarFallback className="text-xs font-semibold bg-white/20 text-white">
                {currentUser?.name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

export default MobileBottomNav;
