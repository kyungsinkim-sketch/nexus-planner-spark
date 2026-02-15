import { useState, useMemo } from 'react';
import { FileCategory } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Presentation,
  FileCheck,
  BookOpen,
  FileSignature,
  Upload,
  Download,
  Star,
  MoreHorizontal,
  FolderOpen,
  MessageSquare,
  Search,
  Pencil,
  Trash2,
  FolderInput,
  MessageCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { FileUploadModal } from './FileUploadModal';
import { toast } from 'sonner';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as fileService from '@/services/fileService';

interface FilesTabProps {
  projectId: string;
}

const categoryIcons: Record<FileCategory, typeof FileText> = {
  DECK: Presentation,
  FINAL: FileCheck,
  REFERENCE: BookOpen,
  CONTRACT: FileSignature,
  ETC: FileText,
};

const categoryLabels: Record<FileCategory, string> = {
  DECK: 'Presentations',
  FINAL: 'Final Deliverables',
  REFERENCE: 'References',
  CONTRACT: 'Contracts',
  ETC: 'Others',
};

const categoryColors: Record<FileCategory, string> = {
  DECK: 'bg-primary/10 text-primary',
  FINAL: 'bg-emerald-500/10 text-emerald-600',
  REFERENCE: 'bg-violet-500/10 text-violet-600',
  CONTRACT: 'bg-orange-500/10 text-orange-600',
  ETC: 'bg-muted text-muted-foreground',
};

