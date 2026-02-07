import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Users, TrendingUp, FolderKanban, Settings, Dumbbell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { HumanResourceTab } from '@/components/admin/HumanResourceTab';
import { FinanceTab } from '@/components/admin/FinanceTab';
import { GeneralAffairsTab } from '@/components/admin/GeneralAffairsTab';
import { AdminSettingsTab } from '@/components/admin/AdminSettingsTab';
import { WelfareTab } from '@/components/admin/WelfareTab';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

type AdminSection = 'hr' | 'finance' | 'ga' | 'welfare' | 'settings';

interface NavigationButton {
  id: AdminSection;
  labelKey: string;
  icon: any;
  descriptionKey: string;
  color: string;
  bgGradient: string;
  activeRing: string;
  activeBg: string;
  activeIconBg: string;
  activeText: string;
}

export default function AdminPage() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<AdminSection>('hr');

  const navigationButtons: NavigationButton[] = [
    {
      id: 'hr',
      labelKey: 'humanResource',
      icon: Users,
      descriptionKey: 'employeeManagement',
      color: 'text-blue-500',
      bgGradient: 'from-blue-500/10 to-blue-600/5',
      activeRing: 'ring-blue-500',
      activeBg: 'from-blue-500/20 to-blue-600/10',
      activeIconBg: 'bg-blue-500',
      activeText: 'text-blue-600',
    },
    {
      id: 'finance',
      labelKey: 'finance',
      icon: TrendingUp,
      descriptionKey: 'projectBudgets',
      color: 'text-emerald-500',
      bgGradient: 'from-emerald-500/10 to-emerald-600/5',
      activeRing: 'ring-emerald-500',
      activeBg: 'from-emerald-500/20 to-emerald-600/10',
      activeIconBg: 'bg-emerald-500',
      activeText: 'text-emerald-600',
    },
    {
      id: 'ga',
      labelKey: 'generalAffairs',
      icon: FolderKanban,
      descriptionKey: 'companyResources',
      color: 'text-violet-500',
      bgGradient: 'from-violet-500/10 to-violet-600/5',
      activeRing: 'ring-violet-500',
      activeBg: 'from-violet-500/20 to-violet-600/10',
      activeIconBg: 'bg-violet-500',
      activeText: 'text-violet-600',
    },
    {
      id: 'welfare',
      labelKey: 'welfare',
      icon: Dumbbell,
      descriptionKey: 'renatusTraining',
      color: 'text-pink-500',
      bgGradient: 'from-pink-500/10 to-pink-600/5',
      activeRing: 'ring-pink-500',
      activeBg: 'from-pink-500/20 to-pink-600/10',
      activeIconBg: 'bg-pink-500',
      activeText: 'text-pink-600',
    },
    {
      id: 'settings',
      labelKey: 'adminSettings',
      icon: Settings,
      descriptionKey: 'systemConfiguration',
      color: 'text-orange-500',
      bgGradient: 'from-orange-500/10 to-orange-600/5',
      activeRing: 'ring-orange-500',
      activeBg: 'from-orange-500/20 to-orange-600/10',
      activeIconBg: 'bg-orange-500',
      activeText: 'text-orange-600',
    },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'hr':
        return <HumanResourceTab />;
      case 'finance':
        return <FinanceTab />;
      case 'ga':
        return <GeneralAffairsTab />;
      case 'welfare':
        return <WelfareTab />;
      case 'settings':
        return <AdminSettingsTab />;
      default:
        return <HumanResourceTab />;
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('adminDashboard')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('manageOrganization')}
          </p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {navigationButtons.map((button) => {
          const Icon = button.icon;
          const isActive = activeSection === button.id;

          return (
            <Card
              key={button.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-lg overflow-hidden",
                isActive
                  ? `ring-2 ${button.activeRing} shadow-lg`
                  : "hover:scale-105"
              )}
              onClick={() => setActiveSection(button.id)}
            >
              <div className={cn(
                "p-6 bg-gradient-to-br h-full",
                isActive ? button.activeBg : button.bgGradient
              )}>
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                    isActive ? button.activeIconBg : "bg-background",
                    isActive ? "text-white" : button.color
                  )}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={cn(
                      "font-semibold text-lg mb-1",
                      isActive ? button.activeText : "text-foreground"
                    )}>
                      {t(button.labelKey as any)}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t(button.descriptionKey as any)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="animate-fade-in">
        {renderContent()}
      </div>
    </div>
  );
}
