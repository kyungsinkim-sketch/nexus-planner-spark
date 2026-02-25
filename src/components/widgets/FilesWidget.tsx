/**
 * FilesWidget — Flat file list with type icons and descriptions.
 * Inline delete button per row.
 * Click opens preview popup with threaded comments (user-attributed).
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import {
  getFileDownloadUrl,
  getFileComments,
  createFileComment,
  subscribeToFileItems,
  subscribeToFileComments,
} from '@/services/fileService';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useTranslation } from '@/hooks/useTranslation';
import {
  FileText, Image, FileSpreadsheet, Presentation, Film,
  FileArchive, File, Music, Code, Download, Trash2,
  MessageSquare, X, Eye, Send,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MentionTextarea } from '@/components/ui/mention-textarea';
import { toast } from 'sonner';
import type { FileItem, FileComment } from '@/types/core';
import type { WidgetDataContext } from '@/types/widget';

function getFileInfo(fileName: string, fileType?: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (/^(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)$/.test(ext) || fileType?.startsWith('image'))
    return { icon: Image, label: 'Image', color: 'text-emerald-500', previewable: true };
  if (ext === 'pdf' || fileType === 'application/pdf')
    return { icon: FileText, label: 'PDF', color: 'text-red-500', previewable: true };
  if (/^(ppt|pptx|key|odp)$/.test(ext))
    return { icon: Presentation, label: 'Presentation', color: 'text-orange-500', previewable: false };
  if (/^(xls|xlsx|csv|numbers|ods)$/.test(ext))
    return { icon: FileSpreadsheet, label: 'Spreadsheet', color: 'text-green-600', previewable: false };
  if (/^(doc|docx|txt|rtf|odt|pages|md)$/.test(ext))
    return { icon: FileText, label: 'Document', color: 'text-blue-500', previewable: false };
  if (/^(mp4|mov|avi|mkv|wmv|flv|webm)$/.test(ext) || fileType?.startsWith('video'))
    return { icon: Film, label: 'Video', color: 'text-violet-500', previewable: false };
  if (/^(mp3|wav|aac|flac|ogg|wma|m4a)$/.test(ext) || fileType?.startsWith('audio'))
    return { icon: Music, label: 'Audio', color: 'text-pink-500', previewable: false };
  if (/^(zip|rar|7z|tar|gz|bz2)$/.test(ext))
    return { icon: FileArchive, label: 'Archive', color: 'text-amber-600', previewable: false };
  if (/^(js|ts|tsx|jsx|py|rb|go|rs|java|c|cpp|h|css|html|json|xml|yaml|yml|sh)$/.test(ext))
    return { icon: Code, label: 'Code', color: 'text-cyan-500', previewable: false };
  return { icon: File, label: ext.toUpperCase() || 'File', color: 'text-muted-foreground', previewable: false };
}

function isImageFile(fileName: string, fileType?: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return /^(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)$/.test(ext) || fileType?.startsWith('image');
}

function isPdfFile(fileName: string, fileType?: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ext === 'pdf' || fileType === 'application/pdf';
}

function getFileUrl(storagePath?: string): string | null {
  if (!storagePath || !isSupabaseConfigured()) return null;
  try { return getFileDownloadUrl(storagePath); } catch { return null; }
}

function formatSize(size?: string) {
  if (!size) return '';
  if (/[A-Za-z]/.test(size)) return size;
  const bytes = parseInt(size, 10);
  if (isNaN(bytes)) return size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilesWidget({ context }: { context: WidgetDataContext }) {
  const { fileGroups, files, loadFileGroups, currentUser, users, projects, messages } = useAppStore();
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileComments, setFileComments] = useState<FileComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Load file groups on mount / when project context changes
  // Also clear selected file when switching projects to prevent stale data
  useEffect(() => {
    if (context.type === 'project' && context.projectId) {
      loadFileGroups(context.projectId).catch(() => {});
    }
    setSelectedFile(null); // Clear selection on project change
  }, [context.type, context.projectId, loadFileGroups]);

  // ─── Realtime: file_items changes (INSERT/DELETE across users) ───
  // Re-subscribe when project context changes to ensure proper cleanup
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const unsub = subscribeToFileItems(
      // onInsert — another user uploaded a file
      (newFile) => {
        useAppStore.setState((state) => {
          if (state.files.some((f) => f.id === newFile.id)) return state;
          return { files: [...state.files, newFile] };
        });
      },
      // onUpdate — another user changed file metadata
      (updatedFile) => {
        useAppStore.setState((state) => ({
          files: state.files.map((f) => f.id === updatedFile.id ? updatedFile : f),
        }));
      },
      // onDelete — another user deleted a file
      (deletedId) => {
        useAppStore.setState((state) => ({
          files: state.files.filter((f) => f.id !== deletedId),
        }));
        setSelectedFile((prev) => prev?.id === deletedId ? null : prev);
      },
    );

    return unsub;
  }, [context.projectId]); // Re-subscribe on project change for proper cleanup

  // ─── Load comments from DB when a file is selected ───
  useEffect(() => {
    if (!selectedFile || !isSupabaseConfigured()) {
      setFileComments([]);
      return;
    }

    let cancelled = false;

    // Fetch existing comments
    getFileComments(selectedFile.id)
      .then((comments) => { if (!cancelled) setFileComments(comments); })
      .catch((err) => console.error('Failed to load comments:', err));

    // Subscribe to realtime comment changes
    const unsub = subscribeToFileComments(
      selectedFile.id,
      (newComment) => {
        if (!cancelled) {
          setFileComments((prev) => {
            // Avoid duplicates (optimistic insert may already exist)
            if (prev.some((c) => c.id === newComment.id)) return prev;
            return [...prev, newComment];
          });
          setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      },
      (deletedId) => {
        if (!cancelled) {
          setFileComments((prev) => prev.filter((c) => c.id !== deletedId));
        }
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [selectedFile?.id]);

  const allFiles = useMemo(() => {
    const isProjectContext = context.type === 'project' && context.projectId;
    const projectGroupIds = new Set(
      isProjectContext
        ? fileGroups.filter((g) => g.projectId === context.projectId).map((g) => g.id)
        : fileGroups.map((g) => g.id),
    );

    // Build a set of file IDs that belong to the current project's chat messages
    // This prevents DM files from leaking into project file widgets
    const projectChatFileIds = new Set(
      isProjectContext
        ? messages
            .filter((m) => m.projectId === context.projectId && m.messageType === 'file' && m.attachmentId)
            .map((m) => m.attachmentId!)
        : [],
    );

    return files
      .filter((f) => {
        // Files in this project's file groups
        if (f.fileGroupId && projectGroupIds.has(f.fileGroupId)) return true;
        // Chat-uploaded files: only show if they belong to this project's messages
        if (!f.fileGroupId && f.source === 'CHAT') {
          if (!isProjectContext) return true; // No project filter → show all
          return projectChatFileIds.has(f.id);
        }
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);
  }, [fileGroups, files, messages, context]);

  const handleFileClick = useCallback((file: FileItem) => {
    setSelectedFile(file);
    setNewComment('');
  }, []);

  const getUserById = useCallback((userId: string) => {
    return users.find(u => u.id === userId);
  }, [users]);

  const handleAddComment = useCallback(async () => {
    if (!selectedFile || !newComment.trim() || !currentUser) return;

    const content = newComment.trim();
    setNewComment('');

    if (isSupabaseConfigured()) {
      try {
        // Insert to DB → realtime subscription will sync to all users
        const created = await createFileComment(selectedFile.id, currentUser.id, content);
        // Optimistic: add locally immediately (realtime will deduplicate)
        setFileComments((prev) => {
          if (prev.some((c) => c.id === created.id)) return prev;
          return [...prev, created];
        });
        toast.success(t('commentAdded'));
      } catch (err) {
        console.error('Failed to create comment:', err);
        toast.error('Failed to add comment');
        setNewComment(content); // Restore on failure
        return;
      }
    } else {
      // Mock mode: local-only comment
      const mockComment: FileComment = {
        id: `fc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fileItemId: selectedFile.id,
        userId: currentUser.id,
        content,
        createdAt: new Date().toISOString(),
      };
      setFileComments((prev) => [...prev, mockComment]);
      toast.success(t('commentAdded'));
    }

    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [selectedFile, newComment, currentUser, t]);

  const handleDeleteFile = useCallback(async (fileId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Use the appStore action which handles both Supabase DELETE and local state
    try {
      await useAppStore.getState().deleteFileItem(fileId);
    } catch (err) {
      console.error('Failed to delete file:', err);
      // Even if Supabase fails, remove from local state for UX
      const { files: allStoreFiles } = useAppStore.getState();
      useAppStore.setState({ files: allStoreFiles.filter((f) => f.id !== fileId) });
    }

    if (selectedFile?.id === fileId) setSelectedFile(null);
    toast.success(t('fileDeleted'));
  }, [selectedFile, t]);

  if (allFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        {t('noFiles')}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-0.5">
        {allFiles.map((f) => {
          const info = getFileInfo(f.name, f.type);
          const Icon = info.icon;
          const isImage = isImageFile(f.name, f.type);
          const isPdf = isPdfFile(f.name, f.type);
          const fileUrl = (isImage || isPdf) ? getFileUrl(f.storagePath) : null;

          return (
            <div
              key={f.id}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
              onClick={() => handleFileClick(f)}
              title={t('clickToPreview')}
            >
              {/* Thumbnail for images / PDF badge for PDFs / Icon fallback */}
              {isImage && fileUrl ? (
                <div className="shrink-0 w-8 h-8 rounded overflow-hidden bg-muted">
                  <img
                    src={fileUrl} alt={f.name}
                    className="w-full h-full object-cover" loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : isPdf ? (
                <div className="shrink-0 w-8 h-8 rounded bg-red-50 dark:bg-red-950/30 flex items-center justify-center border border-red-200/50 dark:border-red-800/30">
                  <span className="text-[9px] font-bold text-red-500">PDF</span>
                </div>
              ) : (
                <div className={`shrink-0 ${info.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {info.label}
                  {f.size ? ` · ${formatSize(f.size)}` : ''}
                </p>
              </div>
              {/* Inline delete button */}
              <button
                onClick={(e) => handleDeleteFile(f.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 transition-all shrink-0"
                title={t('delete')}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          );
        })}
      </div>

      {/* File Preview Dialog */}
      <Dialog open={!!selectedFile} onOpenChange={(open) => { if (!open) setSelectedFile(null); }}>
        <DialogContent className="sm:max-w-[90vw] w-[90vw] max-h-[90vh] overflow-y-auto">
          {selectedFile && (() => {
            const info = getFileInfo(selectedFile.name, selectedFile.type);
            const Icon = info.icon;
            const comments = fileComments;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-sm">
                    <Icon className={`w-5 h-5 ${info.color}`} />
                    {selectedFile.name}
                  </DialogTitle>
                  <DialogDescription className="sr-only">{selectedFile.name}</DialogDescription>
                </DialogHeader>

                {/* Preview area */}
                <div className="bg-muted rounded-lg flex items-center justify-center min-h-[120px] overflow-hidden">
                  {(() => {
                    const previewUrl = getFileUrl(selectedFile.storagePath);
                    const isImg = isImageFile(selectedFile.name, selectedFile.type);
                    const isPdf_ = isPdfFile(selectedFile.name, selectedFile.type);

                    if (isImg && previewUrl) {
                      return <img src={previewUrl} alt={selectedFile.name} className="max-w-full max-h-[50vh] object-contain mx-auto" loading="lazy" />;
                    }
                    if (isPdf_ && previewUrl) {
                      return (
                        <div className="w-full h-[50vh]">
                          <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-0" title={selectedFile.name} />
                        </div>
                      );
                    }
                    if (info.previewable) {
                      return (
                        <div className="text-center space-y-2 p-6">
                          <Eye className="w-8 h-8 text-muted-foreground mx-auto" />
                          <p className="text-xs text-muted-foreground">Preview available after upload to storage</p>
                        </div>
                      );
                    }
                    return (
                      <div className="text-center space-y-2 p-6">
                        <Icon className={`w-12 h-12 ${info.color} mx-auto opacity-60`} />
                        <p className="text-xs text-muted-foreground">{info.label} file</p>
                      </div>
                    );
                  })()}
                </div>

                {/* File metadata */}
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Type</span>
                    <span className="font-medium text-foreground">{info.label}</span>
                  </div>
                  {selectedFile.size && (
                    <div className="flex justify-between">
                      <span>Size</span>
                      <span className="font-medium text-foreground">{formatSize(selectedFile.size)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Uploaded</span>
                    <span className="font-medium text-foreground">
                      {new Date(selectedFile.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Threaded Comments */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> {t('comments')} ({comments.length})
                  </label>

                  {comments.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {comments.map((c) => {
                        const user = getUserById(c.userId);
                        const initials = user?.name?.split(' ').map(n => n[0]).join('') || '?';
                        return (
                          <div key={c.id} className="flex gap-2">
                            <Avatar className="w-6 h-6 shrink-0">
                              <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-foreground">{user?.name || 'Unknown'}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(c.createdAt).toLocaleString(undefined, {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words">{c.content}</p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={commentsEndRef} />
                    </div>
                  )}

                  {/* New comment input with @mention support */}
                  <div className="flex gap-2">
                    <MentionTextarea
                      value={newComment}
                      onChange={setNewComment}
                      placeholder={t('addComment')}
                      rows={1}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                      mentionableUserIds={
                        context.type === 'project' && context.projectId
                          ? projects.find(p => p.id === context.projectId)?.teamMemberIds
                          : undefined
                      }
                    />
                    <Button
                      size="icon"
                      className="w-8 h-8 shrink-0"
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Download className="w-3.5 h-3.5" /> {t('download')}
                  </Button>
                  <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => handleDeleteFile(selectedFile.id)}>
                    <Trash2 className="w-3.5 h-3.5" /> {t('delete')}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default FilesWidget;
