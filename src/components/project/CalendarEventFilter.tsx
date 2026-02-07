import { EventType } from '@/types/core';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, AlertCircle, Users, Presentation, Truck, ListTodo, FileText, Dumbbell } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { TranslationKey } from '@/lib/i18n';

interface CalendarEventFilterProps {
  selectedTypes: EventType[];
  onToggleType: (type: EventType) => void;
  eventCounts: Record<EventType, number>;
}

// Event type icons - same as main calendar
// No colors - differentiation by pictograms only (project key color is used for events)
const eventTypeConfig: Record<EventType, { labelKey: TranslationKey; icon: typeof CheckSquare }> = {
  TASK: { labelKey: 'task', icon: CheckSquare },
  DEADLINE: { labelKey: 'deadline', icon: AlertCircle },
  MEETING: { labelKey: 'meeting', icon: Users },
  PT: { labelKey: 'pt', icon: Presentation },
  DELIVERY: { labelKey: 'delivery', icon: Truck },
  TODO: { labelKey: 'todo', icon: ListTodo },
  DELIVERABLE: { labelKey: 'deliverable', icon: FileText },
  R_TRAINING: { labelKey: 'renatus', icon: Dumbbell },
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
            className={`gap-2 transition-all ${isSelected
                ? 'bg-foreground text-background border-foreground hover:bg-foreground/90'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
              }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {t(config.labelKey)}
            {count > 0 && (
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 py-0 min-w-[18px] ${isSelected ? 'bg-background text-foreground' : 'bg-muted'
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
