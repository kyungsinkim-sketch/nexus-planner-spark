/**
 * MobileAdminPage
 * 모바일 전용 Admin 페이지 - 단순화된 UI
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Users,
    TrendingUp,
    FolderKanban,
    Settings,
    Dumbbell,
    ChevronLeft,
} from 'lucide-react';
import { MobileFinanceSummary } from './MobileFinanceSummary';
import { MobileHRSummary } from './MobileHRSummary';
import { WelfareTab } from './WelfareTab';
import { AdminSettingsTab } from './AdminSettingsTab';
import { GeneralAffairsTab } from './GeneralAffairsTab';
// Full desktop views for "View Details"
import { FinanceTab } from './FinanceTab';
import { HumanResourceTab } from './HumanResourceTab';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

type MobileAdminSection = 'menu' | 'hr' | 'hr-full' | 'finance' | 'finance-full' | 'ga' | 'welfare' | 'settings';

interface MenuItemProps {
    icon: React.ElementType;
    label: string;
    description: string;
    color: string;
    bgColor: string;
    onClick: () => void;
}

function MenuItem({ icon: Icon, label, description, color, bgColor, onClick }: MenuItemProps) {
    return (
        <Card
            className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
            onClick={onClick}
        >
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bgColor)}>
                        <Icon className={cn("w-6 h-6", color)} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{label}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function MobileAdminPage() {
    const { t } = useTranslation();
    const [section, setSection] = useState<MobileAdminSection>('menu');

    const menuItems = [
        {
            id: 'hr' as const,
            icon: Users,
            label: t('hrManagement'),
            description: t('hrManagementDesc'),
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
        },
        {
            id: 'finance' as const,
            icon: TrendingUp,
            label: t('financeManagement'),
            description: t('financeManagementDesc'),
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-100',
        },
        {
            id: 'ga' as const,
            icon: FolderKanban,
            label: t('gaManagement'),
            description: t('gaManagementDesc'),
            color: 'text-violet-600',
            bgColor: 'bg-violet-100',
        },
        {
            id: 'welfare' as const,
            icon: Dumbbell,
            label: t('welfareManagement'),
            description: t('welfareManagementDesc'),
            color: 'text-pink-600',
            bgColor: 'bg-pink-100',
        },
        {
            id: 'settings' as const,
            icon: Settings,
            label: t('settings'),
            description: t('settingsDesc'),
            color: 'text-orange-600',
            bgColor: 'bg-orange-100',
        },
    ];

    const getSectionTitle = () => {
        switch (section) {
            case 'hr':
            case 'hr-full':
                return t('hrManagement');
            case 'finance':
            case 'finance-full':
                return t('financeManagement');
            case 'ga':
                return t('gaManagement');
            case 'welfare':
                return t('welfareManagement');
            case 'settings':
                return t('settings');
            default:
                return t('adminDashboard');
        }
    };

    const renderContent = () => {
        switch (section) {
            case 'menu':
                return (
                    <div className="space-y-3">
                        {menuItems.map((item) => (
                            <MenuItem
                                key={item.id}
                                {...item}
                                onClick={() => setSection(item.id)}
                            />
                        ))}
                    </div>
                );

            case 'hr':
                return (
                    <MobileHRSummary
                        onViewDetails={() => setSection('hr-full')}
                    />
                );

            case 'hr-full':
                return <HumanResourceTab />;

            case 'finance':
                return (
                    <MobileFinanceSummary
                        onViewDetails={() => setSection('finance-full')}
                    />
                );

            case 'finance-full':
                return <FinanceTab />;

            case 'ga':
                return <GeneralAffairsTab />;

            case 'welfare':
                return <WelfareTab />;

            case 'settings':
                return <AdminSettingsTab />;

            default:
                return null;
        }
    };

    const canGoBack = section !== 'menu';

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-background border-b px-4 py-3">
                <div className="flex items-center gap-3">
                    {canGoBack && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => {
                                if (section === 'hr-full') setSection('hr');
                                else if (section === 'finance-full') setSection('finance');
                                else setSection('menu');
                            }}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                    )}
                    <h1 className="text-lg font-bold">{getSectionTitle()}</h1>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {renderContent()}
            </div>
        </div>
    );
}

export default MobileAdminPage;
