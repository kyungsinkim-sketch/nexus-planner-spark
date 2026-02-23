/**
 * LinksWidget — Extracts and displays URLs shared in project chat messages.
 * Shows domain, full URL, who shared it, and when.
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Link2, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WidgetDataContext } from '@/types/widget';

interface ExtractedLink {
  url: string;
  domain: string;
  sharedBy: string;
  sharedAt: string;
  messageId: string;
}

function LinksWidget({ context }: { context: WidgetDataContext }) {
  const { messages, getUserById } = useAppStore();
  const projectId = context.projectId || '';

  const links = useMemo(() => {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const results: ExtractedLink[] = [];
    const seenUrls = new Set<string>();

    const projectMessages = messages
      .filter(m => m.projectId === projectId && !m.directChatUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (const msg of projectMessages) {
      if (!msg.content) continue;
      const matches = msg.content.match(urlRegex);
      if (matches) {
        for (const url of matches) {
          const cleanUrl = url.replace(/[.,;:!?)]+$/, ''); // strip trailing punctuation
          if (!seenUrls.has(cleanUrl)) {
            seenUrls.add(cleanUrl);
            let domain = '';
            try { domain = new URL(cleanUrl).hostname.replace('www.', ''); } catch { domain = cleanUrl; }
            results.push({
              url: cleanUrl,
              domain,
              sharedBy: msg.userId,
              sharedAt: msg.createdAt,
              messageId: msg.id,
            });
          }
        }
      }
    }
    return results;
  }, [messages, projectId]);

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-2 py-8">
        <Link2 className="w-8 h-8" />
        <p className="text-xs text-center">공유된 링크가 없습니다</p>
        <p className="text-[10px] text-center max-w-[200px]">채팅에서 공유된 URL이 여기에 모입니다</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full p-2">
      <div className="space-y-0.5">
        {links.map((link) => {
          const creator = getUserById(link.sharedBy);
          return (
            <a
              key={link.messageId + link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
            >
              <Link2 className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{link.domain}</p>
                <p className="text-[10px] text-muted-foreground truncate">{link.url}</p>
                <p className="text-[10px] text-muted-foreground/60">
                  {creator?.name || 'Unknown'} · {new Date(link.sharedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
            </a>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default LinksWidget;
