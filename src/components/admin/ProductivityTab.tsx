import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Filter } from 'lucide-react';

export function ProductivityTab() {
  const { projects, users, peerFeedback, getUserById, getProjectById } = useAppStore();
  const [selectedProject, setSelectedProject] = useState<string>('all');
  
  const completedProjects = projects.filter(p => p.status === 'COMPLETED');
  
  // Filter feedback by project
  const filteredFeedback = selectedProject === 'all' 
    ? peerFeedback 
    : peerFeedback.filter(f => f.projectId === selectedProject);

  // Calculate average rating per user
  const userAverages = users.map(user => {
    const userFeedback = filteredFeedback.filter(f => f.toUserId === user.id);
    const avgRating = userFeedback.length > 0 
      ? userFeedback.reduce((sum, f) => sum + f.rating, 0) / userFeedback.length 
      : 0;
    return {
      user,
      avgRating,
      feedbackCount: userFeedback.length,
    };
  }).filter(u => u.feedbackCount > 0).sort((a, b) => b.avgRating - a.avgRating);

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star} 
            className={`w-4 h-4 ${star <= rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4 shadow-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="w-4 h-4" />
            Filter by:
          </div>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {completedProjects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Total Feedback</p>
          <p className="text-3xl font-semibold text-foreground mt-1">{filteredFeedback.length}</p>
        </Card>
        <Card className="p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Average Rating</p>
          <p className="text-3xl font-semibold text-foreground mt-1">
            {filteredFeedback.length > 0 
              ? (filteredFeedback.reduce((sum, f) => sum + f.rating, 0) / filteredFeedback.length).toFixed(1)
              : '-'
            }
          </p>
        </Card>
        <Card className="p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Reviewed Projects</p>
          <p className="text-3xl font-semibold text-foreground mt-1">
            {new Set(filteredFeedback.map(f => f.projectId)).size}
          </p>
        </Card>
      </div>

      {/* User Averages Table */}
      <Card className="shadow-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-foreground">Individual Performance</h3>
          <p className="text-sm text-muted-foreground">Average peer feedback scores</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Member</TableHead>
              <TableHead>Feedback Count</TableHead>
              <TableHead>Average Rating</TableHead>
              <TableHead>Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userAverages.map(({ user, avgRating, feedbackCount }) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{feedbackCount}</TableCell>
                <TableCell>{renderStars(Math.round(avgRating))}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{avgRating.toFixed(1)}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {userAverages.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No feedback data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Detailed Feedback Table */}
      <Card className="shadow-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-foreground">Feedback Details</h3>
          <p className="text-sm text-muted-foreground">All peer feedback records</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Comment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFeedback.map((feedback) => {
              const project = getProjectById(feedback.projectId);
              const fromUser = getUserById(feedback.fromUserId);
              const toUser = getUserById(feedback.toUserId);
              return (
                <TableRow key={feedback.id}>
                  <TableCell className="font-medium">{project?.title || '-'}</TableCell>
                  <TableCell>{fromUser?.name || '-'}</TableCell>
                  <TableCell>{toUser?.name || '-'}</TableCell>
                  <TableCell>{renderStars(feedback.rating)}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {feedback.comment || '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}