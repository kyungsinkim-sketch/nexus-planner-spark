import React, { useState, useEffect } from 'react';
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
import { useTranslation } from '@/hooks/useTranslation';
import { useAdminEmployees } from '@/hooks/useAdmin';
import { AdminEmployee } from '@/types/admin';

interface OrgMember {
  id: string;
  name: string;
  position: string;
  title: string;
  department: string;
  team: string;
}

const departments = [
  'Management',
  'Creative Solution',
  'Production',
  'Renatus',
];

const teams: Record<string, string[]> = {
  'Management': ['경영기획실'],
  'Creative Solution': ['Team A', 'Team B'],
  'Production': ['Directing', 'Production', 'NEXT', 'Post Edit'],
  'Renatus': [],
};

export function OrganizationChart() {
  const { t } = useTranslation();
  const { employees, isLoading, addEmployee, updateEmployee, deleteEmployee } = useAdminEmployees();
  
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverDept, setDragOverDept] = useState<string | null>(null);
  const [tempMember, setTempMember] = useState<Partial<OrgMember>>({});
  const [filterDept, setFilterDept] = useState<string>('all');

  // Sync DB data into local state for UI interactions
  useEffect(() => {
    if (employees) {
      const mapped: OrgMember[] = employees.map(emp => ({
        id: emp.id,
        name: emp.name,
        position: emp.position,
        title: emp.level, // Store level in title for UI, or position
        department: emp.department,
        team: emp.team || ''
      }));
      setMembers(mapped);
    }
  }, [employees]);

  // Grouping logic
  const groupedMembers = members.reduce((acc, member) => {
    const key = member.department; // Ensure department matches keys in 'teams'
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

    // Optimistic Update
    setMembers(prev => prev.map(m =>
      m.id === draggedId
        ? { ...m, department: targetDept, team: targetTeam === 'General' ? '' : targetTeam }
        : m
    ));

    // Server Update
    updateEmployee({
      id: draggedId,
      updates: {
        department: targetDept,
        team: targetTeam === 'General' ? '' : targetTeam
      }
    });

    setDraggedId(null);
    setDragOverDept(null);
  };

  const handleSave = (member: OrgMember) => {
    updateEmployee({
      id: member.id,
      updates: {
        name: member.name,
        position: member.position,
        department: member.department,
        team: member.team,
        // level: member.title // Optional if needed
      }
    });
    setEditingId(null);
    toast.success('Member updated');
  };

  const handleAdd = () => {
    if (!tempMember.name || !tempMember.department) return;

    addEmployee({
      name: tempMember.name,
      department: tempMember.department,
      position: tempMember.position || 'Employee',
      team: tempMember.team || '',
      category: 'Junior',
      status: '재직중',
      join_date: new Date().toISOString().split('T')[0],
      employee_no: Math.floor(Math.random() * 9000) + 1000,
      level: 'P1',
      class_level: 'A',
      annual_salary: 35000000,
      monthly_salary: 2916666
    }, {
      onSuccess: () => {
        setIsAdding(false);
        setTempMember({});
      }
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this member?')) {
      deleteEmployee(id);
    }
  };

  const getDeptColor = (dept: string) => {
    switch (dept) {
      case 'Management': return 'bg-blue-100 text-blue-700';
      case 'Creative Solution': return 'bg-purple-100 text-purple-700';
      case 'Production': return 'bg-green-100 text-green-700';
      case 'Renatus': return 'bg-pink-100 text-pink-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading && members.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">Loading organization chart...</div>;
  }

  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">{t('paulusOrgChart')}</h3>
          <p className="text-sm text-muted-foreground">ver. 2025.12.18 · Drag & drop to reorganize</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-2" onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4" />
            {t('addMember')}
          </Button>
        </div>
      </div>

      {isAdding && (
         <Card className="mb-6 p-4 border-2 border-primary/20 bg-primary/5">
           <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
             <div className="space-y-2">
               <label className="text-xs font-medium">Name</label>
               <Input 
                 placeholder="Name" 
                 value={tempMember.name || ''} 
                 onChange={e => setTempMember({...tempMember, name: e.target.value})}
               />
             </div>
             <div className="space-y-2">
               <label className="text-xs font-medium">Position</label>
               <Input 
                 placeholder="e.g. Director" 
                 value={tempMember.position || ''} 
                 onChange={e => setTempMember({...tempMember, position: e.target.value})}
               />
             </div>
              <div className="space-y-2">
               <label className="text-xs font-medium">Title/Level</label>
               <Input 
                 placeholder="e.g. L1" 
                 value={tempMember.title || ''} 
                 onChange={e => setTempMember({...tempMember, title: e.target.value})}
               />
             </div>
             <div className="space-y-2">
               <label className="text-xs font-medium">Department</label>
               <Select 
                 value={tempMember.department} 
                 onValueChange={val => setTempMember({...tempMember, department: val})}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Select Dept" />
                 </SelectTrigger>
                 <SelectContent>
                   {departments.map(d => (
                     <SelectItem key={d} value={d}>{d}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2">
               <label className="text-xs font-medium">Team</label>
               <Select 
                 value={tempMember.team} 
                 onValueChange={val => setTempMember({...tempMember, team: val})}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Select Team" />
                 </SelectTrigger>
                 <SelectContent>
                    {(tempMember.department && teams[tempMember.department]) ? (
                        teams[tempMember.department].map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))
                    ) : (
                        <SelectItem value="General">General</SelectItem>
                    )}
                 </SelectContent>
               </Select>
             </div>
           </div>
           <div className="flex justify-end gap-2 mt-4">
             <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
             <Button size="sm" onClick={handleAdd}>Save Member</Button>
           </div>
         </Card>
      )}

      <div className="space-y-8">
        {filteredDepartments.map(dept => {
          const deptMembers = groupedMembers[dept] || {};
          // Get all teams for this department + any current teams in data
          const definedTeams = teams[dept] || [];
          const dataTeams = Object.keys(deptMembers);
          const allTeams = Array.from(new Set([...definedTeams, ...dataTeams, 'General']));

          return (
            <div key={dept} className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className={getDeptColor(dept)}>{dept}</Badge>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="w-[150px]">{t('name')}</TableHead>
                      <TableHead>{t('position')}</TableHead>
                      <TableHead>{t('grade')}</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTeams.map(team => {
                      const teamMembers = deptMembers[team] || [];
                      
                      // Skip rendering empty teams unless it's a drag target
                      if (teamMembers.length === 0 && dragOverDept !== `${dept}-${team}`) return null;
                      
                      const isDropTarget = dragOverDept === `${dept}-${team}`;

                      return (
                        <React.Fragment key={team}>
                           {(team !== 'General' && (teamMembers.length > 0 || isDropTarget)) && (
                            <TableRow className="bg-muted/10">
                              <TableCell colSpan={6} className="py-2 text-xs font-bold text-muted-foreground pl-4">
                                {team}
                              </TableCell>
                            </TableRow>
                          )}
                          
                          {/* Drop Zone for empty teams */}
                          {teamMembers.length === 0 && isDropTarget && (
                             <TableRow 
                               className="bg-blue-50/50 border-dashed border-2 border-blue-200"
                               onDragOver={(e) => handleDragOver(e, dept, team)}
                               onDragLeave={handleDragLeave}
                               onDrop={(e) => handleDrop(e, dept, team)}
                             >
                                <TableCell colSpan={6} className="text-center py-4 text-blue-500">
                                   Drop here to move to {team}
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
                                      {allTeams.map(t => (
                                          <SelectItem key={t} value={t}>{t}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 justify-end">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleSave(member)}>
                                      <Check className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setEditingId(null)}>
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
                                className={`
                                  group cursor-move transition-colors
                                  ${draggedId === member.id ? 'opacity-50' : ''}
                                  ${isDropTarget ? 'bg-blue-50 border-blue-200' : ''}
                                `}
                              >
                                <TableCell><GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" /></TableCell>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                                      {member.name[0]}
                                    </div>
                                    {member.name}
                                  </div>
                                </TableCell>
                                <TableCell>{member.position}</TableCell>
                                <TableCell><Badge variant="outline">{member.title}</Badge></TableCell>
                                <TableCell className="text-muted-foreground text-sm">{member.team || '-'}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(member.id)}>
                                      <Users className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(member.id)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
