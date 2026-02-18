import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleCalendarSettings, GoogleCalendarSyncStatus } from '@/types/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Calendar,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  Clock,
  Mail,
  Camera,
  User,
  Lock,
  CalendarPlus,
  Palmtree,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import * as authService from '@/services/authService';
import {
  isGoogleCalendarConfigured,
  startGoogleOAuth,
  handleOAuthCallback,
  syncGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  updateAutoSync,
} from '@/services/googleCalendarService';

const initialSettings: GoogleCalendarSettings = {
  isConnected: false,
  syncStatus: 'DISCONNECTED',
  autoSync: true,
};

export function SettingsPage() {
  const { currentUser, setCurrentUser } = useAppStore();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<GoogleCalendarSettings>(initialSettings);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Profile state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Leave request state
  const [leaveType, setLeaveType] = useState<'annual' | 'substitute'>('annual');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  const isRealOAuth = isGoogleCalendarConfigured();

  // Load Google Calendar connection status on mount
  useEffect(() => {
    if (currentUser?.id && isRealOAuth) {
      getGoogleCalendarStatus(currentUser.id).then(setSettings);
    }
  }, [currentUser?.id, isRealOAuth]);

  // Handle OAuth callback if URL has ?code= parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state && currentUser?.id) {
      window.history.replaceState({}, '', window.location.pathname);
      setIsConnecting(true);
      handleOAuthCallback(code, state).then(async (result) => {
        setIsConnecting(false);
        if (result.success) {
          toast.success(t('googleCalendarConnected'));
          const status = await getGoogleCalendarStatus(currentUser.id);
          setSettings(status);
          handleSync();
        } else {
          toast.error(result.error || 'Failed to connect Google Calendar');
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // --- Avatar Upload ---
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('파일 크기는 5MB 이하여야 합니다');
      return;
    }

    setIsUploading(true);
    try {
      if (isSupabaseConfigured()) {
        const fileExt = file.name.split('.').pop();
        const fileName = `avatars/${currentUser.id}/avatar.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(fileName, file, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('project-files')
          .getPublicUrl(fileName);

        const avatarUrl = `${publicUrl}?t=${Date.now()}`;
        await authService.updateUserProfile(currentUser.id, { avatar: avatarUrl });
        setCurrentUser({ ...currentUser, avatar: avatarUrl });
        toast.success('프로필 사진이 업데이트되었습니다');
      } else {
        const objectUrl = URL.createObjectURL(file);
        setCurrentUser({ ...currentUser, avatar: objectUrl });
        toast.success('프로필 사진이 업데이트되었습니다 (mock)');
      }
    } catch (error) {
      console.error('Avatar upload failed:', error);
      toast.error('사진 업로드에 실패했습니다');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- Password Change ---
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('비밀번호는 최소 6자 이상이어야 합니다');
      return;
    }

    setIsChangingPassword(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      toast.success('비밀번호가 변경되었습니다');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      toast.error('비밀번호 변경 실패: ' + (error instanceof Error ? error.message : ''));
    } finally {
      setIsChangingPassword(false);
    }
  };

  // --- Leave Request ---
  const handleLeaveRequest = () => {
    if (!leaveStart || !leaveEnd) {
      toast.error('시작일과 종료일을 입력하세요');
      return;
    }
    // Mock: just show success toast
    const typeLabel = leaveType === 'annual' ? '연차' : '대체휴무';
    toast.success(`${typeLabel} 신청이 접수되었습니다`, {
      description: `${leaveStart} ~ ${leaveEnd}`,
    });
    setLeaveStart('');
    setLeaveEnd('');
    setLeaveReason('');
  };

  // --- Google Calendar Handlers ---
  const statusConfig: Record<GoogleCalendarSyncStatus, {
    label: string;
    icon: typeof Check;
    className: string;
  }> = {
    DISCONNECTED: { label: t('disconnected'), icon: X, className: 'bg-muted text-muted-foreground' },
    CONNECTED: { label: t('connected'), icon: Check, className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
    SYNCING: { label: t('syncing'), icon: RefreshCw, className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
    ERROR: { label: t('syncError'), icon: AlertCircle, className: 'bg-destructive/10 text-destructive border-destructive/30' },
  };

  const handleConnect = useCallback(() => {
    if (!currentUser?.id) return;
    if (isRealOAuth) {
      startGoogleOAuth(currentUser.id);
    } else {
      toast.info(t('openingGoogleSignIn'), { description: t('pleaseAuthorize') });
      setTimeout(() => {
        setSettings({
          isConnected: true, syncStatus: 'CONNECTED',
          lastSyncAt: new Date().toISOString(),
          connectedEmail: currentUser?.email || `${currentUser?.name || 'user'}@re-be.io`,
          autoSync: true,
        });
        toast.success(t('googleCalendarConnected'), { description: t('calendarSyncedWithPaulus') });
      }, 1500);
    }
  }, [currentUser, isRealOAuth, t]);

  const handleDisconnect = useCallback(async () => {
    if (!currentUser?.id) return;
    if (isRealOAuth) {
      const result = await disconnectGoogleCalendar(currentUser.id, false);
      if (result.success) { setSettings(initialSettings); toast.success(t('googleCalendarDisconnected')); }
      else { toast.error(result.error || 'Failed to disconnect'); }
    } else {
      setSettings(initialSettings);
      toast.success(t('googleCalendarDisconnected'), { description: t('googleCalendarDisconnectedDesc') });
    }
  }, [currentUser?.id, isRealOAuth, t]);

  const handleSync = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsSyncing(true);
    setSettings((prev) => ({ ...prev, syncStatus: 'SYNCING' }));

    if (isRealOAuth) {
      const result = await syncGoogleCalendar(currentUser.id);
      setIsSyncing(false);
      if (result.success) {
        const status = await getGoogleCalendarStatus(currentUser.id);
        setSettings(status);
        const parts: string[] = [];
        if (result.imported) parts.push(`${result.imported} imported`);
        if (result.exported) parts.push(`${result.exported} exported`);
        if (result.deleted) parts.push(`${result.deleted} deleted`);
        toast.success(t('syncComplete'), { description: parts.length > 0 ? parts.join(', ') : 'Calendar is up to date' });
        useAppStore.getState().loadEvents();
      } else {
        setSettings((prev) => ({ ...prev, syncStatus: 'ERROR' }));
        toast.error(t('syncError'), { description: result.error });
      }
    } else {
      setTimeout(() => {
        setIsSyncing(false);
        setSettings((prev) => ({ ...prev, syncStatus: 'CONNECTED', lastSyncAt: new Date().toISOString() }));
        toast.success(t('syncComplete'), { description: t('syncCompleteDesc') });
      }, 2000);
    }
  }, [currentUser?.id, isRealOAuth, t]);

  const handleAutoSyncToggle = useCallback(async (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, autoSync: enabled }));
    if (isRealOAuth && currentUser?.id) { await updateAutoSync(currentUser.id, enabled); }
    toast.success(enabled ? t('autoSyncEnabled') : t('autoSyncDisabled'));
  }, [currentUser?.id, isRealOAuth, t]);

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffMinutes < 1) return '방금';
    if (diffMinutes < 60) return `${diffMinutes}분 전`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const StatusIcon = statusConfig[settings.syncStatus].icon;

  // Mock leave data
  const remainingAnnualLeave = 11;
  const remainingSubstituteLeave = 2;

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            계정 설정 및 연동 관리
          </p>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* ── Section 1: Profile Info ── */}
        <Card className="p-6 shadow-card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">프로필 정보</h3>
              <p className="text-sm text-muted-foreground mt-0.5">기본 정보 및 프로필 사진</p>
              <Separator className="my-4" />

              <div className="flex items-center gap-5">
                {/* Avatar */}
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    {currentUser?.avatar && <AvatarImage src={currentUser.avatar} alt={currentUser?.name} />}
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                      {currentUser?.name?.split(' ').map(n => n[0]).join('') || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  <button
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <span className="animate-spin w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{currentUser?.name}</span>
                    <Badge variant="secondary">{currentUser?.role}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    {currentUser?.email || '-'}
                  </div>
                  {currentUser?.department && (
                    <p className="text-sm text-muted-foreground">{currentUser.department}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Section 2: Password Change ── */}
        <Card className="p-6 shadow-card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">비밀번호 변경</h3>
              <p className="text-sm text-muted-foreground mt-0.5">계정 보안을 위해 비밀번호를 변경하세요</p>
              <Separator className="my-4" />

              <form onSubmit={handlePasswordChange} className="space-y-3 max-w-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="new-pw">새 비밀번호</Label>
                  <Input
                    id="new-pw"
                    type="password"
                    placeholder="6자 이상 입력"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-pw">비밀번호 확인</Label>
                  <Input
                    id="confirm-pw"
                    type="password"
                    placeholder="비밀번호 재입력"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" size="sm" disabled={isChangingPassword || !newPassword}>
                  {isChangingPassword ? '변경 중...' : '비밀번호 변경'}
                </Button>
              </form>
            </div>
          </div>
        </Card>

        {/* ── Section 3: Leave Request ── */}
        <Card className="p-6 shadow-card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0">
              <Palmtree className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">연차 / 대체휴무 관리</h3>
              <p className="text-sm text-muted-foreground mt-0.5">잔여 휴가 확인 및 사용 신청</p>
              <Separator className="my-4" />

              {/* Remaining leave summary */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs text-muted-foreground">잔여 연차</p>
                  <p className="text-2xl font-bold text-emerald-600">{remainingAnnualLeave}<span className="text-sm font-normal">일</span></p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-muted-foreground">잔여 대체휴무</p>
                  <p className="text-2xl font-bold text-blue-600">{remainingSubstituteLeave}<span className="text-sm font-normal">일</span></p>
                </div>
              </div>

              {/* Leave request form */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant={leaveType === 'annual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLeaveType('annual')}
                    className="gap-1"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    연차
                  </Button>
                  <Button
                    variant={leaveType === 'substitute' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLeaveType('substitute')}
                    className="gap-1"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    대체휴무
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>시작일</Label>
                    <Input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>종료일</Label>
                    <Input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>사유 (선택)</Label>
                  <Input
                    placeholder="사유를 입력하세요"
                    value={leaveReason}
                    onChange={e => setLeaveReason(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={handleLeaveRequest} className="gap-1">
                  <Send className="w-3.5 h-3.5" />
                  휴가 신청
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Section 4: Google Calendar ── */}
        <Card className="p-6 shadow-card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Google Calendar</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('syncEventsBetween')}</p>
                </div>
                <Badge variant="outline" className={`gap-1.5 ${statusConfig[settings.syncStatus].className}`}>
                  <StatusIcon className={`w-3 h-3 ${settings.syncStatus === 'SYNCING' ? 'animate-spin' : ''}`} />
                  {statusConfig[settings.syncStatus].label}
                </Badge>
              </div>
              <Separator className="my-4" />

              {settings.isConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{settings.connectedEmail}</p>
                      <p className="text-xs text-muted-foreground">{t('connectedAccount')}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {t('lastSynced')}: {formatLastSync(settings.lastSyncAt)}
                    </div>
                    <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing} className="gap-2">
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? t('syncing') : t('syncNow')}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <Label htmlFor="auto-sync" className="text-sm font-medium">{t('autoSync')}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{t('autoSyncDescription')}</p>
                    </div>
                    <Switch id="auto-sync" checked={settings.autoSync} onCheckedChange={handleAutoSyncToggle} />
                  </div>
                  <div className="pt-2">
                    <Button variant="outline" size="sm" onClick={handleDisconnect}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      {t('disconnectGoogleCalendar')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <p className="text-sm text-muted-foreground">{t('syncCalendarDescription')}</p>
                    <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" />{t('viewGoogleEvents')}</li>
                      <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" />{t('autoTwoWaySync')}</li>
                      <li className="flex items-center gap-2"><Check className="w-3 h-3 text-emerald-500" />{t('realTimeUpdates')}</li>
                    </ul>
                  </div>
                  {!isRealOAuth && (
                    <p className="text-[10px] text-muted-foreground/60">⚠ VITE_GOOGLE_CLIENT_ID not set — using mock mode</p>
                  )}
                  <Button onClick={handleConnect} disabled={isConnecting} className="gap-2 w-full sm:w-auto">
                    {isConnecting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                    )}
                    {isConnecting ? t('connecting') : t('connectGoogleCalendar')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Future Integrations Placeholder */}
        <Card className="p-6 shadow-card opacity-60">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <ExternalLink className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t('moreIntegrations')}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{t('comingSoonIntegrations')}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default SettingsPage;
