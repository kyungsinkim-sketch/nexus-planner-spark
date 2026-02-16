/**
 * AppLayout — Split-screen layout with persistent chat panel
 *
 * Desktop (lg+): Sidebar | ChatPanel (left) | ContextPanel/Outlet (right)
 * Mobile (<lg):  MobileHeader | ContextPanel (top) | ChatPanel (bottom) | BottomNav
 *
 * Chat is ALWAYS visible. The context panel renders current route via <Outlet />.
 */

import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar, EnhancedMobileNav } from './';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';
import { ChatPanel } from '@/components/chat/ChatPanel';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { MessageSquare, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AppLayout() {
  const { sidebarCollapsed, chatPanelCollapsed, setChatPanelCollapsed } = useAppStore();
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  // Detect screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <main
        className={cn(
          'transition-all duration-300 h-screen',
          'pt-14 lg:pt-0', // top padding for mobile header
          'pb-16 lg:pb-0', // bottom padding for mobile nav
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-60'
        )}
      >
        {isLargeScreen ? (
          /* ===== DESKTOP: Horizontal split (Chat left | Context right) ===== */
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Chat Panel (Left) */}
            {!chatPanelCollapsed && (
              <>
                <ResizablePanel
                  defaultSize={35}
                  minSize={20}
                  maxSize={50}
                  className="relative"
                >
                  <div className="h-full border-r border-border flex flex-col">
                    {/* Chat Panel Header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 shrink-0">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">Chat</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7"
                        onClick={() => setChatPanelCollapsed(true)}
                        aria-label="Collapse chat panel"
                      >
                        <PanelLeftClose className="w-4 h-4" />
                      </Button>
                    </div>
                    {/* Chat Content */}
                    <div className="flex-1 min-h-0">
                      <ChatPanel />
                    </div>
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            {/* Context Panel (Right) — renders current route */}
            <ResizablePanel defaultSize={chatPanelCollapsed ? 100 : 65} minSize={40}>
              <div className="h-full overflow-auto relative">
                {/* Expand chat button when collapsed */}
                {chatPanelCollapsed && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="fixed bottom-4 left-4 z-30 gap-2 shadow-lg md:left-auto"
                    style={sidebarCollapsed ? { left: '5rem' } : { left: '16rem' }}
                    onClick={() => setChatPanelCollapsed(false)}
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                    <MessageSquare className="w-4 h-4" />
                    Chat
                  </Button>
                )}
                <Outlet />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          /* ===== MOBILE: Vertical split (Context top | Chat bottom) ===== */
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* Context Panel (Top) — renders current route */}
            <ResizablePanel defaultSize={55} minSize={25}>
              <div className="h-full overflow-auto">
                <Outlet />
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Chat Panel (Bottom) */}
            <ResizablePanel defaultSize={45} minSize={20} maxSize={75}>
              <div className="h-full border-t border-border flex flex-col">
                {/* Chat Panel Header (Mobile) */}
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/30 shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Chat</span>
                </div>
                {/* Chat Content */}
                <div className="flex-1 min-h-0">
                  <ChatPanel />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </main>

      {/* Mobile Navigation (Header + Bottom Nav) */}
      <EnhancedMobileNav />
    </div>
  );
}
