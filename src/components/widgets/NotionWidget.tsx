/**
 * NotionWidget — Full-featured Notion workspace integration widget.
 *
 * Features:
 * - OAuth popup connect/disconnect
 * - Workspace search (pages + databases)
 * - Page content viewer with block rendering
 * - Database table view
 * - Comments view + add comment
 * - Append text block to page
 * - Create new page
 * - Pin/unpin pages
 * - Link page to Re-Be project
 * - Breadcrumb navigation (parent → child pages)
 * - Open in Notion external link
 * - Liquid glass consistent styling
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  BookOpen,
  Search,
  RefreshCw,
  ExternalLink,
  Pin,
  PinOff,
  Loader2,
  Database,
  FileText,
  CheckSquare,
  ArrowLeft,
  Settings,
  Unplug,
  Plus,
  MessageSquare,
  Send,
  Link2,
  Link2Off,
  ChevronRight,
  FilePlus,
  Table2,
  MoreHorizontal,
  X,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { WidgetDataContext } from '@/types/widget';
import { SuggestionReviewDialog } from '@/components/widgets/SuggestionReviewDialog';
import type { EmailBrainSuggestion, BrainExtractedEvent, BrainExtractedTodo } from '@/types/core';
import {
  isNotionConfigured,
  startNotionOAuthPopup,
  getNotionStatus,
  searchNotionWorkspace,
  getNotionPageContent,
  getNotionPage,
  getNotionComments,
  addNotionComment,
  appendNotionBlocks,
  createNotionPage,
  queryNotionDatabase,
  getNotionDatabase,
  getSyncedPages,
  syncNotionPages,
  togglePinPage,
  linkPageToProject,
  disconnectNotion,
  type NotionConnectionStatus,
  type NotionPageItem,
  type NotionSyncedPage,
  type NotionPageContent,
} from '@/services/notionService';

// ─── Block Renderer ─────────────────────────────────

function NotionBlockRenderer({ block }: { block: Record<string, unknown> }) {
  const blockType = block.type as string;
  const content = block[blockType] as Record<string, unknown> | undefined;
  if (!content) return null;

  const richText = content.rich_text as Array<{
    plain_text: string;
    annotations?: {
      bold?: boolean;
      italic?: boolean;
      strikethrough?: boolean;
      underline?: boolean;
      code?: boolean;
    };
    href?: string | null;
  }> | undefined;

  const renderRichText = (texts: typeof richText) => {
    if (!texts?.length) return null;
    return texts.map((t, i) => {
      let el: React.ReactNode = t.plain_text;
      const a = t.annotations;
      if (a?.bold) el = <strong key={i}>{el}</strong>;
      if (a?.italic) el = <em key={i}>{el}</em>;
      if (a?.strikethrough) el = <s key={i}>{el}</s>;
      if (a?.underline) el = <u key={i}>{el}</u>;
      if (a?.code) el = <code key={i} className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{el}</code>;
      if (t.href) el = <a key={i} href={t.href} target="_blank" rel="noopener" className="text-primary underline">{el}</a>;
      return <span key={i}>{el}</span>;
    });
  };

  const children = (block as Record<string, unknown>)._children as Array<Record<string, unknown>> | undefined;

  switch (blockType) {
    case 'paragraph':
      return (
        <p className="text-sm leading-relaxed mb-1.5">
          {renderRichText(richText) || <span className="text-muted-foreground">&nbsp;</span>}
        </p>
      );
    case 'heading_1':
      return <h2 className="text-lg font-bold mt-4 mb-2">{renderRichText(richText)}</h2>;
    case 'heading_2':
      return <h3 className="text-base font-semibold mt-3 mb-1.5">{renderRichText(richText)}</h3>;
    case 'heading_3':
      return <h4 className="text-sm font-semibold mt-2 mb-1">{renderRichText(richText)}</h4>;
    case 'bulleted_list_item':
      return (
        <div className="flex gap-2 ml-2 mb-0.5">
          <span className="text-muted-foreground mt-1.5 text-[8px]">●</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm">{renderRichText(richText)}</p>
            {children?.map((child, i) => <NotionBlockRenderer key={i} block={child} />)}
          </div>
        </div>
      );
    case 'numbered_list_item':
      return (
        <div className="flex gap-2 ml-2 mb-0.5">
          <span className="text-muted-foreground text-sm min-w-[16px]">1.</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm">{renderRichText(richText)}</p>
            {children?.map((child, i) => <NotionBlockRenderer key={i} block={child} />)}
          </div>
        </div>
      );
    case 'to_do': {
      const checked = content.checked as boolean;
      return (
        <div className="flex items-start gap-2 ml-2 mb-0.5">
          <CheckSquare className={`w-4 h-4 mt-0.5 shrink-0 ${checked ? 'text-emerald-500' : 'text-muted-foreground'}`} />
          <p className={`text-sm ${checked ? 'line-through text-muted-foreground' : ''}`}>
            {renderRichText(richText)}
          </p>
        </div>
      );
    }
    case 'quote':
    case 'callout':
      return (
        <blockquote className="border-l-2 border-primary/30 pl-3 py-1 my-2 bg-muted/30 rounded-r">
          <p className="text-sm italic">{renderRichText(richText)}</p>
        </blockquote>
      );
    case 'toggle':
      return (
        <details className="mb-1">
          <summary className="text-sm cursor-pointer hover:text-primary">{renderRichText(richText)}</summary>
          <div className="ml-4 mt-1">
            {children?.map((child, i) => <NotionBlockRenderer key={i} block={child} />)}
          </div>
        </details>
      );
    case 'code': {
      const lang = (content.language as string) || '';
      return (
        <div className="my-2 rounded-lg bg-muted/60 border overflow-hidden">
          {lang && <div className="text-[10px] text-muted-foreground px-3 py-1 border-b bg-muted/50">{lang}</div>}
          <pre className="p-3 text-xs overflow-x-auto font-mono">
            {richText?.map(t => t.plain_text).join('') || ''}
          </pre>
        </div>
      );
    }
    case 'divider':
      return <hr className="my-3 border-border" />;
    case 'image': {
      const imageData = content as Record<string, unknown>;
      const url = (imageData.external as Record<string, string>)?.url
        || (imageData.file as Record<string, string>)?.url;
      if (!url) return null;
      return (
        <div className="my-2 rounded-lg overflow-hidden">
          <img src={url} alt="" className="max-w-full h-auto rounded" loading="lazy" />
        </div>
      );
    }
    case 'bookmark':
    case 'link_preview': {
      const bookmarkUrl = (content.url as string) || '';
      return (
        <a href={bookmarkUrl} target="_blank" rel="noopener"
          className="flex items-center gap-2 p-2 my-1 rounded border bg-muted/30 hover:bg-muted/60 transition text-sm text-primary">
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{bookmarkUrl}</span>
        </a>
      );
    }
    case 'child_page': {
      const title = (content.title as string) || 'Untitled';
      return (
        <div className="flex items-center gap-2 p-2 my-1 rounded border bg-muted/30 hover:bg-muted/50 cursor-pointer transition text-sm"
          data-child-page-id={block.id}>
          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{title}</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
        </div>
      );
    }
    case 'child_database': {
      const title = (content.title as string) || 'Untitled';
      return (
        <div className="flex items-center gap-2 p-2 my-1 rounded border bg-muted/30 hover:bg-muted/50 cursor-pointer transition text-sm"
          data-child-db-id={block.id}>
          <Database className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{title}</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
        </div>
      );
    }
    default:
      return null;
  }
}

// ─── Page Icon ──────────────────────────────────────

function PageIcon({ icon, type, className = 'w-4 h-4' }: { icon: string | null; type: string; className?: string }) {
  if (icon && !icon.startsWith('http')) return <span className="text-sm">{icon}</span>;
  if (icon) return <img src={icon} alt="" className={`${className} rounded`} />;
  return type === 'database'
    ? <Database className={`${className} text-muted-foreground`} />
    : <FileText className={`${className} text-muted-foreground`} />;
}

// ─── Database Table View ────────────────────────────

function DatabaseTableView({ items, onOpenPage }: {
  items: Array<{ id: string; title: string; icon: string | null; url: string; properties?: Record<string, unknown>; lastEditedTime?: string }>;
  onOpenPage: (id: string, title: string, icon: string | null, url: string) => void;
}) {
  if (!items.length) {
    return <p className="text-xs text-muted-foreground text-center py-4">데이터베이스가 비어있습니다</p>;
  }

  // Extract common property columns from first item
  const firstProps = items[0]?.properties as Record<string, { type: string; [k: string]: unknown }> | undefined;
  const columns: Array<{ key: string; name: string; type: string }> = [];
  if (firstProps) {
    for (const [key, val] of Object.entries(firstProps)) {
      if (val.type === 'title') continue; // title is always shown as row name
      if (columns.length >= 3) break; // max 3 extra columns in widget
      columns.push({ key, name: key, type: val.type });
    }
  }

  const getCellValue = (prop: { type: string; [k: string]: unknown } | undefined): string => {
    if (!prop) return '';
    switch (prop.type) {
      case 'rich_text':
      case 'title': {
        const rt = prop[prop.type] as Array<{ plain_text: string }> | undefined;
        return rt?.map(t => t.plain_text).join('') || '';
      }
      case 'select': return (prop.select as { name: string } | null)?.name || '';
      case 'multi_select': return (prop.multi_select as Array<{ name: string }>)?.map(s => s.name).join(', ') || '';
      case 'number': return prop.number != null ? String(prop.number) : '';
      case 'checkbox': return prop.checkbox ? '✅' : '';
      case 'date': {
        const d = prop.date as { start: string; end?: string } | null;
        return d?.start || '';
      }
      case 'status': return (prop.status as { name: string } | null)?.name || '';
      case 'url': return (prop.url as string) || '';
      default: return '';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">이름</th>
            {columns.map(col => (
              <th key={col.key} className="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap">{col.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const props = item.properties as Record<string, { type: string; [k: string]: unknown }> | undefined;
            return (
              <tr key={item.id}
                className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition"
                onClick={() => onOpenPage(item.id, item.title, item.icon, item.url)}>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <PageIcon icon={item.icon} type="page" className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[150px]">{item.title || 'Untitled'}</span>
                  </div>
                </td>
                {columns.map(col => (
                  <td key={col.key} className="px-2 py-1.5 text-muted-foreground truncate max-w-[120px]">
                    {getCellValue(props?.[col.key])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Comments Panel ─────────────────────────────────

function CommentsPanel({ userId, pageId }: { userId: string; pageId: string }) {
  const [comments, setComments] = useState<Array<{
    id: string;
    created_time: string;
    rich_text: Array<{ plain_text: string }>;
    created_by: { id: string; name?: string; avatar_url?: string };
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadComments();
  }, [pageId]);

  const loadComments = async () => {
    setLoading(true);
    const raw = await getNotionComments(userId, pageId) as Array<Record<string, unknown>>;
    setComments(raw.map(c => ({
      id: c.id as string,
      created_time: c.created_time as string,
      rich_text: (c.rich_text as Array<{ plain_text: string }>) || [],
      created_by: (c.created_by as { id: string; name?: string; avatar_url?: string }) || { id: '' },
    })));
    setLoading(false);
  };

  const handleSend = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    const ok = await addNotionComment(userId, pageId, newComment.trim());
    if (ok) {
      setNewComment('');
      await loadComments();
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">코멘트가 없습니다</p>
        ) : (
          comments.map(c => (
            <div key={c.id} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium shrink-0">
                  {c.created_by.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span className="text-[11px] font-medium">{c.created_by.name || 'Unknown'}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.created_time).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm ml-6">{c.rich_text.map(t => t.plain_text).join('')}</p>
            </div>
          ))
        )}
      </div>
      {/* Comment input */}
      <div className="border-t p-2 flex items-center gap-2">
        <input
          type="text"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="코멘트 추가..."
          className="flex-1 text-sm bg-muted/30 border border-border/50 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30 transition"
        />
        <button onClick={handleSend} disabled={!newComment.trim() || sending}
          className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition shrink-0">
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── New Page Dialog ────────────────────────────────

