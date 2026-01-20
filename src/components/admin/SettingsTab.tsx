import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, RotateCcw, Calculator, Info } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsTab() {
  const { scoreSettings, updateScoreSettings } = useAppStore();
  const [localSettings, setLocalSettings] = useState(scoreSettings);
  const [saved, setSaved] = useState(false);

  const handleFinancialChange = (value: number[]) => {
    const financialWeight = value[0];
    setLocalSettings({
      financialWeight,
      peerWeight: 100 - financialWeight,
    });
    setSaved(false);
  };

  const handleSave = () => {
    updateScoreSettings(localSettings);
    setSaved(true);
    toast.success('Settings saved', {
      description: 'Score calculation weights have been updated (UI only)',
    });
  };

  const handleReset = () => {
    const defaults = { financialWeight: 70, peerWeight: 30 };
    setLocalSettings(defaults);
    updateScoreSettings(defaults);
    setSaved(true);
    toast.info('Settings reset', {
      description: 'Weights restored to default values',
    });
  };

  return (
    <div className="space-y-6">
      {/* Score Calculation Settings */}
      <Card className="p-6 shadow-card">
        <div className="flex items-start gap-3 mb-6">
          <Calculator className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-medium text-foreground">Score Calculation Weights</h3>
            <p className="text-sm text-muted-foreground">
              Configure how the total performance score is calculated
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Financial Weight */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Financial Contribution Weight</Label>
              <Badge variant="outline" className="text-lg font-semibold">
                {localSettings.financialWeight}%
              </Badge>
            </div>
            <Slider
              value={[localSettings.financialWeight]}
              onValueChange={handleFinancialChange}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Based on project revenue contribution and ROI
            </p>
          </div>

          {/* Peer Weight (Derived) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Peer Feedback Weight</Label>
              <Badge variant="outline" className="text-lg font-semibold">
                {localSettings.peerWeight}%
              </Badge>
            </div>
            <div className="w-full h-2 bg-muted rounded-full">
              <div 
                className="h-2 bg-violet-500 rounded-full transition-all"
                style={{ width: `${localSettings.peerWeight}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Based on average peer review ratings (1-5 scale)
            </p>
          </div>

          <Separator />

          {/* Formula Preview */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Score Formula</span>
            </div>
            <code className="text-sm text-muted-foreground">
              Total Score = (Financial Score × {(localSettings.financialWeight / 100).toFixed(2)}) + (Peer Score × {(localSettings.peerWeight / 100).toFixed(2)})
            </code>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </Button>
          <div className="flex items-center gap-3">
            {saved && (
              <Badge variant="secondary" className="text-emerald-600 bg-emerald-500/10">
                Saved (UI only)
              </Badge>
            )}
            <Button size="sm" onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </Card>

      {/* Additional Settings Placeholder */}
      <Card className="p-6 shadow-card">
        <h3 className="font-medium text-foreground mb-4">Advanced Settings</h3>
        
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="evalPeriod">Evaluation Period</Label>
              <Input id="evalPeriod" defaultValue="Monthly" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minFeedback">Minimum Feedback Count</Label>
              <Input id="minFeedback" type="number" defaultValue={3} disabled />
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground italic">
            (Advanced settings - Backend integration required)
          </p>
        </div>
      </Card>
    </div>
  );
}