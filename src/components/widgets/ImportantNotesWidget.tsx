/**
 * ImportantNotesWidget — Displays important notes for a project.
 *
 * Notes are auto-extracted from chat when keywords like '중요한', '기억해주세요'
 * are detected. Text-only items with no dates — persist through project lifetime.
 * Users can also manually add/remove notes.
 */

import { useState, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { StickyNote, X, Plus, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WidgetDataContext } from '@/types/widget';

function ImportantNotesWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const { importantNotes, addImportantNote, removeImportantNote, currentUser, getUserById } = useAppStore();
  const [newNote, setNewNote] = useState('');
  const [showInput, setShowInput] = useState(false);

  const projectId = context.projectId || '';

  const notes = useMemo(() => {
    return importantNotes
      .filter((n) => n.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [importantNotes, projectId]);

  const handleAdd = () => {
    if (!newNote.trim() || !currentUser || !projectId) return;
    addImportantNote({
      projectId,
      content: newNote.trim(),
      createdBy: currentUser.id,
    });
    setNewNote('');
    setShowInput(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Escape') {
      setShowInput(false);
      setNewNote('');
    }
  };

  return (
    <div className="h-full flex flex-col p-3 gap-2">
      {/* Header with add button */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <StickyNote className="w-3.5 h-3.5" />
          <span>{notes.length} {t('importantNotesCount')}</span>
        </div>
        {!showInput && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setShowInput(true)}
          >
            <Plus className="w-3 h-3 mr-1" />
            {t('addNote')}
          </Button>
        )}
      </div>

      {/* Input area */}
      {showInput && (
        <div className="flex gap-1.5 shrink-0">
          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('importantNotePlaceholder')}
            className="h-7 text-xs flex-1"
            autoFocus
          />
          <Button size="sm" className="h-7 px-2" onClick={handleAdd} disabled={!newNote.trim()}>
            {t('add')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1.5"
            onClick={() => { setShowInput(false); setNewNote(''); }}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Notes list */}
      <ScrollArea className="flex-1 min-h-0">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-2 py-8">
            <StickyNote className="w-8 h-8" />
            <p className="text-xs text-center">{t('noImportantNotes')}</p>
            <p className="text-[10px] text-center max-w-[200px]">{t('importantNotesHint')}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {notes.map((note) => {
              const creator = getUserById(note.createdBy);
              return (
                <div
                  key={note.id}
                  className="group relative flex gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/15 hover:border-amber-500/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-relaxed break-words">{note.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {creator?.name || note.createdBy}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(note.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                      {note.sourceMessageId && (
                        <>
                          <span className="text-[10px] text-muted-foreground/50">·</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <MessageSquare className="w-2.5 h-2.5" />
                            {t('fromChat')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeImportantNote(note.id)}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-all shrink-0 self-start"
                    title={t('removeNote')}
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
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
