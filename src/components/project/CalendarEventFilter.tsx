import { EventType } from '@/types/core';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, Calendar, Users, Presentation, Truck, Dumbbell } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { TranslationKey } from '@/lib/i18n';

interface CalendarEventFilterProps {
  selectedTypes: EventType[];
  onToggleType: (type: EventType) => void;
  eventCounts: Record<EventType, number>;
}

const eventTypeConfig: Record<EventType, { labelKey: TranslationKey; icon: typeof CheckSquare; colorClass: string }> = {
  TASK: { labelKey: 'task', icon: CheckSquare, colorClass: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  DEADLINE: { labelKey: 'deadline', icon: Calendar, colorClass: 'bg-red-500/10 text-red-600 border-red-500/30' },
  MEETING: { labelKey: 'meeting', icon: Users, colorClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  PT: { labelKey: 'pt', icon: Presentation, colorClass: 'bg-violet-500/10 text-violet-600 border-violet-500/30' },
  DELIVERY: { labelKey: 'delivery', icon: Truck, colorClass: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  TODO: { labelKey: 'todo', icon: CheckSquare, colorClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30' },
  DELIVERABLE: { labelKey: 'deliverable', icon: Truck, colorClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  R_TRAINING: { labelKey: 'renatus', icon: Dumbbell, colorClass: 'bg-pink-500/10 text-pink-600 border-pink-500/30' },
};

export function CalendarEventFilter({ selectedTypes, onToggleType, eventCounts }: CalendarEventFilterProps) {
  const allTypes: EventType[] = ['TASK', 'PT', 'MEETING', 'DELIVERY', 'DEADLINE', 'TODO', 'DELIVERABLE', 'R_TRAINING'];
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2">
      {allTypes.map((type) => {
        const config = eventTypeConfig[type];
        const Icon = config.icon;
        const isSelected = selectedTypes.includes(type);
        const count = eventCounts[type] || 0;

        return (
          <Button
            key={type}
            variant="outline"
            size="sm"
            onClick={() => onToggleType(type)}
            className={`gap-2 transition-all ${
              isSelected 
                ? config.colorClass + ' border' 
                : 'opacity-50 hover:opacity-100'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {t(config.labelKey)}
            {count > 0 && (
              <Badge 
                variant="secondary" 
                className={`text-[10px] px-1.5 py-0 min-w-[18px] ${
                  isSelected ? 'bg-background/50' : ''
                }`}
              >
                {count}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
