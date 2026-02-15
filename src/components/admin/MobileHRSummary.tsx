/**
 * MobileHRSummary
 * 모바일용 간소화된 HR 요약 뷰
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
    Users,
    Search,
    ChevronRight,
    UserCheck,
    UserX,
    Building2,
} from 'lucide-react';
import { mockEmployees } from '@/mock/adminData';
import { useTranslation } from '@/hooks/useTranslation';

interface MobileHRSummaryProps {
    onViewDetails?: () => void;
}

export function MobileHRSummary({ onViewDetails }: MobileHRSummaryProps) {
    const { t, language } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');

    const employees = mockEmployees;
    const activeEmployees = employees.filter(e => e.status === '재직중');
    const onLeaveEmployees = employees.filter(e => e.status === '퇴사');

    // Filter employees based on search
    const filteredEmployees = employees
        .filter(e => e.status === '재직중')
        .filter(e =>
            e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
            e.department.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .slice(0, 5);

    // Department stats
    const departmentCounts = employees.reduce((acc, emp) => {
        if (emp.status !== '재직중') return acc;
        acc[emp.department] = (acc[emp.department] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const topDepartments = Object.entries(departmentCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="space-y-4">
            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground">{t('all')}</span>
                    </div>
                    <p className="text-2xl font-bold">{employees.length}</p>
                </Card>
                <Card className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <UserCheck className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs text-muted-foreground">{t('employeeActive')}</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">{activeEmployees.length}</p>
                </Card>
                <Card className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <UserX className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-muted-foreground">{t('onLeave')}</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-600">{onLeaveEmployees.length}</p>
                </Card>
            </div>

            {/* Department Distribution */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {t('headcountByDepartment')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-2">
                        {topDepartments.map(([dept, count]) => (
                            <div
                                key={dept}
                                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                            >
                                <span className="text-sm truncate">{dept}</span>
                                <Badge variant="secondary" className="shrink-0">{count}{t('peopleUnit')}</Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Quick Employee Search */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{t('employeeSearch')}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder={t('searchNamePositionDept')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <div className="space-y-2">
                        {filteredEmployees.map((emp) => (
                            <div
                                key={emp.id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                                <Avatar className="w-8 h-8">
                                    <AvatarFallback className="text-xs bg-primary/10">
                                        {getInitials(emp.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{emp.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {emp.position} · {emp.department}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {filteredEmployees.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                {t('noResults')}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* View Details Button */}
            {onViewDetails && (
                <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={onViewDetails}
                >
                    {t('viewFullHRInfo')}
                    <ChevronRight className="w-4 h-4" />
                </Button>
            )}
        </div>
    );
}

export default MobileHRSummary;