export function FilesTab({ projectId }: FilesTabProps) {
  const { getFileGroupsByProject, getFilesByGroup, getUserById, files, addFile, addFileGroup, currentUser } = useAppStore();
  const fileGroups = getFileGroupsByProject(projectId);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | 'ALL' | 'IMPORTANT'>('ALL');
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Local state for file management
  const [localFiles, setLocalFiles] = useState<typeof files>([]);
  
  // Modal states
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveToCategory, setMoveToCategory] = useState<FileCategory>('ETC');
  const [commentValue, setCommentValue] = useState('');

  const allCategories: FileCategory[] = ['DECK', 'FINAL', 'REFERENCE', 'CONTRACT', 'ETC'];

  // Get all files for this project
  const allProjectFiles = useMemo(() => {
    return fileGroups.flatMap((group) => {
      const groupFiles = getFilesByGroup(group.id);
      return groupFiles.map((file) => ({ ...file, category: group.category }));
    });
  }, [fileGroups, files, localFiles, getFilesByGroup]);

  // Important files
  const importantFiles = useMemo(() => {
    return allProjectFiles.filter((f) => f.isImportant);
  }, [allProjectFiles]);

  const filteredGroups = selectedCategory === 'ALL' 
    ? fileGroups 
    : selectedCategory === 'IMPORTANT'
      ? []
      : fileGroups.filter(g => g.category === selectedCategory);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Toggle important status
  const handleToggleImportant = (fileId: string) => {
    const file = allProjectFiles.find(f => f.id === fileId);
    if (file) {
      toast.success(file.isImportant ? 'Removed from important files' : 'Added to important files');
    }
  };

  // Rename file
  const handleOpenRename = (fileId: string, currentName: string) => {
    setSelectedFileId(fileId);
    setRenameValue(currentName);
    setShowRenameModal(true);
  };

  const handleRename = () => {
    if (!renameValue.trim() || !selectedFileId) return;
    toast.success(`File renamed to "${renameValue}"`);
    setShowRenameModal(false);
    setSelectedFileId(null);
    setRenameValue('');
  };

  // Move file
  const handleOpenMove = (fileId: string, currentCategory: FileCategory) => {
    setSelectedFileId(fileId);
    setMoveToCategory(currentCategory);
    setShowMoveModal(true);
  };

  const handleMove = () => {
    if (!selectedFileId) return;
    toast.success(`File moved to ${categoryLabels[moveToCategory]}`);
    setShowMoveModal(false);
    setSelectedFileId(null);
  };

  // Delete file
  const handleDelete = (fileId: string) => {
    toast.success('File deleted');
  };

  // Comment on file
  const handleOpenComment = (fileId: string, currentComment?: string) => {
    setSelectedFileId(fileId);
    setCommentValue(currentComment || '');
    setShowCommentModal(true);
  };

  const handleSaveComment = () => {
    if (!selectedFileId) return;
    toast.success('Comment saved');
    setShowCommentModal(false);
    setSelectedFileId(null);
    setCommentValue('');
  };

  const handleUploadConfirm = async (category: FileCategory, isImportant: boolean, comment: string, file?: File) => {
    if (!currentUser) return;

    const categoryTitles: Record<FileCategory, string> = {
      DECK: 'Presentations',
      FINAL: 'Final Deliverables',
      REFERENCE: 'References',
      CONTRACT: 'Contracts',
      ETC: 'Others',
    };

    try {
      if (isSupabaseConfigured() && file) {
        // Real Supabase upload
        let fileGroup = fileGroups.find(fg => fg.category === category);

        if (!fileGroup) {
          fileGroup = await fileService.createFileGroup({
            projectId,
            category,
            title: categoryTitles[category],
          });
          addFileGroup(fileGroup);
        }

        // Upload file to storage
        await fileService.uploadFile(file, projectId, currentUser.id);

        // Create file item metadata
        const fileExt = file.name.split('.').pop() || '';
        const fileSize = file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

        const fileItem = await fileService.createFileItem({
          fileGroupId: fileGroup.id,
          name: file.name,
          uploadedBy: currentUser.id,
          size: fileSize,
          type: fileExt,
          isImportant,
          source: 'UPLOAD',
          comment,
        });

        addFile(fileItem);
        toast.success('File uploaded successfully');
      } else {
        // Mock mode fallback
        let fileGroup = fileGroups.find(fg => fg.category === category);

        if (!fileGroup) {
          const newGroupId = `fg${Date.now()}`;
          addFileGroup({
            id: newGroupId,
            projectId,
            category,
            title: categoryTitles[category],
          });
          fileGroup = { id: newGroupId, projectId, category, title: categoryTitles[category] };
        }

        const fileName = file?.name || `Uploaded_File_${Date.now().toString().slice(-6)}.pdf`;
        const fileSize = file ? (file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`) : '3.1 MB';

        addFile({
          id: `f${Date.now()}`,
          fileGroupId: fileGroup.id,
          name: fileName,
          uploadedBy: currentUser.id,
          createdAt: new Date().toISOString(),
          size: fileSize,
          type: file?.name.split('.').pop() || 'pdf',
          isImportant,
          source: 'UPLOAD',
          comment,
        });
        toast.success('File uploaded successfully');
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file. Please try again.');
    }
  };

  // Filter files by search (including comments)
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex gap-6 h-[600px]">
      {/* Categories Sidebar */}
      <Card className="w-64 shrink-0 p-4 shadow-card">
        <h3 className="font-semibold text-foreground mb-4">Categories</h3>
        <div className="space-y-1">
          {/* Important Files */}
          <button
            onClick={() => setSelectedCategory('IMPORTANT')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedCategory === 'IMPORTANT'
                ? 'bg-amber-500/20 text-amber-700'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <Star className="w-4 h-4" />
            Important Files
            <Badge variant="secondary" className="ml-auto text-xs bg-amber-500/20 text-amber-700">
              {importantFiles.length}
            </Badge>
          </button>

          {/* All Files */}
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedCategory === 'ALL'
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            All Files
            <Badge variant="secondary" className="ml-auto text-xs">
              {allProjectFiles.length}
            </Badge>
          </button>
          
          {allCategories.map((category) => {
            const Icon = categoryIcons[category];
            const groupsForCategory = fileGroups.filter(g => g.category === category);
            const fileCount = groupsForCategory.reduce(
              (acc, g) => acc + getFilesByGroup(g.id).length, 
              0
            );
            
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === category
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                {categoryLabels[category]}
                <Badge variant="secondary" className="ml-auto text-xs">
                  {fileCount}
                </Badge>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Files List */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">
            {selectedCategory === 'ALL' 
              ? 'All Files' 
              : selectedCategory === 'IMPORTANT'
                ? 'Important Files'
                : categoryLabels[selectedCategory]}
          </h3>
          <Button size="sm" className="gap-2" onClick={() => setShowUploadModal(true)}>
            <Upload className="w-4 h-4" />
            Upload Files
          </Button>
        </div>

        <Card className="flex-1 shadow-card overflow-hidden">
          <ScrollArea className="h-full">
            {/* Important Files Section (when viewing All or Important) */}
            {(selectedCategory === 'ALL' || selectedCategory === 'IMPORTANT') && importantFiles.length > 0 && (
              <div className="p-4 border-b border-border bg-amber-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-amber-600" />
                  <h4 className="text-sm font-medium text-foreground">Important Files</h4>
                </div>
                <div className="space-y-2">
                  {importantFiles.map((file) => {
                    const uploader = getUserById(file.uploadedBy);
                    
                    return (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-background border border-amber-500/20 hover:border-amber-500/40 transition-colors group"
                      >
                        <Star className="w-5 h-5 text-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {file.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{uploader?.name}</span>
                            <span>·</span>
                            <span>{formatDate(file.createdAt)}</span>
                            {file.comment && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1 text-primary">
                                  <MessageCircle className="w-3 h-3" />
                                  Has comment
                                </span>
                              </>
                            )}
                            {file.source === 'CHAT' && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  From Chat
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenComment(file.id, file.comment)} aria-label="Add or edit comment">
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Download file">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Regular Files by Category */}
            {selectedCategory === 'IMPORTANT' ? (
              importantFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-12">
                  <Star className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No important files yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Mark files as important to pin them here</p>
                </div>
              )
            ) : filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <FolderOpen className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No files in this category</p>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {filteredGroups.map((group) => {
                  const groupFiles = getFilesByGroup(group.id).filter(f => 
                    selectedCategory === 'ALL' ? !f.isImportant : true
                  );
                  const Icon = categoryIcons[group.category];

                  if (groupFiles.length === 0) return null;

                  return (
                    <div key={group.id}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${categoryColors[group.category]}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-foreground">{group.title}</h4>
                          <p className="text-xs text-muted-foreground">{groupFiles.length} files</p>
                        </div>
                      </div>

                      <div className="space-y-2 ml-11">
                        {groupFiles.map((file) => {
                          const uploader = getUserById(file.uploadedBy);
                          
                          return (
                            <div
                              key={file.id}
                              className="flex flex-col p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                            >
                              <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {file.name}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{uploader?.name}</span>
                                    <span>·</span>
                                    <span>{formatDate(file.createdAt)}</span>
                                    <span>·</span>
                                    <span>{file.size}</span>
                                    {file.source === 'CHAT' && (
                                      <>
                                        <span>·</span>
                                        <span className="flex items-center gap-1 text-primary">
                                          <MessageSquare className="w-3 h-3" />
                                          From Chat
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleOpenComment(file.id, file.comment)}
                                    title="Add/Edit Comment"
                                    aria-label="Add or edit comment"
                                  >
                                    <MessageCircle className={`w-4 h-4 ${file.comment ? 'text-primary' : ''}`} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleToggleImportant(file.id)}
                                    aria-label="Toggle important"
                                  >
                                    <Star className={`w-4 h-4 ${file.isImportant ? 'text-amber-500 fill-amber-500' : ''}`} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label="Download file"
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleToggleImportant(file.id)}>
                                        <Star className="w-4 h-4 mr-2" />
                                        {file.isImportant ? 'Remove from Important' : 'Add to Important Files'}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleOpenComment(file.id, file.comment)}>
                                        <MessageCircle className="w-4 h-4 mr-2" />
                                        {file.comment ? 'Edit Comment' : 'Add Comment'}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleOpenRename(file.id, file.name)}>
                                        <Pencil className="w-4 h-4 mr-2" />
                                        Rename
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleOpenMove(file.id, group.category)}>
                                        <FolderInput className="w-4 h-4 mr-2" />
                                        Move to...
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        className="text-destructive"
                                        onClick={() => handleDelete(file.id)}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                              {/* Comment displayed below */}
                              {file.comment && (
                                <div className="mt-2 ml-8 px-3 py-2 bg-background/60 rounded text-xs text-muted-foreground border-l-2 border-primary/30">
                                  <span className="flex items-center gap-1 mb-1 text-primary font-medium">
                                    <MessageCircle className="w-3 h-3" />
                                    Comment
                                  </span>
                                  {file.comment}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>

      <FileUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        projectId={projectId}
        fileName="New_Upload.pdf"
        onUpload={handleUploadConfirm}
      />

      {/* Rename Modal */}
      <Dialog open={showRenameModal} onOpenChange={setShowRenameModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>Enter a new name for this file.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="File name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Modal */}
      <Dialog open={showMoveModal} onOpenChange={setShowMoveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move File</DialogTitle>
            <DialogDescription>Select a category to move this file to.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={moveToCategory} onValueChange={(v) => setMoveToCategory(v as FileCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {categoryLabels[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleMove}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comment Modal */}
      <Dialog open={showCommentModal} onOpenChange={setShowCommentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File Comment</DialogTitle>
            <DialogDescription>Add a comment to help find this file later.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={commentValue}
              onChange={(e) => setCommentValue(e.target.value)}
              placeholder="Add a description or notes about this file..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommentModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveComment}>Save Comment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}