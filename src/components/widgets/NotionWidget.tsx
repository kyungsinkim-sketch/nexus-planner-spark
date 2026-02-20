/**
 * NotionWidget — Notion workspace mini viewer with page browser.
 *
 * Shows:
 * - Connection status + connect button if not connected
 * - Workspace search bar
 * - Pinned/recent pages list
 * - Page content viewer (blocks → rendered markdown-like view)
 * - Quick actions: pin, open in Notion, sync
 *
 * Layout: Sidebar page list + content viewer.
 * Frameless mode — no WidgetContainer header.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
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
  ChevronRight,
  ChevronLeft,
  Database,
  FileText,
  Hash,
  CheckSquare,
  List,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  ArrowLeft,
  Settings,
  Unplug,
  Link2,
} from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';
import {
  isNotionConfigured,
  startNotionOAuth,
  getNotionStatus,
  searchNotionWorkspace,
  getNotionPageContent,
  getSyncedPages,
  syncNotionPages,
  togglePinPage,
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
          <span className="text-muted-foreground mt-1.5 text-[8px]">&#9679;</span>
          <div className="flex-1">
            <p className="text-sm">{renderRichText(richText)}</p>
            {children?.map((child, i) => <NotionBlockRenderer key={i} block={child} />)}
          </div>
        </div>
      );

    case 'numbered_list_item':
      return (
        <div className="flex gap-2 ml-2 mb-0.5">
          <span className="text-muted-foreground text-sm min-w-[16px]">1.</span>
          <div className="flex-1">
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
          <summary className="text-sm cursor-pointer hover:text-primary">
            {renderRichText(richText)}
          </summary>
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
        <a
          href={bookmarkUrl}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-2 p-2 my-1 rounded border bg-muted/30 hover:bg-muted/60 transition text-sm text-primary"
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{bookmarkUrl}</span>
        </a>
      );
    }

    default:
      // Unsupported block type — skip
      return null;
  }
}

// ─── Page Icon ──────────────────────────────────────

function PageIcon({ icon, type, className = 'w-4 h-4' }: { icon: string | null; type: string; className?: string }) {
  if (icon && !icon.startsWith('http')) {
    // Emoji icon
    return <span className="text-sm">{icon}</span>;
  }
  if (icon) {
    return <img src={icon} alt="" className={`${className} rounded`} />;
  }
  // Default icon based on type
  return type === 'database'
    ? <Database className={`${className} text-muted-foreground`} />
    : <FileText className={`${className} text-muted-foreground`} />;
}

// ─── Main Widget ────────────────────────────────────

export default function NotionWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const currentUser = useAppStore(s => s.currentUser);
  const userId = currentUser?.id || '';

  // State
  const [status, setStatus] = useState<NotionConnectionStatus>({ isConnected: false, syncStatus: 'DISCONNECTED' });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Navigation
  const [view, setView] = useState<'list' | 'page' | 'settings'>('list');
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
    const projectId = context.type === 'project' ? context.projectId : undefined;
    const pages = await getSyncedPages(userId, projectId);
    setSyncedPages(pages);
  }, [userId, context.type, context.projectId]);

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
    pageId: string,
    title: string,
    icon: string | null,
    url: string,
    cachedContent?: NotionPageContent | null,
  ) => {
    setSelectedPageId(pageId);
    setSelectedPageTitle(title);
    setSelectedPageIcon(icon);
    setSelectedPageUrl(url);
    setView('page');

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

  // ─── Pin/Unpin ────────────────────────────────────
  const handleTogglePin = useCallback(async (notionPageId: string, currentlyPinned: boolean) => {
    await togglePinPage(userId, notionPageId, !currentlyPinned);
    await loadSyncedPages();
  }, [userId, loadSyncedPages]);

  // ─── Disconnect ───────────────────────────────────
  const handleDisconnect = useCallback(async () => {
    await disconnectNotion(userId);
    setStatus({ isConnected: false, syncStatus: 'DISCONNECTED' });
    setView('list');
    setSyncedPages([]);
  }, [userId]);

  // ─── Connect button (not connected) ──────────────
  if (!loading && !status.isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 flex items-center justify-center">
          <BookOpen className="w-8 h-8 text-white dark:text-gray-900" />
        </div>
        <div>
          <h3 className="text-base font-semibold mb-1">{t('notionConnect')}</h3>
          <p className="text-xs text-muted-foreground max-w-[240px]">
            {t('notionConnectDesc')}
          </p>
        </div>
        {isNotionConfigured() ? (
          <button
            onClick={() => startNotionOAuth(userId)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
          >
            {t('notionConnectButton')}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground italic">{t('notionNotConfigured')}</p>
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
          <button onClick={() => setView('list')} className="p-1 hover:bg-muted rounded">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium">{t('notionSettings')}</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              {status.workspaceIcon
                ? <span className="text-lg">{status.workspaceIcon}</span>
                : <BookOpen className="w-5 h-5 text-muted-foreground" />
              }
            </div>
            <div>
              <p className="text-sm font-medium">{status.workspaceName || 'Notion'}</p>
              <p className="text-xs text-muted-foreground">{status.connectedEmail}</p>
            </div>
          </div>

          {status.lastSyncAt && (
            <p className="text-xs text-muted-foreground">
              {t('lastSync')}: {new Date(status.lastSyncAt).toLocaleString('ko-KR')}
            </p>
          )}

          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-sm w-full"
          >
            <Unplug className="w-4 h-4" />
            {t('notionDisconnect')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Page viewer ──────────────────────────────────
  if (view === 'page' && selectedPageId) {
    return (
      <div className="h-full flex flex-col">
        {/* Page header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b min-h-[40px]">
          <button
            onClick={() => { setView('list'); setSelectedPageId(null); setPageContent(null); }}
            className="p-1 hover:bg-muted rounded shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <PageIcon icon={selectedPageIcon} type="page" />
          <span className="text-sm font-medium truncate flex-1">{selectedPageTitle}</span>
          <a
            href={selectedPageUrl}
            target="_blank"
            rel="noopener"
            className="p-1 hover:bg-muted rounded shrink-0"
            title={t('openInNotion')}
          >
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </a>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingContent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : pageContent?.blocks?.length ? (
            <div className="space-y-0.5">
              {(pageContent.blocks as Array<Record<string, unknown>>).map((block, i) => (
                <NotionBlockRenderer key={block.id as string || i} block={block} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('notionEmptyPage')}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── Main list view ───────────────────────────────
  const pinnedPages = syncedPages.filter(p => p.is_pinned);
  const recentPages = syncedPages.filter(p => !p.is_pinned).slice(0, 10);
  const showSearchResults = searchQuery.trim().length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1 truncate">
          {status.workspaceName || 'Notion'}
        </span>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="p-1 hover:bg-muted rounded shrink-0"
          title={t('sync')}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${syncing ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => setView('settings')}
          className="p-1 hover:bg-muted rounded shrink-0"
          title={t('settings')}
        >
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
            placeholder={t('notionSearchPlaceholder')}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border bg-muted/30 focus:bg-background focus:ring-1 focus:ring-primary/30 outline-none transition"
          />
          {searching && (
            <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showSearchResults ? (
          // Search results
          <div className="py-1">
            {searchResults.length === 0 && !searching ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t('noResults')}
              </p>
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
                  onOpen={() => openPage(item.id, item.title, item.icon, item.url)}
                />
              ))
            )}
          </div>
        ) : (
          <>
            {/* Pinned pages */}
            {pinnedPages.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('notionPinned')}
                  </span>
                </div>
                {pinnedPages.map(page => (
                  <PageListItem
                    key={page.id}
                    id={page.notion_page_id}
                    title={page.title}
                    icon={page.icon}
                    objectType={page.notion_object_type}
                    url={page.url}
                    lastEditedTime={page.last_edited_at}
                    isPinned
                    onOpen={() => openPage(
                      page.notion_page_id,
                      page.title,
                      page.icon,
                      page.url,
                      page.cached_content as NotionPageContent | null,
                    )}
                    onTogglePin={() => handleTogglePin(page.notion_page_id, true)}
                  />
                ))}
              </div>
            )}

            {/* Recent pages */}
            {recentPages.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('notionRecent')}
                  </span>
                </div>
                {recentPages.map(page => (
                  <PageListItem
                    key={page.id}
                    id={page.notion_page_id}
                    title={page.title}
                    icon={page.icon}
                    objectType={page.notion_object_type}
                    url={page.url}
                    lastEditedTime={page.last_edited_at}
                    onOpen={() => openPage(
                      page.notion_page_id,
                      page.title,
                      page.icon,
                      page.url,
                      page.cached_content as NotionPageContent | null,
                    )}
                    onTogglePin={() => handleTogglePin(page.notion_page_id, false)}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {syncedPages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-3">
                <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t('notionEmptyState')}</p>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="text-xs text-primary hover:underline"
                  >
                    {syncing ? t('syncing') : t('notionSyncNow')}
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

// ─── Page List Item ─────────────────────────────────

function PageListItem({
  id,
  title,
  icon,
  objectType,
  url,
  lastEditedTime,
  isPinned,
  onOpen,
  onTogglePin,
}: {
  id: string;
  title: string;
  icon: string | null;
  objectType: string;
  url: string;
  lastEditedTime?: string | null;
  isPinned?: boolean;
  onOpen: () => void;
  onTogglePin?: () => void;
}) {
  const { t } = useTranslation();

  const timeAgo = lastEditedTime
    ? formatTimeAgo(new Date(lastEditedTime))
    : '';

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer transition"
      onClick={onOpen}
    >
      <PageIcon icon={icon} type={objectType} className="w-4 h-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{title || 'Untitled'}</p>
        {timeAgo && (
          <p className="text-[10px] text-muted-foreground">{timeAgo}</p>
        )}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
        {onTogglePin && (
          <button
            onClick={e => { e.stopPropagation(); onTogglePin(); }}
            className="p-1 hover:bg-muted rounded"
            title={isPinned ? t('unpin') : t('pin')}
          >
            {isPinned
              ? <PinOff className="w-3 h-3 text-muted-foreground" />
              : <Pin className="w-3 h-3 text-muted-foreground" />
            }
          </button>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="p-1 hover:bg-muted rounded"
          onClick={e => e.stopPropagation()}
          title={t('openInNotion')}
        >
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
