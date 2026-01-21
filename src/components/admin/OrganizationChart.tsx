import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OrgNode {
  name: string;
  position: string;
  title: string;
  children?: OrgNode[];
}

const orgData: OrgNode = {
  name: '김경신',
  position: 'CEO',
  title: 'Chief Executive Officer',
  children: [
    {
      name: '(none)',
      position: 'COO',
      title: 'Chief Operating Officer',
      children: [
        {
          name: '정승채',
          position: 'Team Leader',
          title: '경영기획실',
          children: [
            { name: '(정승채 겸)', position: '인사관리', title: 'HR Manager' },
            { name: '표인하', position: '경리', title: 'Finance Manager' },
            { name: '고민혁', position: '총무', title: 'General Affairs' },
          ],
        },
      ],
    },
    {
      name: '(none)',
      position: 'GL',
      title: 'Creative Solution',
      children: [
        {
          name: 'Saffaan Qadir',
          position: 'Team Leader',
          title: 'Team A',
          children: [
            { name: '안지민', position: 'AD', title: 'Art Director' },
            { name: '이지수', position: 'AD', title: 'Art Director' },
            { name: '이봄이', position: 'COPY', title: 'Copywriter' },
          ],
        },
        {
          name: 'Saffaan Qadir',
          position: 'Team Leader',
          title: 'Team B',
          children: [
            { name: '정재영', position: 'AD', title: 'Art Director' },
          ],
        },
      ],
    },
    {
      name: '(none)',
      position: 'GL',
      title: 'Creative Media Production (CMP)',
      children: [
        {
          name: '장요한',
          position: 'Team Leader',
          title: 'Directing',
          children: [
            { name: '임혁', position: 'Director', title: 'Director' },
            { name: '김현진', position: 'AD', title: 'Assistant Director' },
            { name: '이지우', position: 'AD', title: 'Assistant Director' },
          ],
        },
        {
          name: '박민규',
          position: 'Team Leader',
          title: 'Production',
          children: [
            { name: '백송희', position: 'PD', title: 'Producer' },
            { name: '정형화', position: 'PD', title: 'Producer' },
          ],
        },
      ],
    },
    {
      name: '홍원준',
      position: 'GL',
      title: 'New Experience Terminal (NEXT)',
      children: [
        {
          name: 'TIAGO',
          position: 'Team Leader',
          title: '3D Designer',
          children: [
            { name: '이정헌', position: '3D', title: '3D Designer' },
            { name: '권설', position: '3D', title: '3D Designer' },
          ],
        },
        {
          name: '(none)',
          position: 'Team Leader',
          title: 'Post Edit',
          children: [
            { name: '한상현', position: 'Video Editor', title: '영상 후반 편집' },
            { name: '김기배', position: '2D', title: '2D Designer' },
          ],
        },
      ],
    },
  ],
};

function OrgNodeCard({ node, level = 0 }: { node: OrgNode; level?: number }) {
  const isVacant = node.name === '(none)';
  
  return (
    <div className="flex flex-col items-center">
      <Card className={`p-3 text-center min-w-[140px] ${isVacant ? 'border-dashed bg-muted/30' : 'shadow-card'}`}>
        <p className={`text-sm font-medium ${isVacant ? 'text-muted-foreground' : 'text-foreground'}`}>
          {isVacant ? '공석' : node.name}
        </p>
        <Badge variant={level === 0 ? 'default' : 'secondary'} className="mt-1 text-xs">
          {node.position}
        </Badge>
        <p className="text-xs text-muted-foreground mt-1">{node.title}</p>
      </Card>
      
      {node.children && node.children.length > 0 && (
        <>
          <div className="w-px h-4 bg-border" />
          <div className="flex gap-4">
            {node.children.map((child, index) => (
              <div key={index} className="relative">
                {node.children!.length > 1 && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-border" 
                       style={{ width: index === 0 || index === node.children!.length - 1 ? '50%' : '100%', 
                                left: index === 0 ? '50%' : index === node.children!.length - 1 ? '0' : '0' }} />
                )}
                <div className="w-px h-4 bg-border mx-auto" />
                <OrgNodeCard node={child} level={level + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrganizationChart() {
  return (
    <Card className="p-6 shadow-card overflow-auto">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground">PAULUS CO., LTD 조직도</h3>
        <p className="text-sm text-muted-foreground">ver. 2025.01.08</p>
      </div>
      <div className="min-w-[1000px] flex justify-center py-6">
        <OrgNodeCard node={orgData} />
      </div>
    </Card>
  );
}
