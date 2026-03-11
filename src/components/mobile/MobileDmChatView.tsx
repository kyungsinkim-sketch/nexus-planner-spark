/**
 * MobileDmChatView — Full-screen 1:1 DM chat triggered from member detail
 */

import { lazy, Suspense } from 'react';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { ArrowLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const ChatPanel = lazy(() =>
  import('@/components/chat/ChatPanel').then(m => ({ default: m.ChatPanel }))
);

export function MobileDmChatView() {
  const { mobileDmTargetUserId, mobileGroupRoomId, setMobileView } = useWidgetStore();
  const { users, chatRooms } = useAppStore();
  const { language } = useTranslation();

  const targetUser = mobileDmTargetUserId ? users.find(u => u.id === mobileDmTargetUserId) : null;
  const groupRoom = mobileGroupRoomId ? chatRooms.find(r => r.id === mobileGroupRoomId) : null;

  const isGroup = !!mobileGroupRoomId;
  const headerTitle = isGroup ? (groupRoom?.name || 'Group') : targetUser?.name || '';

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 flex items-center gap-3 border-b border-border/30">
        <button
          onClick={() => setMobileView('members')}
          className="p-2 -ml-2 rounded-lg bg-white/40 dark:bg-white/10 hover:bg-white/60 dark:hover:bg-white/15 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        {isGroup ? (
          <>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">#</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{headerTitle}</span>
          </>
        ) : targetUser ? (
          <>
            <Avatar className="w-8 h-8">
              <AvatarImage src={targetUser.avatar} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                {targetUser.name[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold text-foreground">{targetUser.name}</span>
          </>
        ) : null}
      </div>

      {/* ChatPanel */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          {mobileDmTargetUserId && (
            <ChatPanel defaultDmUserId={mobileDmTargetUserId} />
          )}
          {mobileGroupRoomId && (
            <ChatPanel defaultGroupRoomId={mobileGroupRoomId} />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export default MobileDmChatView;
