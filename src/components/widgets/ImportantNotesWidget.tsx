/**
 * ImportantNotesWidget — Displays important notes for a project.
 *
 * Notes are auto-extracted from chat when keywords like '중요한', '기억해주세요'
 * are detected. Users can also manually add notes via the + button.
 * Supports title + content separation. Shift+Enter for newline in content.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { StickyNote, X, MessageSquare, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WidgetDataContext } from '@/types/widget';

function ImportantNotesWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const {
    importantNotes, addImportantNote, removeImportantNote, updateImportantNote,
    currentUser, getUserById,
    importantNoteAddOpen, setImportantNoteAddOpen,
  } = useAppStore();
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const editContentRef = useRef<HTMLTextAreaElement>(null);

  const projectId = context.projectId || '';

  const notes = useMemo(() => {
    return importantNotes
      .filter((n) => n.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [importantNotes, projectId]);

  useEffect(() => {
    if (importantNoteAddOpen) {
      // Focus will be handled by autoFocus on title input
    }
  }, [importantNoteAddOpen]);

  const handleAdd = () => {
    const title = newTitle.trim();
    const content = newContent.trim();
    if ((!title && !content) || !currentUser || !projectId) return;
    addImportantNote({
      projectId,
      title: title || undefined,
      content: content || title, // fallback: if only title, use as content
      createdBy: currentUser.id,
    });
    setNewTitle('');
    setNewContent('');
    setImportantNoteAddOpen(false);
  };

  const startEditing = (note: typeof notes[0]) => {
    setEditingNoteId(note.id);
    setEditTitle(note.title || '');
    setEditContent(note.content || '');
    setExpandedNoteId(note.id);
    setTimeout(() => editContentRef.current?.focus(), 50);
  };

  const saveEdit = () => {
    if (!editingNoteId) return;
    const title = editTitle.trim();
    const content = editContent.trim();
    if (!title && !content) return;
    updateImportantNote(editingNoteId, {
      title: title || '',
      content: content || title || '',
    });
    setEditingNoteId(null);
    setEditTitle('');
    setEditContent('');
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setEditTitle('');
    setEditContent('');
  };

  const handleEditContentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === 'Escape') cancelEdit();
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      contentRef.current?.focus();
    }
    if (e.key === 'Escape') {
      setImportantNoteAddOpen(false);
      setNewTitle('');
      setNewContent('');
    }
  };

  const handleContentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Escape') {
      setImportantNoteAddOpen(false);
      setNewTitle('');
      setNewContent('');
    }
  };

  return (
    <div className="h-full flex flex-col p-3 gap-2">
      {/* Input area */}
      {importantNoteAddOpen && (
        <div className="flex flex-col gap-1.5 shrink-0">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            placeholder={t('noteTitle') || '제목'}
            className="h-7 text-xs font-medium"
            autoFocus
          />
          <Textarea
            ref={contentRef}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={handleContentKeyDown}
            placeholder={t('noteContentPlaceholder') || '내용 (Shift+Enter로 줄바꿈)'}
            className="text-xs min-h-[48px] max-h-[120px] resize-none"
            rows={2}
          />
          <div className="flex gap-1.5 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => { setImportantNoteAddOpen(false); setNewTitle(''); setNewContent(''); }}
            >
              {t('cancel') || '취소'}
            </Button>
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleAdd}
              disabled={!newTitle.trim() && !newContent.trim()}
            >
              {t('add')}
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <ScrollArea className="flex-1 min-h-0">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-2 py-8">
            <StickyNote className="w-8 h-8" />
            <p className="text-xs text-center">{t('noImportantNotes')}</p>
            <p className="text-xs font-medium text-center max-w-[200px]">{t('importantNotesHint')}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {notes.map((note) => {
              const creator = getUserById(note.createdBy);
              const isExpanded = expandedNoteId === note.id;
              const isEditing = editingNoteId === note.id;
              const hasTitle = !!note.title;
              const contentLines = note.content?.split('\n') || [];
              const isLong = contentLines.length > 2 || note.content.length > 100;

              if (isEditing) {
                return (
                  <div key={note.id} className="flex flex-col gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editContentRef.current?.focus(); } if (e.key === 'Escape') cancelEdit(); }}
                      placeholder={t('noteTitle') || '제목'}
                      className="h-7 text-xs font-medium"
                      autoFocus
                    />
                    <Textarea
                      ref={editContentRef}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={handleEditContentKeyDown}
                      placeholder={t('noteContentPlaceholder') || '내용 (Shift+Enter로 줄바꿈)'}
                      className="text-xs min-h-[48px] max-h-[120px] resize-none"
                      rows={3}
                    />
                    <div className="flex gap-1.5 justify-end">
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={cancelEdit}>
                        {t('cancel') || '취소'}
                      </Button>
                      <Button size="sm" className="h-6 px-2 text-xs" onClick={saveEdit} disabled={!editTitle.trim() && !editContent.trim()}>
                        <Check className="w-3 h-3 mr-1" />
                        {t('save') || '저장'}
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={note.id}
                  className="group relative flex flex-col p-2 rounded-lg bg-amber-500/5 border border-amber-500/15 hover:border-amber-500/30 transition-colors cursor-pointer"
                  onClick={() => isLong && setExpandedNoteId(isExpanded ? null : note.id)}
                  onDoubleClick={(e) => { e.stopPropagation(); startEditing(note); }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {hasTitle && (
                        <p className="typo-widget-body font-semibold text-foreground leading-snug mb-0.5">{note.title}</p>
                      )}
                      <p className={`typo-widget-sub text-foreground/80 leading-relaxed break-words whitespace-pre-wrap ${
                        !isExpanded && isLong ? 'line-clamp-2' : ''
                      }`}>
                        {note.content}
                      </p>
                      {isLong && (
                        <button className="text-xs font-medium text-amber-600/70 hover:text-amber-600 mt-0.5 flex items-center gap-0.5">
                          {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                          {isExpanded ? (t('collapse') || '접기') : (t('expand') || '더보기')}
                        </button>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="typo-caption text-muted-foreground">
                          {creator?.name || note.createdBy}
                        </span>
                        <span className="typo-caption text-muted-foreground/50">·</span>
                        <span className="typo-caption text-muted-foreground">
                          {new Date(note.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </span>
                        {note.sourceMessageId && (
                          <>
                            <span className="typo-caption text-muted-foreground/50">·</span>
                            <span className="typo-caption text-muted-foreground flex items-center gap-0.5">
                              <MessageSquare className="w-2.5 h-2.5" />
                              {t('fromChat')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0 self-start">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditing(note); }}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-amber-500/20 transition-all"
                        title={t('editNote') || '수정'}
                      >
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeImportantNote(note.id); }}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-all"
                        title={t('removeNote')}
                      >
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default ImportantNotesWidget;
