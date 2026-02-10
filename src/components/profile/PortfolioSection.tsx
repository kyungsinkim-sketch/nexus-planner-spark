import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Briefcase, Calendar, ExternalLink, FolderKanban } from 'lucide-react';
import { format } from 'date-fns';
import { PortfolioItem } from '@/types/core';

export function PortfolioSection() {
  const { currentUser, getPortfolioByUser } = useAppStore();
  const portfolioItems = currentUser ? getPortfolioByUser(currentUser.id) : [];
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Portfolio</h2>
          <p className="text-sm text-muted-foreground">Your completed projects and contributions</p>
        </div>
        <Badge variant="outline">{portfolioItems.length} Projects</Badge>
      </div>

      {/* Portfolio Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {portfolioItems.map((item) => (
          <Card 
            key={item.id} 
            className="group cursor-pointer shadow-card hover:shadow-elevated transition-all duration-200 hover:border-primary/20 overflow-hidden"
            onClick={() => setSelectedItem(item)}
          >
            {/* Thumbnail Placeholder */}
            <div className="aspect-video bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center">
              <FolderKanban className="w-12 h-12 text-muted-foreground/50 group-hover:text-primary/50 transition-colors" />
            </div>
            
            <div className="p-4">
              <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {item.projectTitle}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{item.client}</p>
              
              <div className="flex items-center justify-between mt-3">
                <Badge variant="secondary" className="text-xs">
                  {item.role}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(item.completedAt), 'MMM yyyy')}
                </span>
              </div>
            </div>
          </Card>
        ))}

        {portfolioItems.length === 0 && (
          <Card className="col-span-full p-8 shadow-card text-center">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-foreground mb-1">No portfolio items yet</h3>
            <p className="text-sm text-muted-foreground">
              Complete projects to build your portfolio
            </p>
          </Card>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedItem?.projectTitle}</DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              {/* Thumbnail */}
              <div className="aspect-video bg-gradient-to-br from-primary/10 to-violet-500/10 rounded-lg flex items-center justify-center">
                <FolderKanban className="w-16 h-16 text-muted-foreground/50" />
              </div>
              
              {/* Info */}
              <div className="grid gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Client:</span>
                  <span className="font-medium text-foreground">{selectedItem.client}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{selectedItem.role}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Completed:</span>
                  <span className="font-medium text-foreground">
                    {format(new Date(selectedItem.completedAt), 'MMMM yyyy')}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  View Project
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}