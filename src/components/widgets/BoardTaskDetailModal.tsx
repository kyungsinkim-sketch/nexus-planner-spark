/**
 * BoardTaskDetailModal — Task detail view with title edit, description, and comments.
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/stores/appStore';
import { X, Send, Trash2, MessageCircle, FileText } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import * as boardService from '@/services/boardService';
import type { BoardTask, User } from '@/types/core';

interface Props {
  task: BoardTask;
  users: User[];
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<BoardTask>) => void;
}

export default function BoardTaskDetailModal({ task, users, onClose, onUpdate }: Props) {
  const { language } = useTranslation();
  const currentUser = useAppStore(s => s.currentUser);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [comments, setComments] = useState<boardService.TaskCommentRow[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Load comments
  useEffect(() => {
    boardService.getTaskComments(task.id).then(c => {
      setComments(c);
      setLoadingComments(false);
    }).catch(() => setLoadingComments(false));
  }, [task.id]);

  // Auto-scroll to bottom on new comment
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const saveTitle = () => {
    if (title.trim() && title !== task.title) {
      onUpdate(task.id, { title: title.trim() });
      boardService.updateBoardTask(task.id, { title: title.trim() }).catch(() => toast.error('Failed to update title'));
    }
    setIsEditingTitle(false);
  };

  const saveDescription = () => {
    if (description !== (task.description || '')) {
      onUpdate(task.id, { description });
      boardService.updateBoardTask(task.id, { description }).catch(() => toast.error('Failed to update description'));
    }
    setIsEditingDesc(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return;
    try {
      const comment = await boardService.addTaskComment(task.id, currentUser.id, newComment.trim());
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch {
      toast.error('Failed to add comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await boardService.deleteTaskComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  const getUser = (userId: string) => users.find(u => u.id === userId);
  const owner = getUser(task.ownerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 max-h-[85vh] bg-background rounded-2xl border shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {owner && (
              <Avatar className="w-7 h-7 shrink-0">
                {owner.avatar && <AvatarImage src={owner.avatar} />}
                <AvatarFallback className="text-xs bg-primary/10 text-primary">{owner.name.slice(-2)}</AvatarFallback>
              </Avatar>
            )}
            <span className="text-xs text-muted-foreground truncate">{owner?.name}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Title */}
          <div>
            {isEditingTitle ? (
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(task.title); setIsEditingTitle(false); } }}
                className="text-lg font-semibold"
                autoFocus
              />
            ) : (
              <h2
                className="text-lg font-semibold cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors"
                onClick={() => setIsEditingTitle(true)}
              >
                {task.title}
              </h2>
            )}
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              {language === 'ko' ? '상세 내용' : 'Description'}
            </div>
            {isEditingDesc ? (
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={saveDescription}
                className="w-full min-h-[120px] p-3 text-sm bg-muted/30 border rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={language === 'ko' ? '상세 내용을 입력하세요...' : 'Add a description...'}
                autoFocus
              />
            ) : (
              <div
                className="w-full min-h-[60px] p-3 text-sm bg-muted/20 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors whitespace-pre-wrap"
                onClick={() => setIsEditingDesc(true)}
              >
                {description || (
                  <span className="text-muted-foreground italic">
                    {language === 'ko' ? '클릭하여 상세 내용 추가...' : 'Click to add description...'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Info row */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            {task.startDate && <span>{language === 'ko' ? '시작' : 'Start'}: {task.startDate}</span>}
            {task.endDate && <span>{language === 'ko' ? '마감' : 'End'}: {task.endDate}</span>}
            <span>{language === 'ko' ? '진행' : 'Progress'}: {task.progress}%</span>
          </div>

          {/* Comments */}
          <div>
            <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
              <MessageCircle className="w-3.5 h-3.5" />
              {language === 'ko' ? '댓글' : 'Comments'} ({comments.length})
            </div>

            {loadingComments ? (
              <p className="text-xs text-muted-foreground">{language === 'ko' ? '로딩...' : 'Loading...'}</p>
            ) : (
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {comments.map(c => {
                  const commenter = getUser(c.user_id);
                  const isMine = c.user_id === currentUser?.id;
                  return (
                    <div key={c.id} className="flex gap-2 group">
                      <Avatar className="w-6 h-6 shrink-0 mt-0.5">
                        {commenter?.avatar && <AvatarImage src={commenter.avatar} />}
                        <AvatarFallback className="text-[10px] bg-muted">{commenter?.name?.slice(-2) || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{commenter?.name || 'Unknown'}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {(() => { try { return format(parseISO(c.created_at), 'MM/dd HH:mm'); } catch { return ''; } })()}
                          </span>
                          {isMine && (
                            <button onClick={() => handleDeleteComment(c.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-500">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={commentsEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Comment input */}
        <div className="border-t px-5 py-3 flex gap-2">
          <Input
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
            placeholder={language === 'ko' ? '댓글 입력...' : 'Write a comment...'}
            className="text-sm"
          />
          <Button size="icon" variant="ghost" onClick={handleAddComment} disabled={!newComment.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
