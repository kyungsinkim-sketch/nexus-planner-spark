import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar, Clock, Dumbbell, Users, CheckCircle, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/stores/appStore';

// Types
interface TrainingSession {
    id: string;
    userId: string;
    userName: string;
    date: string;
    timeSlot: string;
    exerciseContent?: string;
    trainerConfirmed: boolean;
    traineeConfirmed: boolean;
}

interface LockerAssignment {
    lockerNumber: number;
    userId: string;
    userName: string;
    assignedDate: string;
}

// Time slots for the weekly calendar
const timeSlots = [
    '오전 9시', '오전 10시', '오전 11시', '오후 12시',
    '오후 1시', '오후 2시', '오후 3시', '오후 4시', '오후 5시'
];

// Convert time slot to hour (24-hour format)
const timeSlotToHour = (slot: string): number => {
    const hourMap: { [key: string]: number } = {
        '오전 9시': 9, '오전 10시': 10, '오전 11시': 11, '오후 12시': 12,
        '오후 1시': 13, '오후 2시': 14, '오후 3시': 15, '오후 4시': 16, '오후 5시': 17
    };
    return hourMap[slot] || 9;
};

export function WelfareTab() {
    const { t } = useTranslation();
    const { users, currentUser, addEvent } = useAppStore();
    const [selectedTab, setSelectedTab] = useState('calendar');

    // Training sessions state - added more historical data
    const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([
        { id: '1', userId: 'u1', userName: '김현진', date: '2026-02-04', timeSlot: '오전 9시', trainerConfirmed: false, traineeConfirmed: false },
        { id: '2', userId: 'u2', userName: '홍원준', date: '2026-02-04', timeSlot: '오전 10시', trainerConfirmed: false, traineeConfirmed: false },
        { id: '3', userId: 'u3', userName: 'KS', date: '2026-02-04', timeSlot: '오후 2시', exerciseContent: 'Bench Press 3 sets, Squat 5 sets', trainerConfirmed: true, traineeConfirmed: true },
        { id: '4', userId: 'u4', userName: '이분이', date: '2026-02-04', timeSlot: '오후 3시', trainerConfirmed: false, traineeConfirmed: false },
        // Historical records for KS
        { id: '5', userId: 'u3', userName: 'KS', date: '2026-02-01', timeSlot: '오전 11시', exerciseContent: 'Deadlift 4 sets, Rows 3 sets', trainerConfirmed: true, traineeConfirmed: true },
        { id: '6', userId: 'u3', userName: 'KS', date: '2026-01-28', timeSlot: '오전 10시', exerciseContent: 'Squats 5 sets, Lunges 3 sets', trainerConfirmed: true, traineeConfirmed: true },
        { id: '7', userId: 'u3', userName: 'KS', date: '2026-01-25', timeSlot: '오후 2시', exerciseContent: 'Pull-ups 4 sets, Dips 3 sets', trainerConfirmed: true, traineeConfirmed: false },
    ]);

    // Locker assignments state
    const [lockerAssignments, setLockerAssignments] = useState<LockerAssignment[]>([
        { lockerNumber: 1, userId: 'u1', userName: '이지우', assignedDate: '2026-01-01' },
        { lockerNumber: 2, userId: 'u2', userName: '정승제', assignedDate: '2026-01-01' },
        { lockerNumber: 7, userId: 'u3', userName: '이분이', assignedDate: '2026-01-05' },
        { lockerNumber: 8, userId: 'u4', userName: 'Saffaan', assignedDate: '2026-01-05' },
        { lockerNumber: 10, userId: 'u5', userName: 'Paul Kim', assignedDate: '2026-02-04' },
    ]);

    // Dialog states
    const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
    const [isLockerDialogOpen, setIsLockerDialogOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedLockerNumber, setSelectedLockerNumber] = useState(0);

    // Training records state - now session-based instead of user-based
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [currentRecordsDate, setCurrentRecordsDate] = useState('2026-02-04'); // Using fixed date for demo

    // Current week dates (for calendar view)
    const [currentWeekStart, setCurrentWeekStart] = useState(new Date('2026-02-02'));

    const getWeekDates = () => {
        const dates = [];
        for (let i = 0; i < 5; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + i);
            dates.push(date);
        }
        return dates;
    };

    const weekDates = getWeekDates();

    // Navigate weeks
    const goToPreviousWeek = () => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() - 7);
        setCurrentWeekStart(newDate);
    };

    const goToNextWeek = () => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + 7);
        setCurrentWeekStart(newDate);
    };

    // Get sessions for a specific date and time
    const getSessionsForSlot = (date: Date, timeSlot: string) => {
        const dateStr = date.toISOString().split('T')[0];
        return trainingSessions.filter(s => s.date === dateStr && s.timeSlot === timeSlot);
    };

    // Handle calendar cell click
    const handleCalendarCellClick = (date: Date, timeSlot: string) => {
        const sessions = getSessionsForSlot(date, timeSlot);

        // Check if slot is already occupied (1 person per hour limit)
        if (sessions.length >= 1) {
            toast.error('이 시간대는 이미 예약되어 있습니다 (1시간당 1명 제한)');
            return;
        }

        setSelectedDate(date.toISOString().split('T')[0]);
        setSelectedTimeSlot(timeSlot);
        setSelectedUserId('');
        setIsBookingDialogOpen(true);
    };

    // Handle booking creation
    const handleCreateBooking = async () => {
        if (!selectedUserId) {
            toast.error('사용자를 선택해주세요');
            return;
        }

        const user = users.find(u => u.id === selectedUserId);
        if (!user) return;

        const newSession: TrainingSession = {
            id: `session-${Date.now()}`,
            userId: selectedUserId,
            userName: user.name,
            date: selectedDate,
            timeSlot: selectedTimeSlot,
            trainerConfirmed: false,
            traineeConfirmed: false,
        };

        setTrainingSessions([...trainingSessions, newSession]);

        // Add to user's personal calendar
        const hour = timeSlotToHour(selectedTimeSlot);
        const startDate = new Date(selectedDate);
        startDate.setHours(hour, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setHours(hour + 1, 0, 0, 0);

        try {
            await addEvent({
                title: 'Renatus 트레이닝',
                type: 'MEETING',
                startAt: startDate.toISOString(),
                endAt: endDate.toISOString(),
                ownerId: selectedUserId,
                source: 'PAULUS',
            });
            toast.success(`${user.name}님의 예약이 생성되고 개인 캘린더에 추가되었습니다`);
        } catch (error) {
            toast.success('예약이 생성되었습니다');
        }

        setIsBookingDialogOpen(false);
        setSelectedUserId('');
    };

    // Handle locker click
    const handleLockerClick = (lockerNumber: number) => {
        const assignment = lockerAssignments.find(l => l.lockerNumber === lockerNumber);

        if (assignment) {
            // Show confirmation to remove
            if (confirm(`사물함 ${lockerNumber}번의 배정을 해제하시겠습니까?\n현재 사용자: ${assignment.userName}`)) {
                setLockerAssignments(prev => prev.filter(l => l.lockerNumber !== lockerNumber));
                toast.success('사물함 배정이 해제되었습니다');
            }
        } else {
            // Open dialog to assign
            setSelectedLockerNumber(lockerNumber);
            setSelectedUserId('');
            setIsLockerDialogOpen(true);
        }
    };

    // Handle locker assignment
    const handleAssignLocker = () => {
        if (!selectedUserId) {
            toast.error('사용자를 선택해주세요');
            return;
        }

        const user = users.find(u => u.id === selectedUserId);
        if (!user) return;

        const newAssignment: LockerAssignment = {
            lockerNumber: selectedLockerNumber,
            userId: selectedUserId,
            userName: user.name,
            assignedDate: new Date().toISOString().split('T')[0],
        };

        setLockerAssignments([...lockerAssignments, newAssignment]);
        toast.success(`사물함 ${selectedLockerNumber}번이 ${user.name}님에게 배정되었습니다`);
        setIsLockerDialogOpen(false);
        setSelectedUserId('');
    };

    // Handle confirmation
    const handleConfirm = (sessionId: string, type: 'trainer' | 'trainee') => {
        setTrainingSessions(prev =>
            prev.map(s =>
                s.id === sessionId
                    ? {
                        ...s,
                        trainerConfirmed: type === 'trainer' ? true : s.trainerConfirmed,
                        traineeConfirmed: type === 'trainee' ? true : s.traineeConfirmed,
                    }
                    : s
            )
        );
        toast.success(`${type === 'trainer' ? 'Trainer' : 'Trainee'} 확인 완료`);
    };

    // Update exercise content
    const handleUpdateExerciseContent = (sessionId: string, content: string) => {
        setTrainingSessions(prev =>
            prev.map(s =>
                s.id === sessionId ? { ...s, exerciseContent: content } : s
            )
        );
    };

    // Get today's sessions sorted by time
    const getTodaysSessions = () => {
        return trainingSessions
            .filter(s => s.date === currentRecordsDate)
            .sort((a, b) => timeSlotToHour(a.timeSlot) - timeSlotToHour(b.timeSlot));
    };

    // Get user's monthly statistics
    const getUserMonthlyStats = (userId: string, sessionDate: string) => {
        const sessionDateObj = new Date(sessionDate);
        const year = sessionDateObj.getFullYear();
        const month = sessionDateObj.getMonth();

        const monthSessions = trainingSessions.filter(s => {
            const sDate = new Date(s.date);
            return s.userId === userId &&
                sDate.getFullYear() === year &&
                sDate.getMonth() === month;
        });

        return {
            monthlyCount: monthSessions.length,
            totalCount: trainingSessions.filter(s => s.userId === userId).length,
        };
    };

    // Get user's previous training records (excluding current session)
    const getUserPreviousRecords = (userId: string, currentSessionId: string) => {
        return trainingSessions
            .filter(s => s.userId === userId && s.id !== currentSessionId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5); // Show last 5 records
    };

    const selectedSession = selectedSessionId ? trainingSessions.find(s => s.id === selectedSessionId) : null;
    const monthlyStats = selectedSession ? getUserMonthlyStats(selectedSession.userId, selectedSession.date) : null;
    const previousRecords = selectedSession ? getUserPreviousRecords(selectedSession.userId, selectedSession.id) : [];

    return (
        <div className="space-y-6">
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="calendar">
                        <Calendar className="w-4 h-4 mr-2" />
                        주차별 예약 캘린더
                    </TabsTrigger>
                    <TabsTrigger value="records">
                        <Dumbbell className="w-4 h-4 mr-2" />
                        트레이닝 기록
                    </TabsTrigger>
                    <TabsTrigger value="lockers">
                        <Users className="w-4 h-4 mr-2" />
                        사물함 관리
                    </TabsTrigger>
                </TabsList>

                {/* Weekly Calendar Tab */}
                <TabsContent value="calendar" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>주차별 예약 현황</CardTitle>
                                    <CardDescription>
                                        캘린더 셀을 클릭하여 예약을 추가하세요 (1시간당 1명)
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <div className="px-4 py-2 text-sm font-medium">
                                        {currentWeekStart.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 주간
                                    </div>
                                    <Button variant="outline" size="sm" onClick={goToNextWeek}>
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-muted/50">
                                            <th className="border p-2 text-sm font-semibold">시간</th>
                                            {weekDates.map((date, idx) => (
                                                <th key={idx} className="border p-2 text-sm font-semibold">
                                                    <div>{date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}</div>
                                                    <div className="text-xs font-normal text-muted-foreground">
                                                        {date.toLocaleDateString('ko-KR', { weekday: 'short' })}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timeSlots.map((timeSlot) => (
                                            <tr key={timeSlot}>
                                                <td className="border p-2 text-sm font-medium bg-muted/30">
                                                    {timeSlot}
                                                </td>
                                                {weekDates.map((date, idx) => {
                                                    const sessions = getSessionsForSlot(date, timeSlot);
                                                    const isOccupied = sessions.length >= 1;
                                                    return (
                                                        <td
                                                            key={idx}
                                                            className={`border p-2 text-sm cursor-pointer transition-colors ${isOccupied
                                                                ? 'bg-primary/10'
                                                                : 'hover:bg-muted/50'
                                                                }`}
                                                            onClick={() => handleCalendarCellClick(date, timeSlot)}
                                                        >
                                                            {sessions.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {sessions.map(session => (
                                                                        <div
                                                                            key={session.id}
                                                                            className="text-xs bg-primary/20 px-2 py-1 rounded font-medium text-center"
                                                                        >
                                                                            {session.userName}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="text-muted-foreground text-xs text-center">+</div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Training Records Tab */}
                <TabsContent value="records" className="space-y-4">
                    <div className="grid grid-cols-12 gap-4">
                        {/* Left: Today's Sessions by Time */}
                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle className="text-base">오늘의 예약</CardTitle>
                                <CardDescription className="text-xs">
                                    {new Date(currentRecordsDate).toLocaleDateString('ko-KR', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {getTodaysSessions().length > 0 ? (
                                        getTodaysSessions().map((session) => (
                                            <div
                                                key={session.id}
                                                className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedSessionId === session.id
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted/50 hover:bg-muted'
                                                    }`}
                                                onClick={() => setSelectedSessionId(session.id)}
                                            >
                                                <div className="font-medium text-sm">{session.userName}</div>
                                                <div className="text-xs opacity-80 flex items-center gap-1 mt-1">
                                                    <Clock className="w-3 h-3" />
                                                    {session.timeSlot}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground text-sm">
                                            오늘 예약이 없습니다
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Right: Session Details & History */}
                        <Card className="col-span-9">
                            <CardHeader>
                                <CardTitle>
                                    {selectedSession
                                        ? `${selectedSession.userName}님의 트레이닝`
                                        : '트레이닝 상세'}
                                </CardTitle>
                                <CardDescription>운동 내용 및 상호 확인 현황</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {selectedSession ? (
                                    <div className="space-y-6">
                                        {/* Current Session Details */}
                                        <div className="p-4 border rounded-lg bg-card space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-xs">
                                                    <Clock className="w-3 h-3 mr-1" />
                                                    {selectedSession.date} {selectedSession.timeSlot}
                                                </Badge>
                                            </div>
                                            <Textarea
                                                value={selectedSession.exerciseContent || ''}
                                                onChange={(e) => handleUpdateExerciseContent(selectedSession.id, e.target.value)}
                                                placeholder="오늘 진행한 운동 내용을 입력하세요..."
                                                rows={3}
                                                className="text-sm"
                                            />
                                            <div className="flex gap-2 justify-end">
                                                {selectedSession.trainerConfirmed ? (
                                                    <Badge variant="default" className="text-xs whitespace-nowrap">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Trainer 확인
                                                    </Badge>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleConfirm(selectedSession.id, 'trainer')}
                                                        className="whitespace-nowrap"
                                                    >
                                                        Trainer 확인
                                                    </Button>
                                                )}
                                                {selectedSession.traineeConfirmed ? (
                                                    <Badge variant="default" className="text-xs whitespace-nowrap">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        Trainee 확인
                                                    </Badge>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleConfirm(selectedSession.id, 'trainee')}
                                                        className="whitespace-nowrap"
                                                    >
                                                        Trainee 확인
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Monthly Statistics */}
                                        {monthlyStats && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 border rounded-lg bg-muted/30">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <TrendingUp className="w-4 h-4 text-primary" />
                                                        <span className="text-sm font-medium">이번 달 운동 횟수</span>
                                                    </div>
                                                    <div className="text-2xl font-bold">{monthlyStats.monthlyCount}회</div>
                                                </div>
                                                <div className="p-4 border rounded-lg bg-muted/30">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Dumbbell className="w-4 h-4 text-primary" />
                                                        <span className="text-sm font-medium">총 누적 횟수</span>
                                                    </div>
                                                    <div className="text-2xl font-bold">{monthlyStats.totalCount}회</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Previous Training Records */}
                                        <div>
                                            <h4 className="font-semibold mb-3">이전 트레이닝 기록</h4>
                                            {previousRecords.length > 0 ? (
                                                <div className="space-y-2">
                                                    {previousRecords.map((record) => (
                                                        <div
                                                            key={record.id}
                                                            className="p-3 border rounded-lg bg-muted/20"
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <Badge variant="outline" className="text-xs">
                                                                    {record.date} {record.timeSlot}
                                                                </Badge>
                                                                <div className="flex gap-1">
                                                                    {record.trainerConfirmed && (
                                                                        <Badge variant="secondary" className="text-xs">
                                                                            <CheckCircle className="w-3 h-3 mr-1" />
                                                                            Trainer
                                                                        </Badge>
                                                                    )}
                                                                    {record.traineeConfirmed && (
                                                                        <Badge variant="secondary" className="text-xs">
                                                                            <CheckCircle className="w-3 h-3 mr-1" />
                                                                            Trainee
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {record.exerciseContent && (
                                                                <p className="text-sm text-muted-foreground">
                                                                    {record.exerciseContent}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 text-muted-foreground text-sm">
                                                    이전 기록이 없습니다
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        좌측에서 세션을 선택하여 트레이닝 기록을 확인하세요
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Lockers Tab */}
                <TabsContent value="lockers" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div>
                                <CardTitle>사물함 관리</CardTitle>
                                <CardDescription>사물함을 클릭하여 배정하거나 해제하세요</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-5 gap-3">
                                {Array.from({ length: 25 }, (_, i) => i + 1).map((lockerNum) => {
                                    const assignment = lockerAssignments.find(l => l.lockerNumber === lockerNum);
                                    return (
                                        <div
                                            key={lockerNum}
                                            className={`p-4 border-2 rounded-lg text-center cursor-pointer transition-all hover:scale-105 ${assignment
                                                ? 'bg-primary/10 border-primary hover:bg-primary/20'
                                                : 'bg-muted/30 border-muted hover:bg-muted/50'
                                                }`}
                                            onClick={() => handleLockerClick(lockerNum)}
                                        >
                                            <div className="text-lg font-bold mb-1">{lockerNum}</div>
                                            {assignment ? (
                                                <div className="text-sm font-medium">{assignment.userName}</div>
                                            ) : (
                                                <div className="text-xs text-muted-foreground">비어있음</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Booking Dialog */}
            <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>트레이닝 예약</DialogTitle>
                        <DialogDescription>
                            {selectedDate} {selectedTimeSlot}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">사용자 선택</label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="사용자 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleCreateBooking}>예약 생성</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Locker Assignment Dialog */}
            <Dialog open={isLockerDialogOpen} onOpenChange={setIsLockerDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>사물함 {selectedLockerNumber}번 배정</DialogTitle>
                        <DialogDescription>사용자를 선택하여 사물함을 배정하세요</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">사용자 선택</label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="사용자 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsLockerDialogOpen(false)}>
                            취소
                        </Button>
                        <Button onClick={handleAssignLocker}>배정</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
