import { useState, useRef } from 'react';
import { FileCategory } from '@/types/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Upload, Star, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB - matches Supabase bucket limit

interface FileUploadModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  fileName?: string;
  onUpload: (category: FileCategory, isImportant: boolean, comment: string, file?: File) => void;
}

const categoryOptions: { value: FileCategory; label: string }[] = [
  { value: 'DECK', label: 'Presentation / Deck' },
  { value: 'FINAL', label: 'Final Deliverable' },
  { value: 'REFERENCE', label: 'Reference Material' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'ETC', label: 'Other' },
];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function FileUploadModal({
  open,
  onClose,
  projectId,
  fileName,
  onUpload
}: FileUploadModalProps) {
  const [category, setCategory] = useState<FileCategory>('ETC');
  const [isImportant, setIsImportant] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = selectedFile?.name || fileName || 'No file selected';
  const displaySize = selectedFile ? formatFileSize(selectedFile.size) : '';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File is too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = () => {
    onUpload(category, isImportant, comment, selectedFile || undefined);
    setCategory('ETC');
    setIsImportant(false);
    setComment('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleClose = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            Choose a file, select its category and set importance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Selection */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
          />

          {selectedFile ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground">{displaySize}</p>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Click to select a file</span>
              <span className="text-xs text-muted-foreground">PDF, images, documents, etc.</span>
            </button>
          )}

          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">File Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as FileCategory)}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Comment (for search)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a description to help find this file later..."
              className="resize-none"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              This description will be searchable in the Files tab
            </p>
          </div>

          {/* Mark as Important */}
          <div className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
            <Checkbox
              id="important"
              checked={isImportant}
              onCheckedChange={(checked) => setIsImportant(checked as boolean)}
            />
            <div className="flex-1">
              <Label
                htmlFor="important"
                className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2"
              >
                <Star className="w-4 h-4 text-amber-500" />
                Mark as Important
              </Label>
              <p className="text-xs text-muted-foreground">
                Important files are pinned to the top of the Files tab
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile} className="gap-2">
            <Upload className="w-4 h-4" />
            Upload File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
