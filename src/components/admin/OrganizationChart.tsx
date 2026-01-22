import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { GripVertical, Plus, Trash2, Check, X, Users } from 'lucide-react';
import { toast } from 'sonner';

interface OrgMember {
  id: string;
  name: string;
  position: string;
  title: string;
  department: string;
  team: string;
}

const departments = [
  '경영기획실',
  'Creative Solution',
  'Creative Media Production (CMP)',
  'New Experience Terminal (NEXT)',
];

const teams: Record<string, string[]> = {
  '경영기획실': ['인사관리', '경리', '총무'],
  'Creative Solution': ['Team A', 'Team B'],
  'Creative Media Production (CMP)': ['Directing', 'Production'],
  'New Experience Terminal (NEXT)': ['3D Designer', 'Post Edit'],
};

const initialMembers: OrgMember[] = [
  { id: '1', name: '김경신', position: 'CEO', title: 'Chief Executive Officer', department: '경영기획실', team: '' },
  { id: '2', name: '정승채', position: 'Team Leader', title: '경영기획실장', department: '경영기획실', team: '인사관리' },
  { id: '3', name: '표인하', position: '경리', title: 'Finance Manager', department: '경영기획실', team: '경리' },
  { id: '4', name: '고민혁', position: '총무', title: 'General Affairs', department: '경영기획실', team: '총무' },
  { id: '5', name: 'Saffaan Qadir', position: 'Team Leader', title: 'Team A', department: 'Creative Solution', team: 'Team A' },
  { id: '6', name: '안지민', position: 'AD', title: 'Art Director', department: 'Creative Solution', team: 'Team A' },
  { id: '7', name: '이지수', position: 'AD', title: 'Art Director', department: 'Creative Solution', team: 'Team A' },
  { id: '8', name: '이봄이', position: 'COPY', title: 'Copywriter', department: 'Creative Solution', team: 'Team A' },
  { id: '9', name: '정재영', position: 'AD', title: 'Art Director', department: 'Creative Solution', team: 'Team B' },
  { id: '10', name: '장요한', position: 'Team Leader', title: 'Directing', department: 'Creative Media Production (CMP)', team: 'Directing' },
  { id: '11', name: '임혁', position: 'Director', title: 'Director', department: 'Creative Media Production (CMP)', team: 'Directing' },
  { id: '12', name: '김현진', position: 'AD', title: 'Assistant Director', department: 'Creative Media Production (CMP)', team: 'Directing' },
  { id: '13', name: '이지우', position: 'AD', title: 'Assistant Director', department: 'Creative Media Production (CMP)', team: 'Directing' },
  { id: '14', name: '박민규', position: 'Team Leader', title: 'Production', department: 'Creative Media Production (CMP)', team: 'Production' },
  { id: '15', name: '백송희', position: 'PD', title: 'Producer', department: 'Creative Media Production (CMP)', team: 'Production' },
  { id: '16', name: '정형화', position: 'PD', title: 'Producer', department: 'Creative Media Production (CMP)', team: 'Production' },
  { id: '17', name: '홍원준', position: 'GL', title: 'Group Leader', department: 'New Experience Terminal (NEXT)', team: '' },
  { id: '18', name: 'TIAGO', position: 'Team Leader', title: '3D Designer', department: 'New Experience Terminal (NEXT)', team: '3D Designer' },
  { id: '19', name: '이정헌', position: '3D', title: '3D Designer', department: 'New Experience Terminal (NEXT)', team: '3D Designer' },
  { id: '20', name: '권설', position: '3D', title: '3D Designer', department: 'New Experience Terminal (NEXT)', team: '3D Designer' },
  { id: '21', name: '한상현', position: 'Video Editor', title: '영상 후반 편집', department: 'New Experience Terminal (NEXT)', team: 'Post Edit' },
  { id: '22', name: '김기배', position: '2D', title: '2D Designer', department: 'New Experience Terminal (NEXT)', team: 'Post Edit' },
];

