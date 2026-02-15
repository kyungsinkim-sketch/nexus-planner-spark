import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, User, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

// Vendor types
export type VendorType = 'company' | 'freelancer';

export interface VendorInfo {
  id: string;
  type: VendorType;
  name: string;                // 회사명 또는 이름
  representative?: string;     // 대표자 (회사인 경우)
  businessNumber?: string;     // 사업자번호
  bank?: string;               // 은행
  accountNumber?: string;      // 계좌번호
  role?: string;               // 역할 (프리랜서인 경우)
  lastUsed?: string;           // 마지막 사용일
}

// Mock saved vendors - 이전에 입력했던 거래처/외주 정보
const savedVendors: VendorInfo[] = [
  {
    id: 'v1',
    type: 'company',
    name: '젠디자인랩(Jen Design Lab)',
    representative: '김희진',
    businessNumber: '876-13-02410',
    bank: '하나',
    accountNumber: '571-910550-14407',
    role: '2D 모션 디자이너',
    lastUsed: '2025-12-31',
  },
  {
    id: 'v2',
    type: 'freelancer',
    name: '김희진',
    businessNumber: '876-13-02410',
    bank: '하나',
    accountNumber: '571-910550-14407',
    role: '2D 모션그래픽',
    lastUsed: '2025-12-31',
  },
  {
    id: 'v3',
    type: 'company',
    name: 'Chaos Software GmbH',
    representative: '-',
    businessNumber: '-',
    role: '코로나 랜더 엔진',
    lastUsed: '2025-10-22',
  },
  {
    id: 'v4',
    type: 'company',
    name: '다나와',
    representative: '-',
    businessNumber: '-',
    role: '전자제품 구매',
    lastUsed: '2025-04-08',
  },
  {
    id: 'v5',
    type: 'company',
    name: 'CGTrader',
    representative: '-',
    businessNumber: '-',
    role: '3D 에셋 구매',
    lastUsed: '2025-03-25',
  },
  {
    id: 'v6',
    type: 'company',
    name: 'Hum 3D',
    representative: '-',
    businessNumber: '-',
    role: '3D 에셋 구매',
    lastUsed: '2025-03-25',
  },
  {
    id: 'v7',
    type: 'company',
    name: 'TurboSquid/Shutterstock',
    representative: '-',
    businessNumber: '-',
    role: '3D 에셋 구매',
    lastUsed: '2025-04-14',
  },
  {
    id: 'v8',
    type: 'freelancer',
    name: '티아고',
    role: '3D 아티스트',
    lastUsed: '2025-11-04',
  },
];

interface VendorAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (vendor: VendorInfo) => void;
  placeholder?: string;
  vendorType?: VendorType | 'all';
  className?: string;
}

export function VendorAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  vendorType = 'all',
  className,
}: VendorAutocompleteProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [filteredVendors, setFilteredVendors] = useState<VendorInfo[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.length > 0) {
      const filtered = savedVendors.filter((vendor) => {
        const matchesSearch = 
          vendor.name.toLowerCase().includes(value.toLowerCase()) ||
          (vendor.representative?.toLowerCase().includes(value.toLowerCase())) ||
          (vendor.role?.toLowerCase().includes(value.toLowerCase()));
        
        if (vendorType === 'all') return matchesSearch;
        return matchesSearch && vendor.type === vendorType;
      });
      setFilteredVendors(filtered);
      setIsOpen(filtered.length > 0);
    } else {
      setFilteredVendors([]);
      setIsOpen(false);
    }
  }, [value, vendorType]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (vendor: VendorInfo) => {
    onChange(vendor.name);
    onSelect(vendor);
    setIsOpen(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: '2-digit',
      month: 'numeric',
      day: 'numeric',
    });
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (filteredVendors.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder || t('vendorSearchPlaceholder')}
      />

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          <div className="p-2 border-b border-border bg-muted/50">
            <p className="text-xs text-muted-foreground">
              {t('previousVendorInfo')}
            </p>
          </div>
          {filteredVendors.map((vendor) => (
            <button
              key={vendor.id}
              type="button"
              onClick={() => handleSelect(vendor)}
              className="w-full flex items-start gap-3 p-3 hover:bg-muted transition-colors text-left border-b border-border/50 last:border-b-0"
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                vendor.type === 'company' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
              )}>
                {vendor.type === 'company' ? (
                  <Building2 className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{vendor.name}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {vendor.type === 'company' ? t('vendorCompany') : t('vendorIndividual')}
                  </Badge>
                </div>
                {vendor.representative && vendor.representative !== '-' && (
                  <p className="text-xs text-muted-foreground">{t('vendorRepresentative')}: {vendor.representative}</p>
                )}
                {vendor.role && (
                  <p className="text-xs text-muted-foreground">{vendor.role}</p>
                )}
                {vendor.businessNumber && vendor.businessNumber !== '-' && (
                  <p className="text-xs text-muted-foreground">{t('businessNumber')}: {vendor.businessNumber}</p>
                )}
              </div>
              {vendor.lastUsed && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatDate(vendor.lastUsed)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Hook to get all saved vendors
export function useSavedVendors() {
  return savedVendors;
}
