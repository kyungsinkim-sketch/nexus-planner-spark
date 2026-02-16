/**
 * FilesWidget — Flat file list with type icons and descriptions.
 * No folder hierarchy — shows individual files with their type/format.
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import {
  FileText, Image, FileSpreadsheet, Presentation, Film,
  FileArchive, File, Music, Code,
} from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

/** Map file extension or type to an icon + label */
function getFileInfo(fileName: string, fileType?: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Images
  if (/^(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)$/.test(ext) || fileType?.startsWith('image')) {
    return { icon: Image, label: 'Image', color: 'text-emerald-500' };
  }
  // PDF
  if (ext === 'pdf' || fileType === 'application/pdf') {
    return { icon: FileText, label: 'PDF', color: 'text-red-500' };
  }
  // Presentations
  if (/^(ppt|pptx|key|odp)$/.test(ext)) {
    return { icon: Presentation, label: 'Presentation', color: 'text-orange-500' };
  }
  // Spreadsheets
  if (/^(xls|xlsx|csv|numbers|ods)$/.test(ext)) {
    return { icon: FileSpreadsheet, label: 'Spreadsheet', color: 'text-green-600' };
  }
  // Documents
  if (/^(doc|docx|txt|rtf|odt|pages|md)$/.test(ext)) {
    return { icon: FileText, label: 'Document', color: 'text-blue-500' };
  }
  // Video
  if (/^(mp4|mov|avi|mkv|wmv|flv|webm)$/.test(ext) || fileType?.startsWith('video')) {
    return { icon: Film, label: 'Video', color: 'text-violet-500' };
  }
  // Audio
  if (/^(mp3|wav|aac|flac|ogg|wma|m4a)$/.test(ext) || fileType?.startsWith('audio')) {
    return { icon: Music, label: 'Audio', color: 'text-pink-500' };
  }
  // Archives
  if (/^(zip|rar|7z|tar|gz|bz2)$/.test(ext)) {
    return { icon: FileArchive, label: 'Archive', color: 'text-amber-600' };
  }
  // Code
  if (/^(js|ts|tsx|jsx|py|rb|go|rs|java|c|cpp|h|css|html|json|xml|yaml|yml|sh)$/.test(ext)) {
    return { icon: Code, label: 'Code', color: 'text-cyan-500' };
  }
  // Default
  return { icon: File, label: ext.toUpperCase() || 'File', color: 'text-muted-foreground' };
}

function formatSize(size?: string) {
  if (!size) return '';
  // If it's already formatted (e.g., "2.1 MB"), return as-is
  if (/[A-Za-z]/.test(size)) return size;
  const bytes = parseInt(size, 10);
  if (isNaN(bytes)) return size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilesWidget({ context }: { context: WidgetDataContext }) {
  const { fileGroups, files } = useAppStore();

  // Flat file list — all files, optionally filtered by project
  const allFiles = useMemo(() => {
    const projectGroupIds = new Set(
      context.type === 'project' && context.projectId
        ? fileGroups.filter((g) => g.projectId === context.projectId).map((g) => g.id)
        : fileGroups.map((g) => g.id),
    );
    return files
      .filter((f) => f.fileGroupId && projectGroupIds.has(f.fileGroupId))
      .slice(0, 20); // limit for performance
  }, [fileGroups, files, context]);

  if (allFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        No files yet
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {allFiles.map((f) => {
        const info = getFileInfo(f.name, f.type);
        const Icon = info.icon;
        return (
          <div
            key={f.id}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-default"
          >
            <div className={`shrink-0 ${info.color}`}>
              <Icon className="w-4.5 h-4.5" />
            </div>
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
  );
}

export default FilesWidget;
