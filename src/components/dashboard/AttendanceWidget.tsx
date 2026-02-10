/**
 * AttendanceWidget - 출퇴근 위젯
 * Dashboard에서 사용하는 빠른 출퇴근 컴포넌트
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Clock,
    LogIn,
    LogOut,
    MapPin,
    Building2,
    Home,
    Plane,
    Film,
    Map,
    Loader2,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/stores/appStore';
import type { UserWorkStatus } from '@/types/core';
import {
    getTodayAttendance,
    checkIn,
    checkOut,
    getCurrentPosition,
    ATTENDANCE_TYPES,
    type AttendanceRecord,
    type AttendanceType,
    type GeoPosition,
} from '@/services/attendanceService';

// Icon mapping
const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    'office': Building2,
    'remote': Home,
    'overseas': Plane,
    'filming': Film,
    'field': Map,
};

// Map attendance types to UserWorkStatus
const ATTENDANCE_TO_WORK_STATUS: Record<string, UserWorkStatus> = {
  'office': 'AT_WORK',
  'remote': 'REMOTE',
  'overseas': 'OVERSEAS',
  'filming': 'FILMING',
  'field': 'FIELD',
};

const TYPE_COLORS: Record<string, string> = {
    'office': 'bg-blue-100 text-blue-700',
    'remote': 'bg-green-100 text-green-700',
    'overseas': 'bg-purple-100 text-purple-700',
    'filming': 'bg-orange-100 text-orange-700',
    'field': 'bg-teal-100 text-teal-700',
};

export function AttendanceWidget() {
    const { t, language } = useTranslation();
    const { setUserWorkStatus } = useAppStore();
    const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Check-in dialog state
    const [showCheckInDialog, setShowCheckInDialog] = useState(false);
    const [selectedType, setSelectedType] = useState<AttendanceType>('office');
    const [note, setNote] = useState('');
    const [gpsLoading, setGpsLoading] = useState(false);
    const [position, setPosition] = useState<GeoPosition | null>(null);

    // Fetch today's attendance on mount
    useEffect(() => {
        async function fetchAttendance() {
            try {
                const data = await getTodayAttendance();
                setAttendance(data);
            } catch (error) {
                console.error('Failed to fetch attendance:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchAttendance();
    }, []);

    // Check if selected type requires GPS
    const requiresGps = ATTENDANCE_TYPES.find(t => t.id === selectedType)?.requires_gps ?? false;

    // Get GPS position
    const handleGetLocation = useCallback(async () => {
        setGpsLoading(true);
        try {
            const pos = await getCurrentPosition();
            setPosition(pos);
            toast.success('위치 정보를 가져왔습니다');
        } catch (error) {
            console.error('GPS error:', error);
            toast.error(error instanceof Error ? error.message : '위치 정보를 가져올 수 없습니다');
        } finally {
            setGpsLoading(false);
        }
    }, []);

    // Auto-fetch GPS when type changes to one that requires it
    useEffect(() => {
        if (showCheckInDialog && requiresGps && !position) {
            handleGetLocation();
        }
    }, [showCheckInDialog, requiresGps, position, handleGetLocation]);

    // Handle check-in
    const handleCheckIn = async () => {
        if (requiresGps && !position) {
            toast.error('GPS 위치 정보가 필요합니다');
            return;
        }

        setActionLoading(true);
        try {
            const result = await checkIn({
                type: selectedType,
                latitude: position?.latitude,
                longitude: position?.longitude,
                address: position?.address,
                note: note || undefined,
            });
            setAttendance(result);
            setShowCheckInDialog(false);
            // Sync work status with sidebar
            const workStatus = ATTENDANCE_TO_WORK_STATUS[selectedType] || 'AT_WORK';
            setUserWorkStatus(workStatus);
            toast.success('출근 처리되었습니다!');
        } catch (error) {
            console.error('Check-in error:', error);
            toast.error('출근 처리에 실패했습니다');
        } finally {
            setActionLoading(false);
        }
    };

    // Handle check-out
    const handleCheckOut = async () => {
        setActionLoading(true);
        try {
            // Get GPS for check-out if original check-in required it
            let pos: GeoPosition | undefined;
            if (attendance?.check_in_type && ATTENDANCE_TYPES.find(t => t.id === attendance.check_in_type)?.requires_gps) {
                try {
                    pos = await getCurrentPosition();
                } catch (e) {
                    console.warn('Could not get GPS for check-out:', e);
                }
            }

            const result = await checkOut({
                latitude: pos?.latitude,
                longitude: pos?.longitude,
                address: pos?.address,
            });
            setAttendance(result);
            setUserWorkStatus('NOT_AT_WORK');
            toast.success('퇴근 처리되었습니다! 수고하셨습니다');
        } catch (error) {
            console.error('Check-out error:', error);
            toast.error('퇴근 처리에 실패했습니다');
        } finally {
            setActionLoading(false);
        }
    };

    // Format time
    const formatTime = (isoString: string | null) => {
        if (!isoString) return '--:--';
        return new Date(isoString).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    // Format working hours
    const formatWorkingTime = (minutes: number | null) => {
        if (!minutes) return '--시간 --분';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}시간 ${mins}분`;
    };

    // Loading state
    if (loading) {
        return (
            <Card className="shadow-card">
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    // Get current status
    const isCheckedIn = !!attendance?.check_in_at;
    const isCheckedOut = !!attendance?.check_out_at;
    const isWorking = isCheckedIn && !isCheckedOut;
    const TypeIcon = attendance?.check_in_type ? TYPE_ICONS[attendance.check_in_type] : Clock;

    return (
        <>
            <Card className="shadow-card overflow-hidden">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {language === 'ko' ? '오늘의 근태' : "Today's Attendance"}
                        </CardTitle>
                        {attendance?.check_in_type && (
                            <Badge className={TYPE_COLORS[attendance.check_in_type]}>
                                {ATTENDANCE_TYPES.find(t => t.id === attendance.check_in_type)?.[language === 'ko' ? 'label_ko' : 'label_en']}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Status Display */}
                    <div className="flex items-center gap-4">
                        {/* Check-in time */}
                        <div className="flex-1 text-center">
                            <p className="text-xs text-muted-foreground mb-1">출근</p>
                            <p className={`text-lg font-bold ${isCheckedIn ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                {formatTime(attendance?.check_in_at ?? null)}
                            </p>
                        </div>

                        {/* Divider with icon */}
                        <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCheckedOut ? 'bg-emerald-100' : isWorking ? 'bg-primary/10' : 'bg-muted'
                                }`}>
                                {isCheckedOut ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                ) : (
                                    <TypeIcon className={`w-5 h-5 ${isWorking ? 'text-primary' : 'text-muted-foreground'}`} />
                                )}
                            </div>
                        </div>

                        {/* Check-out time */}
                        <div className="flex-1 text-center">
                            <p className="text-xs text-muted-foreground mb-1">퇴근</p>
                            <p className={`text-lg font-bold ${isCheckedOut ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                {formatTime(attendance?.check_out_at ?? null)}
                            </p>
                        </div>
                    </div>

                    {/* Working time (if completed) */}
                    {isCheckedOut && attendance?.working_minutes && (
                        <div className="text-center py-2 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">오늘 근무시간</p>
                            <p className="text-lg font-semibold text-foreground">
                                {formatWorkingTime(attendance.working_minutes)}
                            </p>
                        </div>
                    )}

                    {/* Location info (if GPS recorded) */}
                    {attendance?.check_in_address && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{attendance.check_in_address}</span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        {!isCheckedIn ? (
                            <Button
                                className="flex-1 gap-2"
                                size="lg"
                                onClick={() => setShowCheckInDialog(true)}
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <LogIn className="w-4 h-4" />
                                )}
                                출근하기
                            </Button>
                        ) : !isCheckedOut ? (
                            <Button
                                className="flex-1 gap-2"
                                size="lg"
                                variant="secondary"
                                onClick={handleCheckOut}
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <LogOut className="w-4 h-4" />
                                )}
                                퇴근하기
                            </Button>
                        ) : (
                            <div className="flex-1 text-center py-3 text-emerald-600 font-medium flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-5 h-5" />
                                오늘 근무 완료
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Check-in Dialog */}
            <Dialog open={showCheckInDialog} onOpenChange={setShowCheckInDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LogIn className="w-5 h-5" />
                            출근하기
                        </DialogTitle>
                        <DialogDescription>
                            출근 유형을 선택하고 출근 버튼을 눌러주세요.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Type Selection */}
                        <div className="space-y-2">
                            <Label>출근 유형</Label>
                            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as AttendanceType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ATTENDANCE_TYPES.map((type) => {
                                        const Icon = TYPE_ICONS[type.id];
                                        return (
                                            <SelectItem key={type.id} value={type.id}>
                                                <div className="flex items-center gap-2">
                                                    <Icon className="w-4 h-4" />
                                                    <span>{language === 'ko' ? type.label_ko : type.label_en}</span>
                                                    {type.requires_gps && (
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">GPS</Badge>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* GPS Location (for types that require it) */}
                        {requiresGps && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    현재 위치
                                </Label>
                                <div className="rounded-lg border p-3 bg-muted/30">
                                    {gpsLoading ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            위치 정보를 가져오는 중...
                                        </div>
                                    ) : position ? (
                                        <div className="space-y-1">
                                            <p className="text-sm text-foreground line-clamp-2">
                                                {position.address || `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                정확도: ±{Math.round(position.accuracy)}m
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                                                <AlertCircle className="w-4 h-4" />
                                                위치 정보 없음
                                            </span>
                                            <Button size="sm" variant="outline" onClick={handleGetLocation}>
                                                위치 가져오기
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Note */}
                        <div className="space-y-2">
                            <Label>메모 (선택)</Label>
                            <Textarea
                                placeholder="오늘의 업무 내용이나 특이사항을 입력하세요..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCheckInDialog(false)}>
                            취소
                        </Button>
                        <Button
                            onClick={handleCheckIn}
                            disabled={actionLoading || (requiresGps && !position)}
                            className="gap-2"
                        >
                            {actionLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <LogIn className="w-4 h-4" />
                            )}
                            출근 확인
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default AttendanceWidget;
