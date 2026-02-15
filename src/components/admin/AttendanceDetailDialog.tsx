/**
 * AttendanceDetailDialog
 * 근태 기록의 상세 정보(GPS, 메모 등)를 보여주는 다이얼로그
 */

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import React from 'react';
import { MapPin, Clock, MessageSquare, ExternalLink, Globe, Plane, Film, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type AttendanceRecord, ATTENDANCE_TYPES } from '@/services/attendanceService';
import { useTranslation } from '@/hooks/useTranslation';

interface AttendanceDetailDialogProps {
    record: AttendanceRecord | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    'office': Globe,
    'remote': Home,
    'overseas': Plane,
    'filming': Film,
    'field': MapPin,
};

export function AttendanceDetailDialog({ record, open, onOpenChange }: AttendanceDetailDialogProps) {
    const { t } = useTranslation();
    if (!record) return null;

    const typeInfo = ATTENDANCE_TYPES.find(t => t.id === record.check_in_type);
    const Icon = TYPE_ICONS[record.check_in_type || 'field'];

    const formatTime = (iso: string | null) => {
        if (!iso) return '-';
        return new Date(iso).toLocaleString('ko-KR', {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Google Maps link
    const getMapsUrl = (lat: number, lng: number) => {
        return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-primary/5 text-primary">
                            {typeInfo?.label_ko || record.check_in_type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{record.work_date}</span>
                    </div>
                    <DialogTitle className="flex items-center gap-2">
                        <Icon className="w-5 h-5" />
                        {t('attendanceRecordDetail')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('attendanceRecordDescription')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Time Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {t('checkIn')}
                            </p>
                            <p className="text-sm font-medium">{formatTime(record.check_in_at)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {t('checkOut')}
                            </p>
                            <p className="text-sm font-medium">{formatTime(record.check_out_at)}</p>
                        </div>
                    </div>

                    {/* Location Info (Check-in) */}
                    <div className="space-y-2">
                        <p className="text-sm font-semibold flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-primary" /> {t('checkInLocationInfo')}
                        </p>
                        <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                            <p className="text-xs text-foreground leading-relaxed">
                                {record.check_in_address || t('noAddressInfo')}
                            </p>
                            {record.check_in_latitude && record.check_in_longitude && (
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground">
                                        {record.check_in_latitude.toFixed(6)}, {record.check_in_longitude.toFixed(6)}
                                    </span>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 text-xs gap-1"
                                        onClick={() => window.open(getMapsUrl(record.check_in_latitude!, record.check_in_longitude!), '_blank')}
                                    >
                                        {t('viewOnMap')}
                                        <ExternalLink className="w-3 h-3" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Memo */}
                    {record.check_in_note && (
                        <div className="space-y-2">
                            <p className="text-sm font-semibold flex items-center gap-1">
                                <MessageSquare className="w-4 h-4 text-primary" /> {t('memo')}
                            </p>
                            <div className="p-3 rounded-lg bg-muted/30 border text-sm italic text-muted-foreground">
                                "{record.check_in_note}"
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
