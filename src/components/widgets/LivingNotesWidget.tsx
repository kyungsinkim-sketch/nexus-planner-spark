/**
 * LivingNotesWidget — Evolving notes with thesis(정)/antithesis(반)/synthesis(합) timeline.
 * Replaces static important notes with living documents that grow through
 * project communication (chat, email, call, slack, notion).
 *
 * Design: Liquid glass style, typo-* classes, Bojagi accent colors.
 * Layout: 2-depth — list view → detail view with timeline.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Plus, ChevronLeft, Archive, Trash2, Edit3, Check, X,
  MessageSquare, Mail, Phone, Hash, FileText, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import * as livingNoteService from '@/services/livingNoteService';
import type { LivingNote, LivingNoteEntry } from '@/services/livingNoteService';
import type { WidgetDataContext } from '@/types/widget';

// ─── Visual Config ───

const ENTRY_TYPE_CONFIG = {
  thesis:     { label: '정', labelEn: 'Thesis',     color: 'text-[#2B4EC7]',   bg: 'bg-[#2B4EC7]/8',   border: 'border-[#2B4EC7]/20',   dot: 'bg-[#2B4EC7]' },
  antithesis: { label: '반', labelEn: 'Anti',       color: 'text-[#E8368F]',   bg: 'bg-[#E8368F]/8',   border: 'border-[#E8368F]/20',   dot: 'bg-[#E8368F]' },
  synthesis:  { label: '합', labelEn: 'Synth',      color: 'text-[#1DA06A]',   bg: 'bg-[#1DA06A]/8',   border: 'border-[#1DA06A]/20',   dot: 'bg-[#1DA06A]' },
  reference:  { label: '참고', labelEn: 'Ref',       color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border/30',       dot: 'bg-muted-foreground' },
};

const SOURCE_ICONS: Record<string, typeof MessageSquare> = {
  chat: MessageSquare, email: Mail, call: Phone, slack: Hash, notion: FileText, manual: Pencil,
};

const SOURCE_LABELS: Record<string, { ko: string; en: string }> = {
  chat: { ko: '채팅', en: 'Chat' },
  email: { ko: '이메일', en: 'Email' },
  call: { ko: '통화', en: 'Call' },
  slack: { ko: 'Slack', en: 'Slack' },
  notion: { ko: 'Notion', en: 'Notion' },
  manual: { ko: '직접 입력', en: 'Manual' },
};

// ─── Helpers ───

function formatTimeAgo(dateStr: string, ko: boolean) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return ko ? '방금' : 'now';
  if (mins < 60) return ko ? `${mins}분 전` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return ko ? `${hours}시간 전` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return ko ? `${days}일 전` : `${days}d ago`;
  const months = Math.floor(days / 30);
  return ko ? `${months}개월 전` : `${months}mo ago`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── Component ───

export default function LivingNotesWidget({ context }: { context?: WidgetDataContext; projectId?: string }) {
  const projectId = context?.type === 'project' ? context.projectId : undefined;
  const { currentUser } = useAppStore();
  const { t, language } = useTranslation();
  const ko = language === 'ko';

  const [notes, setNotes] = useState<LivingNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<LivingNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newState, setNewState] = useState('');

  // Add Entry
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryType, setEntryType] = useState<LivingNoteEntry['entryType']>('thesis');
  const [entryContent, setEntryContent] = useState('');
  const [entryNewState, setEntryNewState] = useState('');

  // Inline editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingState, setEditingState] = useState(false);
  const [editState, setEditState] = useState('');

  const loadNotes = useCallback(async () => {
    setLoading(true);
    const data = await livingNoteService.getLivingNotes(projectId);
    setNotes(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const openNoteDetail = useCallback(async (noteId: string) => {
    const note = await livingNoteService.getLivingNoteWithEntries(noteId);
    if (note) setSelectedNote(note);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || !currentUser) return;
    const note = await livingNoteService.createLivingNote({
      projectId: projectId || undefined,
      ownerId: currentUser.id,
      title: newTitle.trim(),
      currentState: newState.trim() || undefined,
    });
    if (note) {
      toast.success(ko ? '노트 생성됨' : 'Note created');
      setShowCreate(false);
      setNewTitle('');
      setNewState('');
      loadNotes();
    }
  }, [newTitle, newState, projectId, currentUser, ko, loadNotes]);

  const handleAddEntry = useCallback(async () => {
    if (!entryContent.trim() || !selectedNote || !currentUser) return;
    const entry = await livingNoteService.addEntry({
      livingNoteId: selectedNote.id,
      entryType,
      content: entryContent.trim(),
      sourceType: 'manual',
      createdBy: currentUser.id,
      newCurrentState: entryNewState.trim() || undefined,
    });
    if (entry) {
      toast.success(ko ? '기록 추가됨' : 'Entry added');
      setShowAddEntry(false);
      setEntryContent('');
      setEntryNewState('');
      setEntryType('thesis');
      openNoteDetail(selectedNote.id);
      loadNotes();
    }
  }, [entryContent, entryType, entryNewState, selectedNote, currentUser, ko, openNoteDetail, loadNotes]);

  const handleArchive = useCallback(async (noteId: string) => {
    await livingNoteService.updateLivingNote(noteId, { status: 'archived' });
    toast.success(ko ? '보관됨' : 'Archived');
    setSelectedNote(null);
    loadNotes();
  }, [ko, loadNotes]);

  const handleDelete = useCallback(async (noteId: string) => {
    await livingNoteService.deleteLivingNote(noteId);
    toast.success(ko ? '삭제됨' : 'Deleted');
    setSelectedNote(null);
    loadNotes();
  }, [ko, loadNotes]);

  const handleSaveTitle = useCallback(async () => {
    if (!selectedNote || !editTitle.trim()) return;
    await livingNoteService.updateLivingNote(selectedNote.id, { title: editTitle.trim() });
    setSelectedNote(prev => prev ? { ...prev, title: editTitle.trim() } : null);
    setEditingTitle(false);
    loadNotes();
  }, [selectedNote, editTitle, loadNotes]);

  const handleSaveState = useCallback(async () => {
    if (!selectedNote) return;
    await livingNoteService.updateLivingNote(selectedNote.id, { currentState: editState.trim() || null });
    setSelectedNote(prev => prev ? { ...prev, currentState: editState.trim() || null } : null);
    setEditingState(false);
    loadNotes();
  }, [selectedNote, editState, loadNotes]);

  // ═══════════════════════════════════════════
  //  DETAIL VIEW
  // ═══════════════════════════════════════════
  if (selectedNote) {
    const entryCount = selectedNote.entries?.length || 0;
    return (
      <div className="h-full flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
          <button onClick={() => setSelectedNote(null)}
            className="p-1 -ml-1 rounded-lg hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-1.5">
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  className="h-7 typo-label bg-transparent border-border/40" autoFocus />
                <button onClick={handleSaveTitle} className="p-1 rounded-md hover:bg-[#1DA06A]/15 transition-colors">
                  <Check className="w-3.5 h-3.5 text-[#1DA06A]" />
                </button>
                <button onClick={() => setEditingTitle(false)} className="p-1 rounded-md hover:bg-[#E8368F]/15 transition-colors">
                  <X className="w-3.5 h-3.5 text-[#E8368F]" />
                </button>
              </div>
            ) : (
              <h3 className="typo-label truncate cursor-pointer hover:text-[hsl(var(--primary))] transition-colors"
                onClick={() => { setEditTitle(selectedNote.title); setEditingTitle(true); }}>
                {selectedNote.title}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => handleArchive(selectedNote.id)}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title={ko ? '보관' : 'Archive'}>
              <Archive className="w-3.5 h-3.5 text-muted-foreground/60" />
            </button>
            <button onClick={() => handleDelete(selectedNote.id)}
              className="p-1.5 rounded-lg hover:bg-[#E8368F]/10 transition-colors" title={ko ? '삭제' : 'Delete'}>
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground/60" />
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* ── Current State Card ── */}
            <div className="rounded-xl p-3.5"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--primary) / 0.02))',
                border: '1px solid hsl(var(--primary) / 0.15)',
              }}>
              <div className="flex items-center justify-between mb-2">
                <span className="typo-overline text-[hsl(var(--primary))] opacity-70">
                  {ko ? '현재 결론' : 'CURRENT STATE'}
                </span>
                <button onClick={() => { setEditState(selectedNote.currentState || ''); setEditingState(true); }}
                  className="p-1 rounded-md hover:bg-white/5 transition-colors">
                  <Edit3 className="w-3 h-3 text-muted-foreground/40" />
                </button>
              </div>
              {editingState ? (
                <div className="space-y-2">
                  <Textarea value={editState} onChange={e => setEditState(e.target.value)}
                    className="typo-body-dense min-h-[60px] bg-transparent border-border/30 resize-none" autoFocus />
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-6 typo-micro rounded-md" onClick={handleSaveState}>
                      {ko ? '저장' : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 typo-micro rounded-md" onClick={() => setEditingState(false)}>
                      {ko ? '취소' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="typo-body-dense font-medium" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>
                  {selectedNote.currentState || (
                    <span className="text-muted-foreground/50 italic">
                      {ko ? '아직 결론이 없어요' : 'No conclusion yet'}
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* ── Add Entry Button ── */}
            <button onClick={() => setShowAddEntry(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border/40 text-muted-foreground/60 hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/5 transition-all typo-caption">
              <Plus className="w-3.5 h-3.5" />
              {ko ? '기록 추가' : 'Add Entry'}
            </button>

            {/* ── Timeline ── */}
            {entryCount > 0 && (
              <div>
                <span className="typo-overline text-muted-foreground/50 px-0.5">
                  {ko ? '히스토리' : 'HISTORY'} · {entryCount}
                </span>
                <div className="mt-2.5 relative">
                  {/* Timeline vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/30" />

                  <div className="space-y-3">
                    {selectedNote.entries!.map((entry) => {
                      const config = ENTRY_TYPE_CONFIG[entry.entryType];
                      const SourceIcon = entry.sourceType ? SOURCE_ICONS[entry.sourceType] || FileText : FileText;
                      const sourceLabel = entry.sourceLabel || (entry.sourceType ? (ko ? SOURCE_LABELS[entry.sourceType]?.ko : SOURCE_LABELS[entry.sourceType]?.en) : null);
                      return (
                        <div key={entry.id} className="flex gap-3 relative">
                          {/* Timeline dot */}
                          <div className={`w-[15px] h-[15px] rounded-full ${config.dot} shrink-0 mt-0.5 z-10 ring-2 ring-background`} />

                          {/* Content */}
                          <div className={`flex-1 min-w-0 rounded-xl ${config.bg} border ${config.border} p-3`}>
                            {/* Meta row */}
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`typo-micro font-bold ${config.color} tracking-wide`}>
                                {ko ? config.label : config.labelEn}
                              </span>
                              <span className="typo-micro text-muted-foreground/50">
                                {formatDate(entry.createdAt)}
                              </span>
                              {entry.sourceType && (
                                <span className="flex items-center gap-1 typo-micro text-muted-foreground/40">
                                  <SourceIcon className="w-2.5 h-2.5" />
                                  {sourceLabel}
                                </span>
                              )}
                            </div>
                            {/* Body */}
                            <p className="typo-widget-body" style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>
                              {entry.content}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {entryCount === 0 && (
              <div className="text-center py-4">
                <p className="typo-caption text-muted-foreground/40">
                  {ko ? '기록을 추가해 보세요' : 'Add your first entry'}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Add Entry Dialog ── */}
        <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="typo-h4">{ko ? '기록 추가' : 'Add Entry'}</DialogTitle>
              <DialogDescription className="typo-caption">{selectedNote.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Type Selector — pill style */}
              <div className="flex gap-1.5 p-1 rounded-xl bg-muted/30">
                {(Object.keys(ENTRY_TYPE_CONFIG) as Array<keyof typeof ENTRY_TYPE_CONFIG>).map(type => {
                  const cfg = ENTRY_TYPE_CONFIG[type];
                  const isActive = entryType === type;
                  return (
                    <button key={type} onClick={() => setEntryType(type)}
                      className={`flex-1 py-1.5 px-2 rounded-lg typo-caption font-medium transition-all ${
                        isActive
                          ? `${cfg.bg} ${cfg.color} shadow-sm`
                          : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/5'
                      }`}>
                      {ko ? cfg.label : cfg.labelEn}
                    </button>
                  );
                })}
              </div>

              <Textarea
                placeholder={ko ? '내용을 입력하세요...' : 'Enter content...'}
                value={entryContent} onChange={e => setEntryContent(e.target.value)}
                className="min-h-[100px] typo-body-dense bg-transparent border-border/30 resize-none rounded-xl" />

              <Input
                placeholder={ko ? '결론 업데이트 (선택사항)' : 'Update conclusion (optional)'}
                value={entryNewState} onChange={e => setEntryNewState(e.target.value)}
                className="typo-body-dense bg-transparent border-border/30 rounded-xl" />

              <Button className="w-full rounded-xl h-10 typo-label" onClick={handleAddEntry} disabled={!entryContent.trim()}>
                {ko ? '추가하기' : 'Add Entry'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  LIST VIEW
  // ═══════════════════════════════════════════
  return (
    <div className="h-full flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="typo-widget-title text-muted-foreground/70">Living Notes</span>
          {notes.length > 0 && (
            <span className="typo-micro text-muted-foreground/40 tabular-nums">{notes.length}</span>
          )}
        </div>
        <button onClick={() => setShowCreate(true)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <Plus className="w-4 h-4 text-muted-foreground/60" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-[hsl(var(--primary))]/20 border-t-[hsl(var(--primary))] rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-10 h-10 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-muted-foreground/30" />
            </div>
            <p className="typo-caption text-muted-foreground/50 text-center mb-3">
              {ko ? '프로젝트의 중요한 판단과 결정을\n살아있는 기록으로 남겨보세요' : 'Track important decisions as\nliving, evolving notes'}
            </p>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border/40 typo-caption text-muted-foreground/60 hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all">
              <Plus className="w-3.5 h-3.5" />
              {ko ? '첫 노트 만들기' : 'Create first note'}
            </button>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {notes.map(note => {
              const count = note.entryCount || 0;
              return (
                <button key={note.id}
                  onClick={() => openNoteDetail(note.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="typo-label truncate group-hover:text-[hsl(var(--primary))] transition-colors">
                        {note.title}
                      </p>
                      {note.currentState && (
                        <p className="typo-caption text-muted-foreground/50 mt-0.5 line-clamp-2"
                          style={{ overflowWrap: 'break-word', wordBreak: 'normal' }}>
                          {note.currentState}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                      {count > 0 && (
                        <span className="typo-micro text-muted-foreground/40 tabular-nums">
                          {count}{ko ? '회' : 'x'}
                        </span>
                      )}
                      <span className="typo-micro text-muted-foreground/30">
                        {formatTimeAgo(note.updatedAt, ko)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* ── Create Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="typo-h4">{ko ? '새 Living Note' : 'New Living Note'}</DialogTitle>
            <DialogDescription className="typo-caption">
              {ko ? '프로젝트에 살아있는 기록을 만들어요' : 'Create a living note for this project'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="typo-overline text-muted-foreground/50">{ko ? '제목' : 'TITLE'}</label>
              <Input
                placeholder={ko ? '예: 톤앤매너 방향' : 'e.g. Brand Direction'}
                value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleCreate(); }}
                className="typo-body-dense bg-transparent border-border/30 rounded-xl" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="typo-overline text-muted-foreground/50">{ko ? '초기 결론' : 'INITIAL STATE'}</label>
              <Textarea
                placeholder={ko ? '현재 결론이 있다면 입력하세요 (선택)' : 'Current conclusion if any (optional)'}
                value={newState} onChange={e => setNewState(e.target.value)}
                className="min-h-[60px] typo-body-dense bg-transparent border-border/30 resize-none rounded-xl" />
            </div>
            <Button className="w-full rounded-xl h-10 typo-label" onClick={handleCreate} disabled={!newTitle.trim()}>
              {ko ? '만들기' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
