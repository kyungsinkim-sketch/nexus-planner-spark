/**
 * FilesWidget — Flat file list with type icons and descriptions.
 * Double-click opens a preview popup with download/delete/comment actions.
 */

import { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getFileDownloadUrl } from '@/services/fileService';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  FileText, Image, FileSpreadsheet, Presentation, Film,
  FileArchive, File, Music, Code, Download, Trash2,
  MessageSquare, X, Eye,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import type { FileItem } from '@/types/core';
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

/** Check if file is an image type that can show a thumbnail */
function isImageFile(fileName: string, fileType?: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return /^(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)$/.test(ext) || fileType?.startsWith('image');
}

/** Check if file is a PDF */
function isPdfFile(fileName: string, fileType?: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ext === 'pdf' || fileType === 'application/pdf';
}

/** Get the public URL for a stored file (for thumbnails) */
function getFileUrl(storagePath?: string): string | null {
  if (!storagePath || !isSupabaseConfigured()) return null;
  try {
    return getFileDownloadUrl(storagePath);
  } catch {
    return null;
  }
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
  const { fileGroups, files } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [comment, setComment] = useState('');

  const allFiles = useMemo(() => {
    const projectGroupIds = new Set(
      context.type === 'project' && context.projectId
        ? fileGroups.filter((g) => g.projectId === context.projectId).map((g) => g.id)
        : fileGroups.map((g) => g.id),
    );
    return files
      .filter((f) => f.fileGroupId && projectGroupIds.has(f.fileGroupId))
      .slice(0, 20);
  }, [fileGroups, files, context]);

  const handleFileClick = useCallback((file: FileItem) => {
    setSelectedFile(file);
    setComment(file.comment || '');
  }, []);

  const handleAddComment = useCallback(() => {
    if (!selectedFile || !comment.trim()) return;
    // Update file comment in store
    const { files: allStoreFiles } = useAppStore.getState();
    const idx = allStoreFiles.findIndex((f) => f.id === selectedFile.id);
    if (idx !== -1) {
      const updated = [...allStoreFiles];
      updated[idx] = { ...updated[idx], comment: comment.trim() };
      useAppStore.setState({ files: updated });
      setSelectedFile({ ...selectedFile, comment: comment.trim() });
    }
  }, [selectedFile, comment]);

  const handleDelete = useCallback(() => {
    if (!selectedFile) return;
    const { files: allStoreFiles } = useAppStore.getState();
    useAppStore.setState({ files: allStoreFiles.filter((f) => f.id !== selectedFile.id) });
    setSelectedFile(null);
  }, [selectedFile]);

  if (allFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        No files yet
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
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              onClick={() => handleFileClick(f)}
              title="Click to preview"
            >
              {/* Thumbnail for images / PDF badge for PDFs / Icon fallback */}
              {isImage && fileUrl ? (
                <div className="shrink-0 w-8 h-8 rounded overflow-hidden bg-muted">
                  <img
                    src={fileUrl}
                    alt={f.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
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
                  {f.comment ? ` — ${f.comment}` : ''}
                </p>
              </div>
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
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-sm">
                    <Icon className={`w-5 h-5 ${info.color}`} />
                    {selectedFile.name}
                  </DialogTitle>
                </DialogHeader>

                {/* Preview area */}
                <div className="bg-muted rounded-lg flex items-center justify-center min-h-[120px] overflow-hidden">
                  {(() => {
                    const previewUrl = getFileUrl(selectedFile.storagePath);
                    const isImg = isImageFile(selectedFile.name, selectedFile.type);
                    const isPdf_ = isPdfFile(selectedFile.name, selectedFile.type);

                    if (isImg && previewUrl) {
                      return (
                        <img
                          src={previewUrl}
                          alt={selectedFile.name}
                          className="max-w-full max-h-[70vh] object-contain mx-auto"
                          loading="lazy"
                        />
                      );
                    }
                    if (isPdf_ && previewUrl) {
                      return (
                        <div className="w-full h-[70vh]">
                          <iframe
                            src={`${previewUrl}#toolbar=0`}
                            className="w-full h-full border-0"
                            title={selectedFile.name}
                          />
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

                {/* Comment */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Comment
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="h-8 text-xs flex-1"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
                    />
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleAddComment}>
                      Save
                    </Button>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                  <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDelete}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
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
