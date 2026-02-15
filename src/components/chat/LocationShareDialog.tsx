import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { LocationShare } from '@/types/core';

interface LocationShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: LocationShare) => void;
}

/** URL에서 지도 서비스 자동 감지 */
function detectProvider(url: string): LocationShare['provider'] {
  const lower = url.toLowerCase();
  if (lower.includes('google.com/maps') || lower.includes('goo.gl/maps') || lower.includes('maps.app.goo.gl')) return 'google';
  if (lower.includes('naver.me') || lower.includes('map.naver.com') || lower.includes('naver.com/map')) return 'naver';
  if (lower.includes('kakao') || lower.includes('map.kakao.com') || lower.includes('kko.to')) return 'kakao';
  return 'other';
}

export function LocationShareDialog({ open, onOpenChange, onSubmit }: LocationShareDialogProps) {
  const { t } = useTranslation();
  const providerLabels: Record<LocationShare['provider'], string> = {
    google: 'Google Maps',
    naver: 'Naver Map',
    kakao: 'Kakao Map',
    other: t('otherProvider'),
  };
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState<LocationShare['provider']>('other');

  // URL 변경 시 provider 자동 감지
  useEffect(() => {
    if (url.trim()) {
      setProvider(detectProvider(url));
    }
  }, [url]);

  const handleSubmit = () => {
    if (!title.trim() || !url.trim()) return;
    onSubmit({
      title: title.trim(),
      address: address.trim(),
      url: url.trim(),
      provider,
    });
    setTitle('');
    setAddress('');
    setUrl('');
    setProvider('other');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            {t('shareLocation')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('locationName')}</Label>
            <Input
              placeholder={t('locationNameExample')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('addressOptional')}</Label>
            <Input
              placeholder={t('addressExample')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('mapLink')}</Label>
            <Input
              placeholder={t('mapLinkPlaceholder')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {url.trim() && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {t('providerDetected').replace('{provider}', providerLabels[provider])}
                </Badge>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !url.trim()}>{t('share')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