function NewPageForm({ userId, parentPageId, onCreated, onCancel }: {
  userId: string;
  parentPageId?: string;
  onCreated: (id: string, title: string, url: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);

    const parent = parentPageId
      ? { page_id: parentPageId }
      : { page_id: parentPageId || '' }; // fallback — requires a parent

    if (!parentPageId) {
      // Search for first workspace-level page as parent
      const searchResult = await searchNotionWorkspace(userId, '', 'page');
      if (searchResult.results.length > 0) {
        // Use workspace level — create under first page parent or as workspace child
      }
      setCreating(false);
      return;
    }

    const result = await createNotionPage(userId, parent, {
      title: { title: [{ text: { content: title.trim() } }] },
    });

    setCreating(false);
    if (result) {
      onCreated(result.id, title.trim(), result.url);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold">새 페이지 만들기</h3>
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onCancel(); }}
        placeholder="페이지 제목"
        className="w-full text-sm bg-muted/30 border border-border/50 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 transition"
        autoFocus
      />
      <div className="flex items-center gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded-lg hover:bg-muted transition">취소</button>
        <button onClick={handleCreate} disabled={!title.trim() || creating}
          className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition">
          {creating ? '생성 중...' : '생성'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Widget ────────────────────────────────────

export default function NotionWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const currentUser = useAppStore(s => s.currentUser);
  const userId = currentUser?.id || '';
  const projectId = context.type === 'project' ? context.projectId : undefined;

  // State
  const [status, setStatus] = useState<NotionConnectionStatus>({ isConnected: false, syncStatus: 'DISCONNECTED' });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Navigation
  type ViewType = 'list' | 'page' | 'database' | 'settings' | 'newPage';
  const [view, setView] = useState<ViewType>('list');
  const [pageTab, setPageTab] = useState<'content' | 'comments'>('content');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NotionPageItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Page list
  const [syncedPages, setSyncedPages] = useState<NotionSyncedPage[]>([]);

  // Page viewer
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedPageTitle, setSelectedPageTitle] = useState('');
  const [selectedPageIcon, setSelectedPageIcon] = useState<string | null>(null);
  const [selectedPageUrl, setSelectedPageUrl] = useState('');
  const [pageContent, setPageContent] = useState<NotionPageContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  // Database viewer
  const [dbItems, setDbItems] = useState<Array<{ id: string; title: string; icon: string | null; url: string; properties?: Record<string, unknown>; lastEditedTime?: string }>>([]);

  // Append block input
  const [showAppendInput, setShowAppendInput] = useState(false);
  const [appendText, setAppendText] = useState('');
  const [appending, setAppending] = useState(false);

  // Navigation history (breadcrumbs)
  const [navStack, setNavStack] = useState<Array<{ id: string; title: string; icon: string | null; url: string; type: 'page' | 'database' }>>([]);

  // More menu
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Brain AI text selection bubble menu
  const [selectionBubble, setSelectionBubble] = useState<{ text: string; x: number; y: number } | null>(null);
  const [brainProcessing, setBrainProcessing] = useState(false);
  const [brainDialogOpen, setBrainDialogOpen] = useState(false);
  const [brainSuggestion, setBrainSuggestion] = useState<EmailBrainSuggestion | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load initial data ────────────────────────────
  useEffect(() => {
    if (!userId) return;
    loadStatus();
  }, [userId]);

  useEffect(() => {
    if (status.isConnected && userId) {
      loadSyncedPages();
    }
  }, [status.isConnected, userId]);

  const loadStatus = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const s = await getNotionStatus(userId);
    setStatus(s);
    setLoading(false);
  }, [userId]);

  const loadSyncedPages = useCallback(async () => {
    if (!userId) return;
    // Always load ALL pages (no project filter) — we separate linked/unlinked in the UI
    const pages = await getSyncedPages(userId);
    setSyncedPages(pages);
  }, [userId]);

  // ─── Connect ──────────────────────────────────────
  const handleConnect = useCallback(async () => {
    if (!userId || connecting) return;
    setConnecting(true);
    const result = await startNotionOAuthPopup(userId);
    if (result.success) {
      await loadStatus();
      await loadSyncedPages();
    }
    setConnecting(false);
  }, [userId, connecting, loadStatus, loadSyncedPages]);

  // ─── Search ───────────────────────────────────────
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      const result = await searchNotionWorkspace(userId, query);
      setSearchResults(result.results);
      setSearching(false);
    }, 300);
  }, [userId]);

  // ─── Sync ─────────────────────────────────────────
  const handleSync = useCallback(async () => {
    if (!userId || syncing) return;
    setSyncing(true);
    await syncNotionPages(userId);
    await loadSyncedPages();
    setSyncing(false);
  }, [userId, syncing, loadSyncedPages]);

  // ─── View page ────────────────────────────────────
  const openPage = useCallback(async (
    pageId: string, title: string, icon: string | null, url: string,
    cachedContent?: NotionPageContent | null, pushNav = true,
  ) => {
    setSelectedPageId(pageId);
    setSelectedPageTitle(title);
    setSelectedPageIcon(icon);
    setSelectedPageUrl(url);
    setView('page');
    setPageTab('content');
    setShowAppendInput(false);
    setShowMoreMenu(false);

    if (pushNav) {
      setNavStack(prev => [...prev, { id: pageId, title, icon, url, type: 'page' }]);
    }

    if (cachedContent) {
      setPageContent(cachedContent);
      return;
    }

    setLoadingContent(true);
    setPageContent(null);
    const content = await getNotionPageContent(userId, pageId);
    setPageContent(content);
    setLoadingContent(false);
  }, [userId]);

  // ─── View database ────────────────────────────────
  const openDatabase = useCallback(async (dbId: string, title: string, icon: string | null, url: string) => {
    setSelectedPageId(dbId);
    setSelectedPageTitle(title);
    setSelectedPageIcon(icon);
    setSelectedPageUrl(url);
    setView('database');
    setShowMoreMenu(false);
    setNavStack(prev => [...prev, { id: dbId, title, icon, url, type: 'database' }]);

    setLoadingContent(true);
    setDbItems([]);
    const result = await queryNotionDatabase(userId, dbId);
    setDbItems(result.results.map(r => ({
      id: r.id,
      title: r.title,
      icon: r.icon,
      url: r.url,
      properties: r.properties || undefined,
      lastEditedTime: r.lastEditedTime,
    })));
    setLoadingContent(false);
  }, [userId]);

  // ─── Navigate to item (page or db) ───────────────
  const navigateToItem = useCallback((item: NotionPageItem | { id: string; object?: string; title: string; icon: string | null; url: string }) => {
    const objType = (item as NotionPageItem).object || 'page';
    if (objType === 'database') {
      openDatabase(item.id, item.title, item.icon, item.url);
    } else {
      openPage(item.id, item.title, item.icon, item.url);
    }
  }, [openPage, openDatabase]);

  // ─── Go back ──────────────────────────────────────
  const goBack = useCallback(() => {
    setShowMoreMenu(false);
    if (navStack.length <= 1) {
      setView('list');
      setSelectedPageId(null);
      setPageContent(null);
      setDbItems([]);
      setNavStack([]);
      return;
    }
    const newStack = [...navStack];
    newStack.pop();
    const prev = newStack[newStack.length - 1];
    setNavStack(newStack);
    if (prev.type === 'database') {
      openDatabase(prev.id, prev.title, prev.icon, prev.url);
      setNavStack(newStack); // reset to not double push
    } else {
      openPage(prev.id, prev.title, prev.icon, prev.url, null, false);
      setNavStack(newStack);
    }
  }, [navStack, openPage, openDatabase]);

  // ─── Pin/Unpin ────────────────────────────────────
  const handleTogglePin = useCallback(async (notionPageId: string, currentlyPinned: boolean) => {
    await togglePinPage(userId, notionPageId, !currentlyPinned);
    await loadSyncedPages();
  }, [userId, loadSyncedPages]);

  // ─── Link to project ─────────────────────────────
  const handleLinkToProject = useCallback(async (notionPageId: string, currentlyLinked: boolean) => {
    if (!projectId) return;
    await linkPageToProject(userId, notionPageId, currentlyLinked ? null : projectId);
    await loadSyncedPages();
  }, [userId, projectId, loadSyncedPages]);

  // ─── Append block ─────────────────────────────────
  const handleAppendBlock = useCallback(async () => {
    if (!appendText.trim() || !selectedPageId || appending) return;
    setAppending(true);
    const ok = await appendNotionBlocks(userId, selectedPageId, [
      { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: appendText.trim() } }] } },
    ]);
    if (ok) {
      setAppendText('');
      setShowAppendInput(false);
      // Refresh content
      const content = await getNotionPageContent(userId, selectedPageId);
      setPageContent(content);
    }
    setAppending(false);
  }, [userId, selectedPageId, appendText, appending]);

  // ─── Disconnect ───────────────────────────────────
  const handleDisconnect = useCallback(async () => {
    await disconnectNotion(userId);
    setStatus({ isConnected: false, syncStatus: 'DISCONNECTED' });
    setView('list');
    setSyncedPages([]);
  }, [userId]);

  // ─── Child page click handler ─────────────────────
  // ─── Text selection → Brain AI bubble ───
  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelectionBubble(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectionBubble({ text: sel.toString().trim(), x: rect.left + rect.width / 2, y: rect.top - 8 });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleTextSelection);
    return () => document.removeEventListener('selectionchange', handleTextSelection);
  }, [handleTextSelection]);

  // Brain AI: single button → comprehensive analysis → SuggestionReviewDialog
  const handleNotionBrainAnalyze = useCallback(async () => {
    if (!selectionBubble || !userId) return;
    setBrainProcessing(true);
    const selectedText = selectionBubble.text;
    setSelectionBubble(null);
    window.getSelection()?.removeAllRanges();

    try {
      const { data, error } = await supabase.functions.invoke('brain-slack-action', {
        body: {
          userId,
          messageText: selectedText,
          source: 'notion',
          sourceMeta: {
            pageId: selectedPageId,
            pageTitle: selectedPageTitle,
          },
          projectId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.suggestion) {
        setBrainSuggestion(data.suggestion as EmailBrainSuggestion);
        setBrainDialogOpen(true);
      }
    } catch (e) {
      console.error('[NotionWidget] brain analyze:', e);
      toast.error('Brain AI 처리에 실패했습니다');
    } finally {
      setBrainProcessing(false);
    }
  }, [selectionBubble, userId, selectedPageId, selectedPageTitle, projectId]);

  // SuggestionReviewDialog confirm handler for Notion
  const handleNotionBrainConfirm = useCallback(async (
    _suggestion: EmailBrainSuggestion,
    edits: { event?: BrainExtractedEvent; todo?: BrainExtractedTodo; note?: string; includeEvent: boolean; includeTodo: boolean; includeNote: boolean },
  ) => {
    if (!userId) return;
    const created: string[] = [];

    if (edits.includeEvent && edits.event) {
      const { error } = await supabase.from('calendar_events').insert({
        title: edits.event.title, type: edits.event.type || 'MEETING',
        start_at: edits.event.startAt, end_at: edits.event.endAt,
        location: edits.event.location || null, project_id: edits.event.projectId || null,
        owner_id: userId, source: 'PAULUS',
        attendee_ids: edits.event.attendeeIds?.length ? edits.event.attendeeIds : null,
      });
      if (!error) created.push('📅 캘린더');
    }

    if (edits.includeTodo && edits.todo) {
      const { error } = await supabase.from('personal_todos').insert({
        title: edits.todo.title, assignee_ids: edits.todo.assigneeIds?.filter(Boolean) || [],
        requested_by_id: userId, project_id: edits.todo.projectId || null,
        due_date: edits.todo.dueDate, priority: edits.todo.priority || 'NORMAL', status: 'PENDING',
      });
      if (!error) created.push('📋 TODO');
    }

    if (edits.includeNote && edits.note) {
      const { error } = await supabase.from('important_notes').insert({
        title: edits.note.substring(0, 50), content: edits.note,
        created_by: userId, source: 'notion',
      });
      if (!error) created.push('⭐ 중요기록');
    }

    if (created.length > 0) toast.success(`${created.join(', ')} 추가 완료 ✨`);
    setBrainDialogOpen(false);
    setBrainSuggestion(null);
  }, [userId]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-child-page-id]');
    if (target) {
      const childId = target.getAttribute('data-child-page-id');
      if (childId) {
        openPage(childId, (target.textContent || 'Untitled').trim(), null, '');
        return;
      }
    }
    const dbTarget = (e.target as HTMLElement).closest('[data-child-db-id]');
    if (dbTarget) {
      const childId = dbTarget.getAttribute('data-child-db-id');
      if (childId) {
        openDatabase(childId, (dbTarget.textContent || 'Untitled').trim(), null, '');
      }
    }
  }, [openPage, openDatabase]);

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  // ─── Not connected ────────────────────────────────
  if (!loading && !status.isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 flex items-center justify-center">
          <BookOpen className="w-8 h-8 text-white dark:text-gray-900" />
        </div>
        <div>
          <h3 className="text-base font-semibold mb-1">Notion 연결</h3>
          <p className="text-xs text-muted-foreground max-w-[240px]">
            워크스페이스를 연결하여 페이지와 데이터베이스를 확인하세요
          </p>
        </div>
        {isNotionConfigured() ? (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition flex items-center gap-2"
          >
            {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
            {connecting ? '연결 중...' : 'Notion 연결하기'}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground italic">Notion이 설정되지 않았습니다</p>
        )}
      </div>
    );
  }

  // ─── Loading ──────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── Settings view ────────────────────────────────
  if (view === 'settings') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <button onClick={() => setView('list')} className="p-1 hover:bg-muted rounded"><ArrowLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium">설정</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              {status.workspaceIcon ? <span className="text-lg">{status.workspaceIcon}</span> : <BookOpen className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div>
              <p className="text-sm font-medium">{status.workspaceName || 'Notion'}</p>
              <p className="text-xs text-muted-foreground">{status.connectedEmail}</p>
            </div>
          </div>
          {status.lastSyncAt && (
            <p className="text-xs text-muted-foreground">
              마지막 동기화: {new Date(status.lastSyncAt).toLocaleString('ko-KR')}
            </p>
          )}
          <button onClick={handleDisconnect}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-sm w-full">
            <Unplug className="w-4 h-4" /> 연결 해제
          </button>
        </div>
      </div>
    );
  }

  // ─── New page form ────────────────────────────────
  if (view === 'newPage') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <button onClick={() => setView('list')} className="p-1 hover:bg-muted rounded"><ArrowLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium">새 페이지</span>
        </div>
        <NewPageForm
          userId={userId}
          parentPageId={selectedPageId || undefined}
          onCreated={(id, title, url) => {
            openPage(id, title, null, url);
            loadSyncedPages();
          }}
          onCancel={() => setView(selectedPageId ? 'page' : 'list')}
        />
      </div>
    );
  }

  // ─── Page viewer ──────────────────────────────────
  if (view === 'page' && selectedPageId) {
    const currentSynced = syncedPages.find(p => p.notion_page_id === selectedPageId || p.notion_page_id === selectedPageId.replace(/-/g, ''));
    const isPinned = currentSynced?.is_pinned || false;
    const isLinked = currentSynced?.project_id === projectId;

    return (
      <div className="h-full flex flex-col">
        {/* Page header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b min-h-[40px]">
          <button onClick={goBack} className="p-1 hover:bg-muted rounded shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <PageIcon icon={selectedPageIcon} type="page" />
          <span className="text-sm font-medium truncate flex-1">{selectedPageTitle}</span>

          {/* Tab switcher */}
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 shrink-0">
            <button onClick={() => setPageTab('content')}
              className={`px-2 py-0.5 text-[10px] rounded-md transition ${pageTab === 'content' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
              내용
            </button>
            <button onClick={() => setPageTab('comments')}
              className={`px-2 py-0.5 text-[10px] rounded-md transition ${pageTab === 'comments' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
              💬
            </button>
          </div>

          {/* More menu */}
          <div className="relative shrink-0">
            <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="p-1 hover:bg-muted rounded">
              <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 top-8 z-50 rounded-lg py-1 min-w-[140px] whitespace-nowrap bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 shadow-lg">
                  <button onClick={() => { handleTogglePin(selectedPageId, isPinned); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition">
                    {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    {isPinned ? '고정 해제' : '고정'}
                  </button>
                  {projectId && (
                    <button onClick={() => { handleLinkToProject(selectedPageId, isLinked); setShowMoreMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition">
                      {isLinked ? <Link2Off className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                      {isLinked ? '프로젝트 연결 해제' : '이 프로젝트에 연결'}
                    </button>
                  )}
                  <button onClick={() => { setView('newPage'); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition">
                    <FilePlus className="w-3.5 h-3.5" /> 하위 페이지 만들기
                  </button>
                  {selectedPageUrl && (
                    <a href={selectedPageUrl} target="_blank" rel="noopener"
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition" onClick={() => setShowMoreMenu(false)}>
                      <ExternalLink className="w-3.5 h-3.5" /> Notion에서 열기
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Breadcrumb */}
        {navStack.length > 1 && (
          <div className="flex items-center gap-1 px-3 py-1 border-b bg-muted/20 text-[10px] text-muted-foreground overflow-x-auto">
            {navStack.map((item, idx) => (
              <span key={item.id} className="flex items-center gap-1 shrink-0">
                {idx > 0 && <ChevronRight className="w-2.5 h-2.5" />}
                <button
                  onClick={() => {
                    if (idx < navStack.length - 1) {
                      const newStack = navStack.slice(0, idx + 1);
                      setNavStack(newStack);
                      const target = newStack[newStack.length - 1];
                      if (target.type === 'database') {
                        openDatabase(target.id, target.title, target.icon, target.url);
                        setNavStack(newStack);
                      } else {
                        openPage(target.id, target.title, target.icon, target.url, null, false);
                        setNavStack(newStack);
                      }
                    }
                  }}
                  className={`hover:text-foreground transition truncate max-w-[80px] ${idx === navStack.length - 1 ? 'text-foreground font-medium' : ''}`}
                >
                  {item.title || 'Untitled'}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Content / Comments */}
        {pageTab === 'comments' ? (
          <CommentsPanel userId={userId} pageId={selectedPageId} />
        ) : (
          <div className="flex-1 overflow-y-auto" onClick={handleContentClick}>
            <div className="p-4">
              {loadingContent ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : pageContent?.blocks?.length ? (
                <div className="space-y-0.5">
                  {(pageContent.blocks as Array<Record<string, unknown>>).map((block, i) => (
                    <NotionBlockRenderer key={(block.id as string) || i} block={block} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">빈 페이지입니다</p>
              )}
            </div>

            {/* Brain AI text selection bubble — single button, opens SuggestionReviewDialog */}
            {selectionBubble && !brainProcessing && createPortal(
              <button
                onClick={(e) => { e.stopPropagation(); handleNotionBrainAnalyze(); }}
                className="fixed z-[9999] flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded-full shadow-lg text-xs font-medium hover:bg-primary/90 transition-all animate-in fade-in zoom-in-95"
                style={{ top: selectionBubble.y - 32, left: selectionBubble.x, transform: 'translateX(-50%)' }}
              >
                <Sparkles className="w-3 h-3" /> Brain AI 분석
              </button>,
              document.body
            )}

            {/* Brain processing indicator */}
            {brainProcessing && createPortal(
              <div className="fixed z-[9999] flex items-center gap-1.5 px-3 py-1.5 bg-primary/90 text-primary-foreground rounded-full shadow-lg text-xs animate-pulse"
                style={{ top: 100, left: '50%', transform: 'translateX(-50%)' }}>
                <Loader2 className="w-3 h-3 animate-spin" /> 분석 중...
              </div>,
              document.body
            )}

            {/* Brain AI Review Dialog — unified with email/slack */}
            <SuggestionReviewDialog
              open={brainDialogOpen}
              onOpenChange={setBrainDialogOpen}
              suggestion={brainSuggestion}
              onConfirm={handleNotionBrainConfirm}
              sourceLabel={`Notion — ${selectedPageTitle}`}
            />

            {/* Append block input */}
            {showAppendInput ? (
              <div className="border-t p-2 flex items-center gap-2">
                <input
                  type="text"
                  value={appendText}
                  onChange={e => setAppendText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAppendBlock(); if (e.key === 'Escape') setShowAppendInput(false); }}
                  placeholder="텍스트 추가..."
                  className="flex-1 text-sm bg-muted/30 border border-border/50 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30 transition"
                  autoFocus
                />
                <button onClick={handleAppendBlock} disabled={!appendText.trim() || appending}
                  className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition shrink-0">
                  {appending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setShowAppendInput(false)} className="p-1.5 rounded-lg hover:bg-muted transition shrink-0">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="border-t px-3 py-2">
                <button onClick={() => setShowAppendInput(true)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
                  <Plus className="w-3.5 h-3.5" /> 텍스트 추가
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Database viewer ──────────────────────────────
  if (view === 'database' && selectedPageId) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b min-h-[40px]">
          <button onClick={goBack} className="p-1 hover:bg-muted rounded shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Database className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate flex-1">{selectedPageTitle}</span>
          {selectedPageUrl && (
            <a href={selectedPageUrl} target="_blank" rel="noopener" className="p-1 hover:bg-muted rounded shrink-0">
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          )}
        </div>

        {/* Breadcrumb */}
        {navStack.length > 1 && (
          <div className="flex items-center gap-1 px-3 py-1 border-b bg-muted/20 text-[10px] text-muted-foreground overflow-x-auto">
            {navStack.map((item, idx) => (
              <span key={item.id} className="flex items-center gap-1 shrink-0">
                {idx > 0 && <ChevronRight className="w-2.5 h-2.5" />}
                <span className={idx === navStack.length - 1 ? 'text-foreground font-medium' : ''}>{item.title || 'Untitled'}</span>
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loadingContent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DatabaseTableView items={dbItems} onOpenPage={(id, title, icon, url) => openPage(id, title, icon, url)} />
          )}
        </div>
      </div>
    );
  }

  // ─── Main list view ───────────────────────────────
  const pinnedPages = syncedPages.filter(p => p.is_pinned);
  const linkedPages = projectId ? syncedPages.filter(p => p.project_id === projectId && !p.is_pinned) : [];
  const recentPages = syncedPages.filter(p => !p.is_pinned && (!projectId || p.project_id !== projectId)).slice(0, 10);
  const showSearchResults = searchQuery.trim().length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1 truncate">{status.workspaceName || 'Notion'}</span>
        <button onClick={handleSync} disabled={syncing} className="p-1 hover:bg-muted rounded shrink-0" title="동기화">
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${syncing ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={() => setView('settings')} className="p-1 hover:bg-muted rounded shrink-0" title="설정">
          <Settings className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="페이지 검색..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border bg-muted/30 focus:bg-background focus:ring-1 focus:ring-primary/30 outline-none transition"
          />
          {searching && <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showSearchResults ? (
          <div className="py-1">
            {searchResults.length === 0 && !searching ? (
              <p className="text-xs text-muted-foreground text-center py-4">결과 없음</p>
            ) : (
              searchResults.map(item => (
                <PageListItem
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  icon={item.icon}
                  objectType={item.object}
                  url={item.url}
                  lastEditedTime={item.lastEditedTime}
                  onOpen={() => navigateToItem(item)}
                  onTogglePin={() => handleTogglePin(item.id.replace(/-/g, ''), false)}
                  projectId={projectId}
                  onLinkProject={projectId ? () => handleLinkToProject(item.id.replace(/-/g, ''), false) : undefined}
                />
              ))
            )}
          </div>
        ) : (
          <>
            {/* Pinned pages */}
            {pinnedPages.length > 0 && (
              <PageSection title="📌 고정됨" pages={pinnedPages}
                onOpen={(p) => p.notion_object_type === 'database'
                  ? openDatabase(p.notion_page_id, p.title, p.icon, p.url)
                  : openPage(p.notion_page_id, p.title, p.icon, p.url, p.cached_content as NotionPageContent | null)}
                onTogglePin={(p) => handleTogglePin(p.notion_page_id, true)}
                isPinned
                projectId={projectId}
                onLinkProject={projectId ? (p) => handleLinkToProject(p.notion_page_id, p.project_id === projectId) : undefined}
              />
            )}

            {/* Project-linked pages */}
            {linkedPages.length > 0 && (
              <PageSection title="🔗 이 프로젝트" pages={linkedPages}
                onOpen={(p) => p.notion_object_type === 'database'
                  ? openDatabase(p.notion_page_id, p.title, p.icon, p.url)
                  : openPage(p.notion_page_id, p.title, p.icon, p.url, p.cached_content as NotionPageContent | null)}
                onTogglePin={(p) => handleTogglePin(p.notion_page_id, false)}
                projectId={projectId}
                onLinkProject={(p) => handleLinkToProject(p.notion_page_id, true)}
              />
            )}

            {/* Recent pages */}
            {recentPages.length > 0 && (
              <PageSection title="최근" pages={recentPages}
                onOpen={(p) => p.notion_object_type === 'database'
                  ? openDatabase(p.notion_page_id, p.title, p.icon, p.url)
                  : openPage(p.notion_page_id, p.title, p.icon, p.url, p.cached_content as NotionPageContent | null)}
                onTogglePin={(p) => handleTogglePin(p.notion_page_id, false)}
                projectId={projectId}
                onLinkProject={projectId ? (p) => handleLinkToProject(p.notion_page_id, p.project_id === projectId) : undefined}
              />
            )}

            {/* Empty state */}
            {syncedPages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-3">
                <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">페이지가 없습니다</p>
                  <button onClick={handleSync} disabled={syncing} className="text-xs text-primary hover:underline">
                    {syncing ? '동기화 중...' : '지금 동기화'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page Section ───────────────────────────────────

function PageSection({ title, pages, onOpen, onTogglePin, isPinned, projectId, onLinkProject }: {
  title: string;
  pages: NotionSyncedPage[];
  onOpen: (page: NotionSyncedPage) => void;
  onTogglePin: (page: NotionSyncedPage) => void;
  isPinned?: boolean;
  projectId?: string;
  onLinkProject?: (page: NotionSyncedPage) => void;
}) {
  return (
    <div className="py-1">
      <div className="px-3 py-1.5">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
      </div>
      {pages.map(page => (
        <PageListItem
          key={page.id}
          id={page.notion_page_id}
          title={page.title}
          icon={page.icon}
          objectType={page.notion_object_type}
          url={page.url}
          lastEditedTime={page.last_edited_at}
          isPinned={isPinned}
          isLinked={page.project_id === projectId}
          onOpen={() => onOpen(page)}
          onTogglePin={() => onTogglePin(page)}
          projectId={projectId}
          onLinkProject={onLinkProject ? () => onLinkProject(page) : undefined}
        />
      ))}
    </div>
  );
}

// ─── Page List Item ─────────────────────────────────

function PageListItem({
  id, title, icon, objectType, url, lastEditedTime,
  isPinned, isLinked, onOpen, onTogglePin, projectId, onLinkProject,
}: {
  id: string;
  title: string;
  icon: string | null;
  objectType: string;
  url: string;
  lastEditedTime?: string | null;
  isPinned?: boolean;
  isLinked?: boolean;
  onOpen: () => void;
  onTogglePin?: () => void;
  projectId?: string;
  onLinkProject?: () => void;
}) {
  const timeAgo = lastEditedTime ? formatTimeAgo(new Date(lastEditedTime)) : '';

  return (
    <div className="group flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition" onClick={onOpen}>
      <PageIcon icon={icon} type={objectType} className="w-4 h-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm truncate">{title || 'Untitled'}</p>
          {objectType === 'database' && <Table2 className="w-3 h-3 text-muted-foreground shrink-0" />}
          {isLinked && <Link2 className="w-3 h-3 text-primary/60 shrink-0" />}
        </div>
        {timeAgo && <p className="text-[10px] text-muted-foreground">{timeAgo}</p>}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
        {onTogglePin && (
          <button onClick={e => { e.stopPropagation(); onTogglePin(); }} className="p-1 hover:bg-muted rounded" title={isPinned ? '고정 해제' : '고정'}>
            {isPinned ? <PinOff className="w-3 h-3 text-muted-foreground" /> : <Pin className="w-3 h-3 text-muted-foreground" />}
          </button>
        )}
        {onLinkProject && projectId && (
          <button onClick={e => { e.stopPropagation(); onLinkProject(); }} className="p-1 hover:bg-muted rounded" title={isLinked ? '프로젝트 연결 해제' : '프로젝트에 연결'}>
            {isLinked ? <Link2Off className="w-3 h-3 text-primary" /> : <Link2 className="w-3 h-3 text-muted-foreground" />}
          </button>
        )}
        <a href={url} target="_blank" rel="noopener" className="p-1 hover:bg-muted rounded" onClick={e => e.stopPropagation()} title="Notion에서 열기">
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>
      </div>
    </div>
  );
}

// ─── Time formatting ────────────────────────────────

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
