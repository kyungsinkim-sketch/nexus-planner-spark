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
      {/* ChatPanel (has its own header with back button) */}
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
