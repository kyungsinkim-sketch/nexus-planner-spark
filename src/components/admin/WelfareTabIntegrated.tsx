import { useState, useEffect } from 'react';
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
import { Calendar, Clock, Dumbbell, Users, CheckCircle, ChevronLeft, ChevronRight, TrendingUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/stores/appStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as welfareService from '@/services/welfareService';
import type { TrainingSession, LockerAssignment } from '@/services/welfareService';

// Time slots for the weekly calendar
const timeSlots = [
    '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
];

// Convert time slot to hour (24-hour format)
const timeSlotToHour = (slot: string): number => {
    const hourMap: { [key: string]: number } = {
        '9:00 AM': 9, '10:00 AM': 10, '11:00 AM': 11, '12:00 PM': 12,
        '1:00 PM': 13, '2:00 PM': 14, '3:00 PM': 15, '4:00 PM': 16, '5:00 PM': 17
    };
    return hourMap[slot] || 9;
};

// Mock data fallback
const mockTrainingSessions: TrainingSession[] = [
    { id: '1', userId: 'u1', userName: 'Kim HJ', date: '2026-02-04', timeSlot: '9:00 AM', trainerConfirmed: false, traineeConfirmed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: '2', userId: 'u2', userName: 'Hong WJ', date: '2026-02-04', timeSlot: '10:00 AM', trainerConfirmed: false, traineeConfirmed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: '3', userId: 'u3', userName: 'KS', date: '2026-02-04', timeSlot: '2:00 PM', exerciseContent: 'Bench Press 3 sets, Squat 5 sets', trainerConfirmed: true, traineeConfirmed: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const mockLockerAssignments: LockerAssignment[] = [
    { lockerNumber: 1, userId: 'u1', userName: 'Lee JW', assignedDate: '2026-01-01', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { lockerNumber: 2, userId: 'u2', userName: 'Jung SJ', assignedDate: '2026-01-01', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { lockerNumber: 7, userId: 'u3', userName: 'Lee BI', assignedDate: '2026-01-05', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export function WelfareTabIntegrated() {
    const { t } = useTranslation();
    const { users, currentUser, addEvent } = useAppStore();
    const [selectedTab, setSelectedTab] = useState('calendar');
    const [isLoading, setIsLoading] = useState(false);
    const [useSupabase] = useState(isSupabaseConfigured());

    // Training sessions state
    const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(mockTrainingSessions);

    // Locker assignments state
    const [lockerAssignments, setLockerAssignments] = useState<LockerAssignment[]>(mockLockerAssignments);

    // Dialog states
    const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
    const [isLockerDialogOpen, setIsLockerDialogOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedLockerNumber, setSelectedLockerNumber] = useState(0);

    // Training records state
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [currentRecordsDate, setCurrentRecordsDate] = useState('2026-02-04');

    // Current week dates (for calendar view)
    const [currentWeekStart, setCurrentWeekStart] = useState(new Date('2026-02-02'));

    // Load data on mount
    useEffect(() => {
        if (useSupabase) {
            loadTrainingSessions();
            loadLockerAssignments();
        }
    }, [useSupabase]);

    // Setup realtime subscriptions
    useEffect(() => {
        if (!useSupabase) return;

        const unsubscribeTraining = welfareService.subscribeToTrainingSessions((session) => {
            setTrainingSessions(prev => {
                const index = prev.findIndex(s => s.id === session.id);
                if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = session;
                    return updated;
                }
                return [...prev, session];
            });
        });

        const unsubscribeLocker = welfareService.subscribeToLockerAssignments((assignment) => {
            setLockerAssignments(prev => {
                const index = prev.findIndex(a => a.lockerNumber === assignment.lockerNumber);
                if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = assignment;
                    return updated;
                }
                return [...prev, assignment];
            });
        });

        return () => {
            unsubscribeTraining();
            unsubscribeLocker();
        };
    }, [useSupabase]);

    const loadTrainingSessions = async () => {
        try {
            setIsLoading(true);
            const sessions = await welfareService.getTrainingSessions();
            setTrainingSessions(sessions);
        } catch (error) {
            console.error('Failed to load training sessions:', error);
            toast.error('Failed to load training sessions');
        } finally {
            setIsLoading(false);
        }
    };

    const loadLockerAssignments = async () => {
        try {
            const assignments = await welfareService.getLockerAssignments();
            setLockerAssignments(assignments);
        } catch (error) {
            console.error('Failed to load locker assignments:', error);
            toast.error('Failed to load locker assignments');
        }
    };

    const handleBookSession = async () => {
        if (!selectedDate || !selectedTimeSlot || !selectedUserId) {
            toast.error('Please fill in all fields');
            return;
        }

        try {
            setIsLoading(true);

            if (useSupabase) {
                const newSession = await welfareService.createTrainingSession({
                    userId: selectedUserId,
                    date: selectedDate,
                    timeSlot: selectedTimeSlot,
                });
                setTrainingSessions(prev => [...prev, newSession]);
            } else {
                // Mock fallback
                const user = users.find(u => u.id === selectedUserId);
                const newSession: TrainingSession = {
                    id: Date.now().toString(),
                    userId: selectedUserId,
                    userName: user?.name || 'Unknown',
                    date: selectedDate,
                    timeSlot: selectedTimeSlot,
                    trainerConfirmed: false,
                    traineeConfirmed: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                setTrainingSessions(prev => [...prev, newSession]);
            }

            toast.success('Training session booked successfully');
            setIsBookingDialogOpen(false);
            setSelectedDate('');
            setSelectedTimeSlot('');
            setSelectedUserId('');
        } catch (error) {
            console.error('Failed to book session:', error);
            toast.error('Failed to book training session');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAssignLocker = async () => {
        if (!selectedLockerNumber || !selectedUserId) {
            toast.error('Please select a locker and user');
            return;
        }

        try {
            setIsLoading(true);

            if (useSupabase) {
                const newAssignment = await welfareService.createLockerAssignment({
                    lockerNumber: selectedLockerNumber,
                    userId: selectedUserId,
                });
                setLockerAssignments(prev => [...prev, newAssignment]);
            } else {
                // Mock fallback
                const user = users.find(u => u.id === selectedUserId);
                const newAssignment: LockerAssignment = {
                    lockerNumber: selectedLockerNumber,
                    userId: selectedUserId,
                    userName: user?.name || 'Unknown',
                    assignedDate: new Date().toISOString().split('T')[0],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                setLockerAssignments(prev => [...prev, newAssignment]);
            }

            toast.success('Locker assigned successfully');
            setIsLockerDialogOpen(false);
            setSelectedLockerNumber(0);
            setSelectedUserId('');
        } catch (error) {
            console.error('Failed to assign locker:', error);
            toast.error('Failed to assign locker');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmSession = async (sessionId: string, type: 'trainer' | 'trainee') => {
        try {
            setIsLoading(true);

            if (useSupabase) {
                const updates = type === 'trainer'
                    ? { trainerConfirmed: true }
                    : { traineeConfirmed: true };

                const updated = await welfareService.updateTrainingSession(sessionId, updates);
                setTrainingSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
            } else {
                // Mock fallback
                setTrainingSessions(prev => prev.map(session => {
                    if (session.id === sessionId) {
                        return {
                            ...session,
                            ...(type === 'trainer' ? { trainerConfirmed: true } : { traineeConfirmed: true }),
                            updatedAt: new Date().toISOString(),
                        };
                    }
                    return session;
                }));
            }

            toast.success(`${type === 'trainer' ? 'Trainer' : 'Trainee'} confirmation recorded`);
        } catch (error) {
            console.error('Failed to confirm session:', error);
            toast.error('Failed to confirm session');
        } finally {
            setIsLoading(false);
        }
    };

    // Get week dates for calendar
    const getWeekDates = () => {
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + i);
            dates.push(date);
        }
        return dates;
    };

    const weekDates = getWeekDates();

    // Get sessions for a specific date and time slot
    const getSessionForSlot = (date: Date, timeSlot: string) => {
        const dateStr = date.toISOString().split('T')[0];
        return trainingSessions.find(s => s.date === dateStr && s.timeSlot === timeSlot);
    };

    // Get available lockers
    const availableLockers = Array.from({ length: 20 }, (_, i) => i + 1)
        .filter(num => !lockerAssignments.some(a => a.lockerNumber === num));

    return (
        <div className="space-y-6">
            {/* Header with Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Dumbbell className="w-4 h-4 text-pink-500" />
                            {t('totalSessions')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{trainingSessions.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {trainingSessions.filter(s => s.trainerConfirmed && s.traineeConfirmed).length} confirmed
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-500" />
                            Active Users
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {new Set(trainingSessions.map(s => s.userId)).size}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            This month
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            Lockers Assigned
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {lockerAssignments.length}/20
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {availableLockers.length} available
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="calendar">
                        <Calendar className="w-4 h-4 mr-2" />
                        Calendar
                    </TabsTrigger>
                    <TabsTrigger value="records">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Records
                    </TabsTrigger>
                    <TabsTrigger value="lockers">
                        <Users className="w-4 h-4 mr-2" />
                        Lockers
                    </TabsTrigger>
                </TabsList>

                {/* Calendar Tab */}
                <TabsContent value="calendar" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                    const newDate = new Date(currentWeekStart);
                                    newDate.setDate(newDate.getDate() - 7);
                                    setCurrentWeekStart(newDate);
                                }}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <h3 className="text-lg font-semibold">
                                {weekDates[0].toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} - {weekDates[6].toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                            </h3>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                    const newDate = new Date(currentWeekStart);
                                    newDate.setDate(newDate.getDate() + 7);
                                    setCurrentWeekStart(newDate);
                                }}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                        <Button onClick={() => setIsBookingDialogOpen(true)} disabled={isLoading}>
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <Dumbbell className="w-4 h-4 mr-2" />
                            Book Session
                        </Button>
                    </div>

                    {/* Weekly Calendar Grid */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="p-3 text-left text-sm font-medium text-muted-foreground w-24">
                                                Time
                                            </th>
                                            {weekDates.map((date, i) => (
                                                <th key={i} className="p-3 text-center text-sm font-medium">
                                                    <div>{date.toLocaleDateString('ko-KR', { weekday: 'short' })}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timeSlots.map((slot) => (
                                            <tr key={slot} className="border-b hover:bg-accent/50">
                                                <td className="p-3 text-sm font-medium text-muted-foreground">
                                                    {slot}
                                                </td>
                                                {weekDates.map((date, i) => {
                                                    const session = getSessionForSlot(date, slot);
                                                    return (
                                                        <td key={i} className="p-2">
                                                            {session ? (
                                                                <div className="p-2 rounded-lg bg-pink-500/10 border border-pink-500/20 text-xs">
                                                                    <div className="font-medium">{session.userName}</div>
                                                                    {session.trainerConfirmed && session.traineeConfirmed && (
                                                                        <Badge variant="secondary" className="mt-1 text-[10px]">
                                                                            Confirmed
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="h-12" />
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

                {/* Records Tab - Simplified for now */}
                <TabsContent value="records">
                    <Card>
                        <CardHeader>
                            <CardTitle>Training Records</CardTitle>
                            <CardDescription>View and manage training session records</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {trainingSessions
                                    .filter(s => s.exerciseContent)
                                    .map(session => (
                                        <div key={session.id} className="p-4 border rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="font-medium">{session.userName}</div>
                                                <Badge variant="secondary">
                                                    {new Date(session.date).toLocaleDateString()}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {session.exerciseContent}
                                            </p>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Lockers Tab */}
                <TabsContent value="lockers">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Locker Assignments</h3>
                        <Button onClick={() => setIsLockerDialogOpen(true)} disabled={isLoading}>
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Assign Locker
                        </Button>
                    </div>

                    <div className="grid grid-cols-5 gap-3">
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(num => {
                            const assignment = lockerAssignments.find(a => a.lockerNumber === num);
                            return (
                                <Card
                                    key={num}
                                    className={assignment ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}
                                >
                                    <CardContent className="p-4 text-center">
                                        <div className="text-2xl font-bold mb-1">{num}</div>
                                        {assignment ? (
                                            <div className="text-xs text-muted-foreground truncate">
                                                {assignment.userName}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-muted-foreground">Available</div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Booking Dialog */}
            <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Book Training Session</DialogTitle>
                        <DialogDescription>
                            Schedule a new training session
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">User</label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select user" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map(user => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Date</label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded-md"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Time Slot</label>
                            <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select time" />
                                </SelectTrigger>
                                <SelectContent>
                                    {timeSlots.map(slot => (
                                        <SelectItem key={slot} value={slot}>
                                            {slot}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleBookSession} disabled={isLoading}>
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Book Session
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Locker Assignment Dialog */}
            <Dialog open={isLockerDialogOpen} onOpenChange={setIsLockerDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Locker</DialogTitle>
                        <DialogDescription>
                            Assign a locker to a user
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Locker Number</label>
                            <Select value={selectedLockerNumber.toString()} onValueChange={(v) => setSelectedLockerNumber(parseInt(v))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select locker" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableLockers.map(num => (
                                        <SelectItem key={num} value={num.toString()}>
                                            Locker {num}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">User</label>
                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select user" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map(user => (
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
                            Cancel
                        </Button>
                        <Button onClick={handleAssignLocker} disabled={isLoading}>
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Assign Locker
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
