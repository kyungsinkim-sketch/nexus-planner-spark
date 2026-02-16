/**
 * TabBar — Chrome-style bottom tab bar.
 *
 * - Dashboard tab is always present (pinned, non-closeable)
 * - Active project tabs with close buttons
 * - Admin/Settings quick-access icons on the right
 */

import { useNavigate } from 'react-router-dom';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import { X, LayoutDashboard, Crown, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

export function TabBar() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { openTabs, activeTabId, setActiveTab, closeProjectTab } = useWidgetStore();
  const currentUser = useAppStore((s) => s.currentUser);
  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <div className="glass-tabbar flex items-center h-11 px-2 gap-1 shrink-0 z-30">
      {/* Tabs */}
      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
        {openTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isDashboard = tab.type === 'dashboard';

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-w-0 max-w-[180px] shrink-0',
                isActive
                  ? 'bg-white/15 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-white/8 hover:text-foreground',
              )}
            >
              {/* Color dot or dashboard icon */}
              {isDashboard ? (
                <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: tab.keyColor || 'hsl(234 89% 60%)' }}
                />
              )}

              {/* Label */}
              <span className="truncate">{isDashboard ? t('dashboard') : tab.label}</span>

              {/* Close button (not for dashboard) */}
              {!isDashboard && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeProjectTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:bg-white/20 transition-colors ml-1 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </button>
          );
        })}
      </div>

      {/* Right side: quick access icons */}
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            title="Admin"
          >
            <Crown className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => navigate('/settings')}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          title={t('settings')}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
