import { useState } from 'react';
import { FileCategory } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const { getFileGroupsByProject, getFilesByGroup, getUserById } = useAppStore();
  const fileGroups = getFileGroupsByProject(projectId);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | 'ALL'>('ALL');

  const allCategories: FileCategory[] = ['DECK', 'FINAL', 'REFERENCE', 'CONTRACT', 'ETC'];

  const filteredGroups = selectedCategory === 'ALL' 
    ? fileGroups 
    : fileGroups.filter(g => g.category === selectedCategory);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleAddToImportant = (fileId: string) => {
    // Mock add to important
    console.log('Add to important:', fileId);
  };

  const handleUpload = () => {
    // Mock upload
    console.log('Upload clicked');
  };

  return (
    <div className="flex gap-6 h-[600px]">
      {/* Categories Sidebar */}
      <Card className="w-64 shrink-0 p-4 shadow-card">
        <h3 className="font-semibold text-foreground mb-4">Categories</h3>
        <div className="space-y-1">
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
              {fileGroups.reduce((acc, g) => acc + getFilesByGroup(g.id).length, 0)}
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
            {selectedCategory === 'ALL' ? 'All Files' : categoryLabels[selectedCategory]}
          </h3>
          <Button size="sm" className="gap-2" onClick={handleUpload}>
            <Upload className="w-4 h-4" />
            Upload Files
          </Button>
        </div>

        <Card className="flex-1 shadow-card overflow-hidden">
          <ScrollArea className="h-full">
            {filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <FolderOpen className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No files in this category</p>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {filteredGroups.map((group) => {
                  const files = getFilesByGroup(group.id);
                  const Icon = categoryIcons[group.category];

                  return (
                    <div key={group.id}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${categoryColors[group.category]}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-foreground">{group.title}</h4>
                          <p className="text-xs text-muted-foreground">{files.length} files</p>
                        </div>
                      </div>

                      <div className="space-y-2 ml-11">
                        {files.map((file) => {
                          const uploader = getUserById(file.uploadedBy);
                          
                          return (
                            <div
                              key={file.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                            >
                              <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {uploader?.name} · {formatDate(file.createdAt)} · {file.size}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleAddToImportant(file.id)}
                                >
                                  <Star className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleAddToImportant(file.id)}>
                                      Add to Important Files
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>Rename</DropdownMenuItem>
                                    <DropdownMenuItem>Move to...</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive">
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
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
    </div>
  );
}