export function OrganizationChart() {
  const [members, setMembers] = useState<OrgMember[]>(initialMembers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverDept, setDragOverDept] = useState<string | null>(null);
  const [tempMember, setTempMember] = useState<Partial<OrgMember>>({});
  const [filterDept, setFilterDept] = useState<string>('all');

  const groupedMembers = members.reduce((acc, member) => {
    const key = member.department;
    if (!acc[key]) acc[key] = {};
    const teamKey = member.team || 'General';
    if (!acc[key][teamKey]) acc[key][teamKey] = [];
    acc[key][teamKey].push(member);
    return acc;
  }, {} as Record<string, Record<string, OrgMember[]>>);

  const filteredDepartments = filterDept === 'all' 
    ? departments 
    : departments.filter(d => d === filterDept);

  const handleDragStart = (e: React.DragEvent, member: OrgMember) => {
    setDraggedId(member.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, dept: string, team: string) => {
    e.preventDefault();
    setDragOverDept(`${dept}-${team}`);
  };

  const handleDragLeave = () => {
    setDragOverDept(null);
  };

  const handleDrop = (e: React.DragEvent, targetDept: string, targetTeam: string) => {
    e.preventDefault();
    if (!draggedId) return;

    setMembers(prev => prev.map(m => 
      m.id === draggedId 
        ? { ...m, department: targetDept, team: targetTeam === 'General' ? '' : targetTeam }
        : m
    ));
    
    toast.success('Member moved successfully');
    setDraggedId(null);
    setDragOverDept(null);
  };

  const handleSave = (member: OrgMember) => {
    setMembers(prev => prev.map(m => m.id === member.id ? member : m));
    setEditingId(null);
    toast.success('Member updated');
  };

  const handleAdd = () => {
    if (!tempMember.name || !tempMember.department) return;
    
    const newMember: OrgMember = {
      id: `org-${Date.now()}`,
      name: tempMember.name || '',
      position: tempMember.position || '',
      title: tempMember.title || '',
      department: tempMember.department || departments[0],
      team: tempMember.team || '',
    };

    setMembers(prev => [...prev, newMember]);
    setIsAdding(false);
    setTempMember({});
    toast.success('Member added');
  };

  const handleDelete = (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
    toast.success('Member removed');
  };

  const getDeptColor = (dept: string) => {
    switch (dept) {
      case '경영기획실': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Creative Solution': return 'bg-violet-100 text-violet-700 border-violet-200';
      case 'Creative Media Production (CMP)': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'New Experience Terminal (NEXT)': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">PAULUS CO., LTD 조직도</h3>
          <p className="text-sm text-muted-foreground">ver. 2025.01.08 · Drag & drop to reorganize</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-2" onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4" />
            Add Member
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {filteredDepartments.map(dept => {
          const deptTeams = teams[dept] || [];
          const allTeams = ['General', ...deptTeams];
          
          return (
            <div key={dept} className="border rounded-lg overflow-hidden">
              <div className={`px-4 py-2 font-medium ${getDeptColor(dept)}`}>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {dept}
                  <Badge variant="secondary" className="ml-auto">
                    {Object.values(groupedMembers[dept] || {}).flat().length} members
                  </Badge>
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTeams.map(team => {
                    const teamMembers = groupedMembers[dept]?.[team] || [];
                    const isDropTarget = dragOverDept === `${dept}-${team}`;
                    
                    return teamMembers.length > 0 || draggedId ? (
                      <React.Fragment key={team}>
                        {team !== 'General' && teamMembers.length > 0 && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={6} className="py-1 text-xs font-medium text-muted-foreground">
                              {team}
                            </TableCell>
                          </TableRow>
                        )}
                        {teamMembers.map(member => (
                          editingId === member.id ? (
                            <TableRow key={member.id} className="bg-blue-50/50">
                              <TableCell><GripVertical className="w-4 h-4 text-muted-foreground" /></TableCell>
                              <TableCell>
                                <Input
                                  value={member.name}
                                  onChange={(e) => setMembers(prev => prev.map(m => m.id === member.id ? { ...m, name: e.target.value } : m))}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={member.position}
                                  onChange={(e) => setMembers(prev => prev.map(m => m.id === member.id ? { ...m, position: e.target.value } : m))}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={member.title}
                                  onChange={(e) => setMembers(prev => prev.map(m => m.id === member.id ? { ...m, title: e.target.value } : m))}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={member.team || 'General'}
                                  onValueChange={(val) => setMembers(prev => prev.map(m => m.id === member.id ? { ...m, team: val === 'General' ? '' : val } : m))}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="General">General</SelectItem>
                                    {(teams[dept] || []).map(t => (
                                      <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleSave(member)}>
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingId(null)}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            <TableRow 
                              key={member.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, member)}
                              onDragOver={(e) => handleDragOver(e, dept, team)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, dept, team)}
                              className={`cursor-grab hover:bg-muted/50 ${draggedId === member.id ? 'opacity-50' : ''} ${isDropTarget ? 'bg-primary/10' : ''}`}
                              onClick={() => setEditingId(member.id)}
                            >
                              <TableCell><GripVertical className="w-4 h-4 text-muted-foreground" /></TableCell>
                              <TableCell className="font-medium">{member.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{member.position}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{member.title}</TableCell>
                              <TableCell className="text-muted-foreground">{member.team || '-'}</TableCell>
                              <TableCell>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(member.id); }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        ))}
                        {/* Drop zone for empty teams */}
                        {draggedId && teamMembers.length === 0 && (
                          <TableRow 
                            className={`border-dashed ${isDropTarget ? 'bg-primary/10' : ''}`}
                            onDragOver={(e) => handleDragOver(e, dept, team)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, dept, team)}
                          >
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-3">
                              Drop here to add to {team}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ) : null;
                  })}
                </TableBody>
              </Table>
            </div>
          );
        })}
      </div>

      {/* Add Member Row */}
      {isAdding && (
        <Card className="mt-4 p-4 border-dashed border-2 border-primary/30">
          <div className="grid grid-cols-5 gap-4">
            <Input
              placeholder="Name"
              value={tempMember.name || ''}
              onChange={(e) => setTempMember(prev => ({ ...prev, name: e.target.value }))}
            />
            <Input
              placeholder="Position"
              value={tempMember.position || ''}
              onChange={(e) => setTempMember(prev => ({ ...prev, position: e.target.value }))}
            />
            <Input
              placeholder="Title"
              value={tempMember.title || ''}
              onChange={(e) => setTempMember(prev => ({ ...prev, title: e.target.value }))}
            />
            <Select
              value={tempMember.department || ''}
              onValueChange={(val) => setTempMember(prev => ({ ...prev, department: val, team: '' }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} className="flex-1">Add</Button>
              <Button size="sm" variant="outline" onClick={() => { setIsAdding(false); setTempMember({}); }}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}
    </Card>
  );
}
