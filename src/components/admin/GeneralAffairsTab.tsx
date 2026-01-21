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

export function GeneralAffairsTab() {
  const modules = [
    { label: '자산 관리', description: '장비, 비품, 소프트웨어 라이선스 관리', icon: Laptop, status: 'planned' },
    { label: '시설 관리', description: '사무실, 회의실, 주차장 관리', icon: Building2, status: 'planned' },
    { label: '문서 관리', description: '계약서, 보안서약서, 인수인계서 관리', icon: FileText, status: 'planned' },
    { label: '계정 관리', description: '구글, 플로우, 시프티 등 업무 계정 관리', icon: Key, status: 'planned' },
    { label: '비품 관리', description: '사무용품, 소모품 재고 관리', icon: Package, status: 'planned' },
    { label: '일반 설정', description: '시스템 설정 및 환경 구성', icon: Settings, status: 'planned' },
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
                  <Badge variant="outline" className="text-xs">예정</Badge>
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
            <h3 className="font-semibold text-foreground mb-1">총무 관리 모듈</h3>
            <p className="text-sm text-muted-foreground">
              자산 관리, 시설 관리, 문서 관리 등 총무 관련 기능들이 이 섹션에서 제공될 예정입니다.
              현재 기획 단계이며, 곧 업데이트될 예정입니다.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
