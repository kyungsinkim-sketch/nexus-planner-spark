import { useState } from 'react';
import { GoogleCalendarSettings, GoogleCalendarSyncStatus } from '@/types/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar,
  RefreshCw, 
  Check, 
  X, 
  AlertCircle,
  ExternalLink,
  Clock,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';

// Mock initial settings
const initialSettings: GoogleCalendarSettings = {
  isConnected: false,
  syncStatus: 'DISCONNECTED',
  autoSync: true,
};

export function SettingsPage() {
  const { currentUser } = useAppStore();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<GoogleCalendarSettings>(initialSettings);
  const [isSyncing, setIsSyncing] = useState(false);

  const statusConfig: Record<GoogleCalendarSyncStatus, { 
    label: string; 
    icon: typeof Check; 
    className: string;
  }> = {
    DISCONNECTED: {
      label: t('disconnected'),
      icon: X,
      className: 'bg-muted text-muted-foreground'
    },
    CONNECTED: {
      label: t('connected'),
      icon: Check,
      className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
    },
    SYNCING: {
      label: t('syncing'),
      icon: RefreshCw,
      className: 'bg-blue-500/10 text-blue-600 border-blue-500/30'
    },
    ERROR: {
      label: t('syncError'),
      icon: AlertCircle,
      className: 'bg-destructive/10 text-destructive border-destructive/30'
    },
  };

  const handleConnect = () => {
    // Mock OAuth flow
    toast.info(t('openingGoogleSignIn'), {
      description: t('pleaseAuthorize'),
    });

    // Simulate connection — use current user's email as default
    setTimeout(() => {
      setSettings({
        isConnected: true,
        syncStatus: 'CONNECTED',
        lastSyncAt: new Date().toISOString(),
        connectedEmail: currentUser?.email || `${currentUser?.name || 'user'}@paulus.pro`,
        autoSync: true,
      });
      toast.success(t('googleCalendarConnected'), {
        description: t('calendarSyncedWithPaulus'),
      });
    }, 1500);
  };

  const handleDisconnect = () => {
    setSettings({
      isConnected: false,
      syncStatus: 'DISCONNECTED',
      autoSync: true,
    });
    toast.success(t('googleCalendarDisconnected'), {
      description: t('googleCalendarDisconnectedDesc'),
    });
  };

  const handleSync = () => {
    setIsSyncing(true);
    setSettings((prev) => ({ ...prev, syncStatus: 'SYNCING' }));

    // Simulate sync
    setTimeout(() => {
      setIsSyncing(false);
      setSettings((prev) => ({
        ...prev,
        syncStatus: 'CONNECTED',
        lastSyncAt: new Date().toISOString(),
      }));
      toast.success(t('syncComplete'), {
        description: t('syncCompleteDesc'),
      });
    }, 2000);
  };

  const handleAutoSyncToggle = (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, autoSync: enabled }));
    toast.success(enabled ? t('autoSyncEnabled') : t('autoSyncDisabled'));
  };

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString();
  };

  const StatusIcon = statusConfig[settings.syncStatus].icon;

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('manageIntegrations')}
          </p>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Google Calendar Integration */}
        <Card className="p-6 shadow-card">
          <div className="flex items-start gap-4">
            {/* Google Calendar Icon */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-white" />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Google Calendar</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t('syncEventsBetween')}
                  </p>
                </div>
                <Badge 
                  variant="outline" 
                  className={`gap-1.5 ${statusConfig[settings.syncStatus].className}`}
                >
                  <StatusIcon className={`w-3 h-3 ${settings.syncStatus === 'SYNCING' ? 'animate-spin' : ''}`} />
                  {statusConfig[settings.syncStatus].label}
                </Badge>
              </div>

              <Separator className="my-4" />

              {settings.isConnected ? (
                <div className="space-y-4">
                  {/* Connected Account Info */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {settings.connectedEmail}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('connectedAccount')}</p>
                    </div>
                  </div>

                  {/* Sync Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {t('lastSynced')}: {formatLastSync(settings.lastSyncAt)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSync}
                      disabled={isSyncing}
                      className="gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? t('syncing') : t('syncNow')}
                    </Button>
                  </div>

                  {/* Auto-sync Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <Label htmlFor="auto-sync" className="text-sm font-medium">
                        {t('autoSync')}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('autoSyncDescription')}
                      </p>
                    </div>
                    <Switch
                      id="auto-sync"
                      checked={settings.autoSync}
                      onCheckedChange={handleAutoSyncToggle}
                    />
                  </div>

                  {/* Disconnect Button */}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnect}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {t('disconnectGoogleCalendar')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <p className="text-sm text-muted-foreground">
                      {t('syncCalendarDescription')}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Check className="w-3 h-3 text-emerald-500" />
                        {t('viewGoogleEvents')}
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3 h-3 text-emerald-500" />
                        {t('autoTwoWaySync')}
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-3 h-3 text-emerald-500" />
                        {t('realTimeUpdates')}
                      </li>
                    </ul>
                  </div>

                  <Button onClick={handleConnect} className="gap-2 w-full sm:w-auto">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {t('connectGoogleCalendar')}
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
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('comingSoonIntegrations')}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default SettingsPage;
