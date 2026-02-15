import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Package,
  FileText,
  Settings,
  Laptop,
  Key
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export function GeneralAffairsTab() {
  const { t } = useTranslation();
  const modules = [
    { label: t('assetManagement'), description: t('assetManagementDesc'), icon: Laptop, status: 'planned' },
    { label: t('facilityManagement'), description: t('facilityManagementDesc'), icon: Building2, status: 'planned' },
    { label: t('documentManagement'), description: t('documentManagementDesc'), icon: FileText, status: 'planned' },
    { label: t('accountManagement'), description: t('accountManagementDesc'), icon: Key, status: 'planned' },
    { label: t('supplyManagement'), description: t('supplyManagementDesc'), icon: Package, status: 'planned' },
    { label: t('generalSettings'), description: t('generalSettingsDesc'), icon: Settings, status: 'planned' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <Card key={module.label} className="p-6 shadow-card hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <module.icon className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground">{module.label}</h3>
                  <Badge variant="outline" className="text-xs">{t('planned')}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <Card className="p-6 shadow-card bg-muted/30">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">{t('generalAffairsModule')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('generalAffairsModuleDesc')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
