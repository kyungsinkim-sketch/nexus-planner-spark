import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MapPin, CalendarPlus, ListChecks } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { LocationShareDialog } from './LocationShareDialog';
import { ScheduleShareDialog } from './ScheduleShareDialog';
import { DecisionShareDialog } from './DecisionShareDialog';
import type { LocationShare, ScheduleShare, DecisionShare } from '@/types/core';

interface ChatShareMenuProps {
  onShareLocation: (data: LocationShare) => void;
  onShareSchedule: (data: ScheduleShare) => void;
  onShareDecision: (data: DecisionShare) => void;
  chatMemberIds?: string[];
}

export function ChatShareMenu({ onShareLocation, onShareSchedule, onShareDecision, chatMemberIds }: ChatShareMenuProps) {
  const { t } = useTranslation();
  const [locationOpen, setLocationOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Share content">
            <Plus className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-52">
          <DropdownMenuItem onClick={() => setLocationOpen(true)} className="gap-2">
            <MapPin className="w-4 h-4 text-blue-500" />
            {t('shareLocation')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setScheduleOpen(true)} className="gap-2">
            <CalendarPlus className="w-4 h-4 text-green-500" />
            {t('shareSchedule')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDecisionOpen(true)} className="gap-2">
            <ListChecks className="w-4 h-4 text-violet-500" />
            {t('requestDecision')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LocationShareDialog
        open={locationOpen}
        onOpenChange={setLocationOpen}
        onSubmit={(data) => { onShareLocation(data); setLocationOpen(false); }}
      />
      <ScheduleShareDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSubmit={(data) => { onShareSchedule(data); setScheduleOpen(false); }}
        chatMemberIds={chatMemberIds}
      />
      <DecisionShareDialog
        open={decisionOpen}
        onOpenChange={setDecisionOpen}
        onSubmit={(data) => { onShareDecision(data); setDecisionOpen(false); }}
      />
    </>
  );
}
