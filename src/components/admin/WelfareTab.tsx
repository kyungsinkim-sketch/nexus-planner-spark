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
import { Input } from '@/components/ui/input';
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

    // Training sessions state - dates relative to current week
    const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(() => {
        const today = new Date();
        const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
        const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return toDateStr(d); };
        return [
            { id: '1', userId: 'u1', userName: '김현진', date: toDateStr(today), timeSlot: '오전 9시', trainerConfirmed: false, traineeConfirmed: false },
            { id: '2', userId: 'u2', userName: '홍원준', date: toDateStr(today), timeSlot: '오전 10시', trainerConfirmed: false, traineeConfirmed: false },
            { id: '3', userId: 'u3', userName: 'KS', date: toDateStr(today), timeSlot: '오후 2시', exerciseContent: 'Bench Press 3 sets, Squat 5 sets', trainerConfirmed: true, traineeConfirmed: true },
            { id: '4', userId: 'u4', userName: '이분이', date: toDateStr(today), timeSlot: '오후 3시', trainerConfirmed: false, traineeConfirmed: false },
            // Historical records for KS
            { id: '5', userId: 'u3', userName: 'KS', date: daysAgo(3), timeSlot: '오전 11시', exerciseContent: 'Deadlift 4 sets, Rows 3 sets', trainerConfirmed: true, traineeConfirmed: true },
            { id: '6', userId: 'u3', userName: 'KS', date: daysAgo(7), timeSlot: '오전 10시', exerciseContent: 'Squats 5 sets, Lunges 3 sets', trainerConfirmed: true, traineeConfirmed: true },
            { id: '7', userId: 'u3', userName: 'KS', date: daysAgo(10), timeSlot: '오후 2시', exerciseContent: 'Pull-ups 4 sets, Dips 3 sets', trainerConfirmed: true, traineeConfirmed: false },
        ];
    });

    // Locker assignments state
    const [lockerAssignments, setLockerAssignments] = useState<LockerAssignment[]>(() => {
        const today = new Date().toISOString().slice(0, 10);
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        return [
            { lockerNumber: 1, userId: 'u1', userName: '이지우', assignedDate: monthAgo },
            { lockerNumber: 2, userId: 'u2', userName: '정승제', assignedDate: monthAgo },
            { lockerNumber: 7, userId: 'u3', userName: '이분이', assignedDate: monthAgo },
            { lockerNumber: 8, userId: 'u4', userName: 'Saffaan', assignedDate: monthAgo },
            { lockerNumber: 10, userId: 'u5', userName: 'Paul Kim', assignedDate: today },
        ];
    });

    // Dialog states
    const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
    const [isLockerDialogOpen, setIsLockerDialogOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedLockerNumber, setSelectedLockerNumber] = useState(0);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [isCreatingBooking, setIsCreatingBooking] = useState(false);

    // Edit booking dialog state
    const [isEditBookingOpen, setIsEditBookingOpen] = useState(false);
    const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
    const [editTimeSlot, setEditTimeSlot] = useState('');
    const [editDate, setEditDate] = useState('');

    // Drag-and-drop state
    const [dragSession, setDragSession] = useState<TrainingSession | null>(null);

    // Training records state - now session-based instead of user-based
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [currentRecordsDate, setCurrentRecordsDate] = useState(() => {
        return new Date().toISOString().slice(0, 10);
    });

    // Current week dates (for calendar view) — default to current week's Monday
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const now = new Date();
        const day = now.getDay(); // 0=Sun, 1=Mon, ...
        const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
        const monday = new Date(now);
        monday.setDate(now.getDate() + diff);
        monday.setHours(0, 0, 0, 0);
        return monday;
    });

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

        // If slot is occupied → open edit dialog
        if (sessions.length >= 1) {
            const session = sessions[0];
            setEditingSession(session);
            setEditTimeSlot(session.timeSlot);
            setEditDate(session.date);
            setIsEditBookingOpen(true);
            return;
        }

        // Empty slot → open create dialog
        setSelectedDate(date.toISOString().split('T')[0]);
        setSelectedTimeSlot(timeSlot);
        setSelectedUserId('');
        setIsBookingDialogOpen(true);
    };

    // Handle edit booking save (change time/date)
    const handleSaveEditBooking = () => {
        if (!editingSession) return;

        // Check if new slot is occupied (unless it's the same slot)
        if (editTimeSlot !== editingSession.timeSlot || editDate !== editingSession.date) {
            const targetDate = new Date(editDate);
            const occupied = getSessionsForSlot(targetDate, editTimeSlot);
            if (occupied.length > 0 && occupied[0].id !== editingSession.id) {
                toast.error(t('slotAlreadyBooked'));
                return;
            }
        }

        setTrainingSessions(prev =>
            prev.map(s =>
                s.id === editingSession.id
                    ? { ...s, timeSlot: editTimeSlot, date: editDate }
                    : s
            )
        );
        toast.success(t('bookingUpdated') || '예약이 수정되었습니다');
        setIsEditBookingOpen(false);
        setEditingSession(null);
    };

    // Handle delete booking
    const handleDeleteBooking = () => {
        if (!editingSession) return;
        setTrainingSessions(prev => prev.filter(s => s.id !== editingSession.id));
        toast.success(t('bookingDeleted') || '예약이 삭제되었습니다');
        setIsEditBookingOpen(false);
        setEditingSession(null);
    };

    // Drag-and-drop handlers
    const handleDragStart = (session: TrainingSession) => {
        setDragSession(session);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (date: Date, timeSlot: string) => {
        if (!dragSession) return;

        const dateStr = date.toISOString().split('T')[0];

        // Skip if dropping on same slot
        if (dragSession.timeSlot === timeSlot && dragSession.date === dateStr) {
            setDragSession(null);
            return;
        }

        // Check if target slot is occupied
        const occupied = getSessionsForSlot(date, timeSlot);
        if (occupied.length > 0) {
            toast.error(t('slotAlreadyBooked'));
            setDragSession(null);
            return;
        }

        // Move session to new slot
        setTrainingSessions(prev =>
            prev.map(s =>
                s.id === dragSession.id
                    ? { ...s, timeSlot, date: dateStr }
                    : s
            )
        );
        toast.success(t('bookingMoved') || '예약이 이동되었습니다');
        setDragSession(null);
    };

    // Handle booking creation (with guard to prevent duplicate events)
    const handleCreateBooking = async () => {
        if (isCreatingBooking) return; // prevent double-click
        if (!selectedUserId) {
            toast.error(t('selectUser'));
            return;
        }

        const user = users.find(u => u.id === selectedUserId);
        if (!user) return;

        setIsCreatingBooking(true);

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

        // Add to user's personal calendar (single event only)
        const hour = timeSlotToHour(selectedTimeSlot);
        const startDate = new Date(selectedDate);
        startDate.setHours(hour, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setHours(hour + 1, 0, 0, 0);

        // Check for existing duplicate event before creating
        const { events: existingEvents } = useAppStore.getState();
        const eventTitle = t('renatusTrainingEvent');
        const hasDuplicate = existingEvents.some(
            e => e.title === eventTitle &&
                 e.ownerId === selectedUserId &&
                 e.startAt === startDate.toISOString()
        );

        if (!hasDuplicate) {
            try {
                await addEvent({
                    title: eventTitle,
                    type: 'R_TRAINING',
                    startAt: startDate.toISOString(),
                    endAt: endDate.toISOString(),
                    ownerId: selectedUserId,
                    source: 'PAULUS',
                });
                toast.success(`${user.name}${t('bookingCreatedWithCalendar')}`);
            } catch (error) {
                toast.success(t('bookingCreated'));
            }
        } else {
            toast.success(t('bookingCreated'));
        }

        setIsBookingDialogOpen(false);
        setSelectedUserId('');
        setIsCreatingBooking(false);
    };

    // Handle locker click
    const handleLockerClick = (lockerNumber: number) => {
        const assignment = lockerAssignments.find(l => l.lockerNumber === lockerNumber);

        if (assignment) {
            // Show confirmation to remove
            if (confirm(t('confirmLockerRelease').replace('{n}', String(lockerNumber)).replace('{user}', assignment.userName))) {
                setLockerAssignments(prev => prev.filter(l => l.lockerNumber !== lockerNumber));
                toast.success(t('lockerReleased'));
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
            toast.error(t('selectUser'));
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
        toast.success(t('lockerAssigned').replace('{n}', String(selectedLockerNumber)).replace('{user}', user.name));
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
        toast.success(`${type === 'trainer' ? 'Trainer' : 'Trainee'} ${t('confirmationComplete')}`);
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
                        {t('weeklyBookingCalendar')}
                    </TabsTrigger>
                    <TabsTrigger value="records">
                        <Dumbbell className="w-4 h-4 mr-2" />
                        {t('trainingRecords')}
                    </TabsTrigger>
                    <TabsTrigger value="lockers">
                        <Users className="w-4 h-4 mr-2" />
                        {t('lockerManagement')}
                    </TabsTrigger>
                </TabsList>

                {/* Weekly Calendar Tab */}
                <TabsContent value="calendar" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>{t('weeklyBookingStatus')}</CardTitle>
                                    <CardDescription>
                                        {t('clickCellToBookOrEdit')}
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <div className="px-4 py-2 text-sm font-medium">
                                        {currentWeekStart.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} {t('weekLabel')}
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
                                            <th className="border p-2 text-sm font-semibold">{t('timeLabel')}</th>
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
                                                    const isDragOver = dragSession && !isOccupied;
                                                    return (
                                                        <td
                                                            key={idx}
                                                            className={`border p-2 text-sm cursor-pointer transition-colors ${isOccupied
                                                                ? 'bg-primary/10 hover:bg-primary/20'
                                                                : isDragOver ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'hover:bg-muted/50'
                                                                }`}
                                                            onClick={() => handleCalendarCellClick(date, timeSlot)}
                                                            onDragOver={handleDragOver}
                                                            onDrop={() => handleDrop(date, timeSlot)}
                                                        >
                                                            {sessions.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {sessions.map(session => (
                                                                        <div
                                                                            key={session.id}
                                                                            draggable
                                                                            onDragStart={() => handleDragStart(session)}
                                                                            onDragEnd={() => setDragSession(null)}
                                                                            className="text-xs bg-primary/20 px-2 py-1 rounded font-medium text-center cursor-grab active:cursor-grabbing hover:bg-primary/30 transition-colors select-none"
                                                                            title={`${session.userName} — ${t('edit')}`}
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
                                <CardTitle className="text-base">{t('todayBookings')}</CardTitle>
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
                                            {t('noBookingsToday')}
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
                                        ? `${selectedSession.userName}${t('userTraining')}`
                                        : t('trainingDetail')}
                                </CardTitle>
                                <CardDescription>{t('exerciseContentAndConfirmation')}</CardDescription>
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
                                                placeholder={t('exerciseContentPlaceholder')}
                                                rows={3}
                                                className="text-sm"
                                            />
                                            <div className="flex gap-2 justify-end">
                                                {selectedSession.trainerConfirmed ? (
                                                    <Badge variant="default" className="text-xs whitespace-nowrap">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        {t('trainerConfirm')}
                                                    </Badge>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleConfirm(selectedSession.id, 'trainer')}
                                                        className="whitespace-nowrap"
                                                    >
                                                        {t('trainerConfirm')}
                                                    </Button>
                                                )}
                                                {selectedSession.traineeConfirmed ? (
                                                    <Badge variant="default" className="text-xs whitespace-nowrap">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        {t('traineeConfirm')}
                                                    </Badge>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleConfirm(selectedSession.id, 'trainee')}
                                                        className="whitespace-nowrap"
                                                    >
                                                        {t('traineeConfirm')}
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
                                                        <span className="text-sm font-medium">{t('monthlyExerciseCount')}</span>
                                                    </div>
                                                    <div className="text-2xl font-bold">{monthlyStats.monthlyCount}{t('exerciseCountSuffix')}</div>
                                                </div>
                                                <div className="p-4 border rounded-lg bg-muted/30">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Dumbbell className="w-4 h-4 text-primary" />
                                                        <span className="text-sm font-medium">{t('totalAccumulatedCount')}</span>
                                                    </div>
                                                    <div className="text-2xl font-bold">{monthlyStats.totalCount}{t('exerciseCountSuffix')}</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Previous Training Records */}
                                        <div>
                                            <h4 className="font-semibold mb-3">{t('previousTrainingRecords')}</h4>
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
                                                    {t('noPreviousRecords')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        {t('selectSessionToView')}
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
                                <CardTitle>{t('lockerManagement')}</CardTitle>
                                <CardDescription>{t('clickLockerToManage')}</CardDescription>
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
                                                <div className="text-xs text-muted-foreground">{t('lockerEmpty')}</div>
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
            <Dialog open={isBookingDialogOpen} onOpenChange={(open) => {
                setIsBookingDialogOpen(open);
                if (!open) { setUserSearchQuery(''); setShowUserDropdown(false); }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('trainingBooking')}</DialogTitle>
                        <DialogDescription>
                            {selectedDate} {selectedTimeSlot}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="text-sm font-medium">{t('selectUserLabel')}</label>
                            <Input
                                placeholder={t('selectUserLabel')}
                                value={userSearchQuery}
                                onChange={(e) => {
                                    setUserSearchQuery(e.target.value);
                                    setShowUserDropdown(true);
                                    if (!e.target.value) setSelectedUserId('');
                                }}
                                onFocus={() => setShowUserDropdown(true)}
                            />
                            {showUserDropdown && userSearchQuery && (
                                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                                    {users
                                        .filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                        .map((user) => (
                                            <button
                                                key={user.id}
                                                type="button"
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedUserId === user.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                                                onClick={() => {
                                                    setSelectedUserId(user.id);
                                                    setUserSearchQuery(user.name);
                                                    setShowUserDropdown(false);
                                                }}
                                            >
                                                <span>{user.name}</span>
                                                <span className="text-xs text-muted-foreground ml-2">{user.department}</span>
                                            </button>
                                        ))
                                    }
                                    {users.filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase())).length === 0 && (
                                        <div className="px-3 py-2 text-sm text-muted-foreground">검색 결과 없음</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)}>
                            {t('cancel')}
                        </Button>
                        <Button onClick={handleCreateBooking} disabled={isCreatingBooking}>{t('createBooking')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Booking Dialog */}
            <Dialog open={isEditBookingOpen} onOpenChange={(open) => {
                setIsEditBookingOpen(open);
                if (!open) setEditingSession(null);
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('edit')} — {editingSession?.userName}</DialogTitle>
                        <DialogDescription>
                            {t('trainingBooking')} {editingSession?.date} {editingSession?.timeSlot}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Date */}
                        <div>
                            <label className="text-sm font-medium">{t('date')}</label>
                            <Input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                            />
                        </div>
                        {/* Time Slot */}
                        <div>
                            <label className="text-sm font-medium">{t('timeLabel')}</label>
                            <Select value={editTimeSlot} onValueChange={setEditTimeSlot}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {timeSlots.map((slot) => (
                                        <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Confirmation Status */}
                        {editingSession && (
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    Trainer: {editingSession.trainerConfirmed
                                        ? <CheckCircle className="w-3 h-3 text-green-500" />
                                        : <Clock className="w-3 h-3 text-amber-500" />}
                                </span>
                                <span className="flex items-center gap-1">
                                    Trainee: {editingSession.traineeConfirmed
                                        ? <CheckCircle className="w-3 h-3 text-green-500" />
                                        : <Clock className="w-3 h-3 text-amber-500" />}
                                </span>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="flex justify-between sm:justify-between">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteBooking}
                        >
                            {t('delete')}
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsEditBookingOpen(false)}>
                                {t('cancel')}
                            </Button>
                            <Button size="sm" onClick={handleSaveEditBooking}>
                                {t('save')}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Locker Assignment Dialog */}
            <Dialog open={isLockerDialogOpen} onOpenChange={(open) => {
                setIsLockerDialogOpen(open);
                if (!open) { setUserSearchQuery(''); setShowUserDropdown(false); }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('lockerAssignment').replace('{n}', String(selectedLockerNumber))}</DialogTitle>
                        <DialogDescription>{t('selectUserForLocker')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="text-sm font-medium">{t('selectUserLabel')}</label>
                            <Input
                                placeholder={t('selectUserLabel')}
                                value={userSearchQuery}
                                onChange={(e) => {
                                    setUserSearchQuery(e.target.value);
                                    setShowUserDropdown(true);
                                    if (!e.target.value) setSelectedUserId('');
                                }}
                                onFocus={() => setShowUserDropdown(true)}
                            />
                            {showUserDropdown && userSearchQuery && (
                                <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                                    {users
                                        .filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                        .map((user) => (
                                            <button
                                                key={user.id}
                                                type="button"
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedUserId === user.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                                                onClick={() => {
                                                    setSelectedUserId(user.id);
                                                    setUserSearchQuery(user.name);
                                                    setShowUserDropdown(false);
                                                }}
                                            >
                                                <span>{user.name}</span>
                                                <span className="text-xs text-muted-foreground ml-2">{user.department}</span>
                                            </button>
                                        ))
                                    }
                                    {users.filter(u => u.name.toLowerCase().includes(userSearchQuery.toLowerCase())).length === 0 && (
                                        <div className="px-3 py-2 text-sm text-muted-foreground">검색 결과 없음</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsLockerDialogOpen(false)}>
                            {t('cancel')}
                        </Button>
                        <Button onClick={handleAssignLocker}>{t('assign')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
