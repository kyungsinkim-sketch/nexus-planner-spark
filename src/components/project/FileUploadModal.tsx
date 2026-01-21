import { useState } from 'react';
import { FileCategory } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
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
import { FileText, Upload, Star } from 'lucide-react';

interface FileUploadModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  fileName?: string;
  onUpload: (category: FileCategory, isImportant: boolean, comment: string) => void;
}

const categoryOptions: { value: FileCategory; label: string }[] = [
  { value: 'DECK', label: 'Presentation / Deck' },
  { value: 'FINAL', label: 'Final Deliverable' },
  { value: 'REFERENCE', label: 'Reference Material' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'ETC', label: 'Other' },
];

export function FileUploadModal({ 
  open, 
  onClose, 
  projectId, 
  fileName = 'document.pdf',
  onUpload 
}: FileUploadModalProps) {
  const [category, setCategory] = useState<FileCategory>('ETC');
  const [isImportant, setIsImportant] = useState(false);
  const [comment, setComment] = useState('');

  const handleUpload = () => {
    onUpload(category, isImportant, comment);
    setCategory('ETC');
    setIsImportant(false);
    setComment('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            Choose a category for your file and set its importance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Preview */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
              <p className="text-xs text-muted-foreground">Ready to upload</p>
            </div>
          </div>

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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleUpload} className="gap-2">
            <Upload className="w-4 h-4" />
            Upload File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
