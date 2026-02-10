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

const providerLabels: Record<LocationShare['provider'], string> = {
  google: 'Google Maps',
  naver: 'Naver Map',
  kakao: 'Kakao Map',
  other: '기타',
};

export function LocationShareDialog({ open, onOpenChange, onSubmit }: LocationShareDialogProps) {
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
            장소 공유
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>장소명</Label>
            <Input
              placeholder="예: 성수동 스튜디오 A"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>주소 (선택)</Label>
            <Input
              placeholder="예: 서울시 성동구 성수동2가 300-5"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>지도 링크</Label>
            <Input
              placeholder="Google Maps / Naver Map / Kakao Map URL 붙여넣기"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {url.trim() && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {providerLabels[provider]} 감지됨
                </Badge>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !url.trim()}>공유</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
