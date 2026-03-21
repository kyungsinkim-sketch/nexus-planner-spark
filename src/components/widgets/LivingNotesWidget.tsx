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
  Plus, ChevronLeft, Pin, Archive, Trash2, Edit3, Check, X,
  MessageSquare, Mail, Phone, Hash, FileText, Pencil,
  CircleDot, AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import * as livingNoteService from '@/services/livingNoteService';
import type { LivingNote, LivingNoteEntry } from '@/services/livingNoteService';

const ENTRY_TYPE_CONFIG = {
  thesis:     { label: '정', color: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-blue-500/30',   icon: CircleDot },
  antithesis: { label: '반', color: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/30',    icon: AlertTriangle },
  synthesis:  { label: '합', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', icon: CheckCircle2 },
  reference:  { label: '참고', color: 'text-zinc-400',  bg: 'bg-zinc-500/15',   border: 'border-zinc-500/30',   icon: Info },
};

const SOURCE_ICONS: Record<string, typeof MessageSquare> = {
  chat: MessageSquare, email: Mail, call: Phone, slack: Hash, notion: FileText, manual: Pencil,
};

interface Props {
  projectId: string;
}

export default function LivingNotesWidget({ projectId }: Props) {
  const { currentUser } = useAppStore();
  const { t, language } = useTranslation();
  const [notes, setNotes] = useState<LivingNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<LivingNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newState, setNewState] = useState('');

  // ─── Add Entry Dialog ───
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryType, setEntryType] = useState<LivingNoteEntry['entryType']>('thesis');
  const [entryContent, setEntryContent] = useState('');
  const [entryNewState, setEntryNewState] = useState('');

  // ─── Edit title/state ───
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
      projectId,
      ownerId: currentUser.id,
      title: newTitle.trim(),
      currentState: newState.trim() || undefined,
    });
    if (note) {
      toast.success(language === 'ko' ? '노트 생성됨' : 'Note created');
      setShowCreate(false);
      setNewTitle('');
      setNewState('');
      loadNotes();
    }
  }, [newTitle, newState, projectId, currentUser, language, loadNotes]);

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
      toast.success(language === 'ko' ? '기록 추가됨' : 'Entry added');
      setShowAddEntry(false);
      setEntryContent('');
      setEntryNewState('');
      openNoteDetail(selectedNote.id);
      loadNotes();
    }
  }, [entryContent, entryType, entryNewState, selectedNote, currentUser, language, openNoteDetail, loadNotes]);

  const handleArchive = useCallback(async (noteId: string) => {
    await livingNoteService.updateLivingNote(noteId, { status: 'archived' });
    toast.success(language === 'ko' ? '보관됨' : 'Archived');
    setSelectedNote(null);
    loadNotes();
  }, [language, loadNotes]);

  const handleDelete = useCallback(async (noteId: string) => {
    await livingNoteService.deleteLivingNote(noteId);
    toast.success(language === 'ko' ? '삭제됨' : 'Deleted');
    setSelectedNote(null);
    loadNotes();
  }, [language, loadNotes]);

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

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return language === 'ko' ? `${mins}분 전` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return language === 'ko' ? `${hours}시간 전` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return language === 'ko' ? `${days}일 전` : `${days}d ago`;
  };

  // ─── Detail View ───
  if (selectedNote) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
          <button onClick={() => setSelectedNote(null)} className="p-1 hover:bg-muted rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-1">
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  className="h-7 text-sm" autoFocus />
                <button onClick={handleSaveTitle} className="p-1 hover:bg-green-500/20 rounded"><Check className="w-3.5 h-3.5 text-green-400" /></button>
                <button onClick={() => setEditingTitle(false)} className="p-1 hover:bg-red-500/20 rounded"><X className="w-3.5 h-3.5 text-red-400" /></button>
              </div>
            ) : (
              <h3 className="text-sm font-semibold truncate cursor-pointer hover:text-primary"
                onClick={() => { setEditTitle(selectedNote.title); setEditingTitle(true); }}>
                📌 {selectedNote.title}
              </h3>
            )}
          </div>
          <button onClick={() => handleArchive(selectedNote.id)} className="p-1.5 hover:bg-muted rounded" title={language === 'ko' ? '보관' : 'Archive'}>
            <Archive className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => handleDelete(selectedNote.id)} className="p-1.5 hover:bg-red-500/10 rounded" title={language === 'ko' ? '삭제' : 'Delete'}>
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Current State */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-primary/70">
                  💡 {language === 'ko' ? '현재 결론' : 'Current State'}
                </span>
                <button onClick={() => { setEditState(selectedNote.currentState || ''); setEditingState(true); }}
                  className="p-0.5 hover:bg-primary/10 rounded">
                  <Edit3 className="w-3 h-3 text-primary/50" />
                </button>
              </div>
              {editingState ? (
                <div className="space-y-2">
                  <Textarea value={editState} onChange={e => setEditState(e.target.value)}
                    className="text-sm min-h-[60px]" autoFocus />
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleSaveState}>
                      {language === 'ko' ? '저장' : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingState(false)}>
                      {language === 'ko' ? '취소' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-medium">
                  {selectedNote.currentState || (language === 'ko' ? '아직 결론 없음' : 'No conclusion yet')}
                </p>
              )}
            </div>

            {/* Add Entry Button */}
            <Button size="sm" variant="outline" className="w-full text-xs gap-1.5 h-8"
              onClick={() => setShowAddEntry(true)}>
              <Plus className="w-3.5 h-3.5" />
              {language === 'ko' ? '기록 추가' : 'Add Entry'}
            </Button>

            {/* Timeline */}
            <div className="space-y-0">
              <span className="text-xs font-medium text-muted-foreground px-1">
                {language === 'ko' ? '히스토리' : 'History'}
              </span>
              {selectedNote.entries && selectedNote.entries.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {selectedNote.entries.map((entry) => {
                    const config = ENTRY_TYPE_CONFIG[entry.entryType];
                    const Icon = config.icon;
                    const SourceIcon = entry.sourceType ? SOURCE_ICONS[entry.sourceType] || Info : Info;
                    return (
                      <div key={entry.id} className={`rounded-lg border ${config.border} ${config.bg} p-3`}>
                        <div className="flex items-start gap-2">
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-xs font-bold ${config.color}`}>[{config.label}]</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(entry.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                              </span>
                              {entry.sourceType && (
                                <span className="flex items-center gap-0.5 text-xs text-muted-foreground/70">
                                  <SourceIcon className="w-3 h-3" />
                                  {entry.sourceLabel || entry.sourceType}
                                </span>
                              )}
                            </div>
                            <p className="text-sm">{entry.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-2 px-1">
                  {language === 'ko' ? '아직 기록이 없어요' : 'No entries yet'}
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Add Entry Dialog */}
        <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{language === 'ko' ? '기록 추가' : 'Add Entry'}</DialogTitle>
              <DialogDescription>{selectedNote.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {/* Entry Type Selector */}
              <div className="flex gap-1.5">
                {(Object.keys(ENTRY_TYPE_CONFIG) as Array<keyof typeof ENTRY_TYPE_CONFIG>).map(type => {
                  const cfg = ENTRY_TYPE_CONFIG[type];
                  const isActive = entryType === type;
                  return (
                    <button key={type} onClick={() => setEntryType(type)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        isActive ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'border-border/50 text-muted-foreground hover:bg-muted'
                      }`}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              <Textarea placeholder={language === 'ko' ? '내용...' : 'Content...'}
                value={entryContent} onChange={e => setEntryContent(e.target.value)}
                className="min-h-[80px]" />
              <Input placeholder={language === 'ko' ? '결론 업데이트 (선택)' : 'Update conclusion (optional)'}
                value={entryNewState} onChange={e => setEntryNewState(e.target.value)} />
              <Button className="w-full" onClick={handleAddEntry} disabled={!entryContent.trim()}>
                {language === 'ko' ? '추가' : 'Add'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── List View ───
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-semibold">
          📌 {language === 'ko' ? 'Living Notes' : 'Living Notes'}
        </h3>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-muted-foreground">
              {language === 'ko' ? '아직 노트가 없어요' : 'No notes yet'}
            </p>
            <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => setShowCreate(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              {language === 'ko' ? '첫 노트 만들기' : 'Create first note'}
            </Button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {notes.map(note => (
              <button key={note.id}
                onClick={() => openNoteDetail(note.id)}
                className="w-full text-left p-3 rounded-xl hover:bg-muted/50 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{note.title}</span>
                      {note.status === 'resolved' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                    {note.currentState && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">"{note.currentState}"</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {(note.entryCount || 0) > 0 && (
                      <span className="text-xs text-muted-foreground/70">
                        {note.entryCount}{language === 'ko' ? '회' : 'x'}
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground/50">{formatTimeAgo(note.updatedAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{language === 'ko' ? '새 Living Note' : 'New Living Note'}</DialogTitle>
            <DialogDescription>{language === 'ko' ? '프로젝트에 새 노트를 만듭니다' : 'Create a new note for this project'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder={language === 'ko' ? '제목 (예: 톤앤매너 방향)' : 'Title (e.g. Brand Direction)'}
              value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} autoFocus />
            <Textarea placeholder={language === 'ko' ? '초기 결론 (선택)' : 'Initial conclusion (optional)'}
              value={newState} onChange={e => setNewState(e.target.value)}
              className="min-h-[60px]" />
            <Button className="w-full" onClick={handleCreate} disabled={!newTitle.trim()}>
              {language === 'ko' ? '만들기' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
