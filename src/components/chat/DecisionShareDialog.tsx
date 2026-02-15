import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ListChecks, Plus, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { DecisionShare, DecisionOption } from '@/types/core';

interface DecisionShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DecisionShare) => void;
}

export function DecisionShareDialog({ open, onOpenChange, onSubmit }: DecisionShareDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<{ title: string; description: string }[]>([
    { title: '', description: '' },
    { title: '', description: '' },
  ]);

  const addOption = () => {
    setOptions([...options, { title: '', description: '' }]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, field: 'title' | 'description', value: string) => {
    const updated = [...options];
    updated[index] = { ...updated[index], [field]: value };
    setOptions(updated);
  };

  const handleSubmit = () => {
    const validOptions = options.filter(o => o.title.trim());
    if (!title.trim() || validOptions.length < 2) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      options: validOptions.map((o, i) => ({
        id: `opt_${Date.now()}_${i}`,
        title: o.title.trim(),
        description: o.description.trim() || undefined,
      })),
      votes: [],
      status: 'open',
    });

    setTitle('');
    setDescription('');
    setOptions([{ title: '', description: '' }, { title: '', description: '' }]);
  };

  const validCount = options.filter(o => o.title.trim()).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-violet-500" />
            {t('requestDecision')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>{t('decisionTopic')}</Label>
            <Input
              placeholder={t('decisionTopicExample')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('descriptionOptional')}</Label>
            <Textarea
              placeholder={t('decisionDescriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('optionsMinTwo')}</Label>
              <Button variant="ghost" size="sm" onClick={addOption} className="gap-1 text-xs">
                <Plus className="w-3 h-3" /> {t('add')}
              </Button>
            </div>
            {options.map((option, index) => (
              <div key={index} className="rounded-lg border p-3 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{t('optionNumber').replace('{n}', String(index + 1))}</span>
                  {options.length > 2 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeOption(index)}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <Input
                  placeholder={t('optionTitlePlaceholder')}
                  value={option.title}
                  onChange={(e) => updateOption(index, 'title', e.target.value)}
                />
                <Input
                  placeholder={t('optionDescriptionPlaceholder')}
                  value={option.description}
                  onChange={(e) => updateOption(index, 'description', e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || validCount < 2}>
            {t('shareWithOptions').replace('{count}', String(validCount))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
