/**
 * LinksWidget — Project shared links with name & memo support.
 * Shows saved links (from DB) + auto-extracted links from chat.
 * Users can add links manually, and edit name/memo on any link.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Link2, ExternalLink, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import * as linkService from '@/services/linkService';
import type { ProjectLink } from '@/services/linkService';
import type { WidgetDataContext } from '@/types/widget';

function LinksWidget({ context }: { context: WidgetDataContext }) {
  const { messages, getUserById, currentUser } = useAppStore();
  const { language } = useTranslation();
  const projectId = context.projectId || '';

  const [savedLinks, setSavedLinks] = useState<ProjectLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add form
  const [addUrl, setAddUrl] = useState('');
  const [addName, setAddName] = useState('');
  const [addMemo, setAddMemo] = useState('');

  // Edit form
  const [editName, setEditName] = useState('');
  const [editMemo, setEditMemo] = useState('');

  // Load saved links
  useEffect(() => {
    if (!projectId) return;
    linkService.getProjectLinks(projectId)
      .then(setSavedLinks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  // Chat-extracted links (not already saved)
  const chatLinks = useMemo(() => {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const savedUrls = new Set(savedLinks.map(l => l.url));
    const results: { url: string; domain: string; sharedBy: string; sharedAt: string; messageId: string }[] = [];
    const seenUrls = new Set<string>();

    const projectMessages = messages
      .filter(m => m.projectId === projectId && !m.directChatUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (const msg of projectMessages) {
      if (!msg.content) continue;
      const matches = msg.content.match(urlRegex);
      if (matches) {
        for (const url of matches) {
          const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
          if (!seenUrls.has(cleanUrl) && !savedUrls.has(cleanUrl)) {
            seenUrls.add(cleanUrl);
            let domain = '';
            try { domain = new URL(cleanUrl).hostname.replace('www.', ''); } catch { domain = cleanUrl; }
            results.push({ url: cleanUrl, domain, sharedBy: msg.userId, sharedAt: msg.createdAt, messageId: msg.id });
          }
        }
      }
    }
    return results;
  }, [messages, projectId, savedLinks]);

  const getDomain = (url: string) => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  };

  const handleAdd = useCallback(async () => {
    if (!addUrl.trim() || !projectId) return;
    let url = addUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    try {
      const link = await linkService.createProjectLink({
        projectId,
        url,
        name: addName.trim() || undefined,
        memo: addMemo.trim() || undefined,
        sharedBy: currentUser?.id,
      });
      setSavedLinks(prev => [link, ...prev]);
      setAddUrl(''); setAddName(''); setAddMemo(''); setShowAdd(false);
      toast.success(language === 'ko' ? '링크 추가됨' : 'Link added');
    } catch (e) {
      toast.error(language === 'ko' ? '링크 추가 실패' : 'Failed to add link');
    }
  }, [addUrl, addName, addMemo, projectId, currentUser, language]);

  // Save a chat-extracted link to DB
  const handleSaveChatLink = useCallback(async (url: string, sharedBy: string) => {
    if (!projectId) return;
    try {
      const link = await linkService.createProjectLink({ projectId, url, sharedBy });
      setSavedLinks(prev => [link, ...prev]);
      toast.success(language === 'ko' ? '링크 저장됨' : 'Link saved');
    } catch { /* ignore */ }
  }, [projectId, language]);

  const handleEdit = useCallback(async (id: string) => {
    try {
      await linkService.updateProjectLink(id, { name: editName.trim() || null, memo: editMemo.trim() || null });
      setSavedLinks(prev => prev.map(l => l.id === id ? { ...l, name: editName.trim() || null, memo: editMemo.trim() || null } : l));
      setEditingId(null);
      toast.success(language === 'ko' ? '수정됨' : 'Updated');
    } catch { toast.error('Failed'); }
  }, [editName, editMemo, language]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await linkService.deleteProjectLink(id);
      setSavedLinks(prev => prev.filter(l => l.id !== id));
    } catch { toast.error('Failed'); }
  }, []);

  const startEdit = (link: ProjectLink) => {
    setEditingId(link.id);
    setEditName(link.name || '');
    setEditMemo(link.memo || '');
  };

  const isEmpty = savedLinks.length === 0 && chatLinks.length === 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full p-2">
      {/* Add button */}
      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-muted-foreground text-xs mb-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {language === 'ko' ? '링크 추가' : 'Add link'}
        </button>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mb-3 p-2.5 rounded-lg border border-border/50 bg-muted/30 space-y-2">
          <input
            type="text"
            value={addUrl}
            onChange={e => setAddUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && addUrl.trim()) handleAdd(); }}
            placeholder="https://..."
            className="w-full text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <input
            type="text"
            value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && addUrl.trim()) handleAdd(); }}
            placeholder={language === 'ko' ? '링크 이름 (선택)' : 'Link name (optional)'}
            className="w-full text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            value={addMemo}
            onChange={e => setAddMemo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && addUrl.trim()) handleAdd(); }}
            placeholder={language === 'ko' ? '메모 (선택)' : 'Memo (optional)'}
            className="w-full text-xs px-2 py-1.5 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAdd(false); setAddUrl(''); setAddName(''); setAddMemo(''); }}>
              <X className="w-3 h-3 mr-1" />{language === 'ko' ? '취소' : 'Cancel'}
            </Button>
            <Button size="sm" className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleAdd} disabled={!addUrl.trim()}>
              <Check className="w-3 h-3 mr-1" />{language === 'ko' ? '추가' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      {isEmpty && !showAdd && (
        <div className="flex flex-col items-center justify-center text-muted-foreground/50 gap-2 py-8">
          <Link2 className="w-8 h-8" />
          <p className="typo-widget-body text-center">{language === 'ko' ? '공유된 링크가 없습니다' : 'No shared links'}</p>
          <p className="typo-widget-sub text-center max-w-[200px]">{language === 'ko' ? '링크를 추가하거나 채팅에서 공유하세요' : 'Add links or share in chat'}</p>
        </div>
      )}

      <div className="space-y-0.5">
        {/* Saved links */}
        {savedLinks.map(link => {
          const creator = link.sharedBy ? getUserById(link.sharedBy) : null;
          const isEditing = editingId === link.id;

          if (isEditing) {
            return (
              <div key={link.id} className="p-2 rounded-lg border border-primary/30 bg-muted/30 space-y-1.5">
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder={language === 'ko' ? '링크 이름' : 'Link name'}
                  className="w-full text-xs px-2 py-1 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                <input
                  type="text"
                  value={editMemo}
                  onChange={e => setEditMemo(e.target.value)}
                  placeholder={language === 'ko' ? '메모' : 'Memo'}
                  className="w-full text-xs px-2 py-1 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingId(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                  <Button size="sm" className="h-6 text-xs px-2" onClick={() => handleEdit(link.id)}>
                    <Check className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={link.id}
              className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
            >
              <Link2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {link.name && (
                  <p className="typo-widget-body font-medium text-foreground truncate">{link.name}</p>
                )}
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="typo-widget-sub text-blue-400 hover:underline truncate block">
                  {link.name ? link.url : getDomain(link.url)}
                </a>
                {!link.name && (
                  <p className="typo-micro text-muted-foreground/60 truncate">{link.url}</p>
                )}
                {link.memo && (
                  <p className="typo-micro text-muted-foreground/80 mt-0.5">{link.memo}</p>
                )}
                <p className="typo-micro text-muted-foreground/60">
                  {creator?.name || ''}{creator ? ' · ' : ''}{new Date(link.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                <button onClick={() => startEdit(link)} className="p-1 rounded hover:bg-white/10">
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(link.id)} className="p-1 rounded hover:bg-white/10">
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Chat-extracted links (unsaved) */}
        {chatLinks.length > 0 && savedLinks.length > 0 && (
          <div className="border-t border-border/30 my-2 pt-1">
            <p className="typo-micro text-muted-foreground/50 px-2 mb-1">
              {language === 'ko' ? '채팅에서 발견' : 'From chat'}
            </p>
          </div>
        )}
        {chatLinks.map((link) => {
          const creator = getUserById(link.sharedBy);
          return (
            <div
              key={link.messageId + link.url}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
            >
              <Link2 className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="typo-widget-body text-foreground hover:underline truncate block">
                  {link.domain}
                </a>
                <p className="typo-widget-sub truncate">{link.url}</p>
                <p className="typo-micro text-muted-foreground/60">
                  {creator?.name || 'Unknown'} · {new Date(link.sharedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => handleSaveChatLink(link.url, link.sharedBy)}
                className="p-1 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 shrink-0"
                title={language === 'ko' ? '저장' : 'Save'}
              >
                <Plus className="w-3 h-3 text-primary" />
              </button>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default LinksWidget;
