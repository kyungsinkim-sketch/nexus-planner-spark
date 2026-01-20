import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Currency } from '@/types/core';

interface CurrencyInputProps {
  value: string;
  currency: Currency;
  onValueChange: (value: string) => void;
  onCurrencyChange: (currency: Currency) => void;
  placeholder?: string;
}

export function CurrencyInput({
  value,
  currency,
  onValueChange,
  onCurrencyChange,
  placeholder = '0',
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  // Format number with commas
  const formatNumber = (num: string): string => {
    const cleaned = num.replace(/[^\d]/g, '');
    if (!cleaned) return '';
    return parseInt(cleaned, 10).toLocaleString('en-US');
  };

  // Parse formatted number back to raw value
  const parseNumber = (formatted: string): string => {
    return formatted.replace(/[^\d]/g, '');
  };

  useEffect(() => {
    if (value) {
      setDisplayValue(formatNumber(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseNumber(e.target.value);
    setDisplayValue(formatNumber(rawValue));
    onValueChange(rawValue);
  };

  const getCurrencySymbol = (curr: Currency) => {
    switch (curr) {
      case 'KRW':
        return '₩';
      case 'USD':
        return '$';
      default:
        return '';
    }
  };

  return (
    <div className="flex gap-2">
      <Select value={currency} onValueChange={(val) => onCurrencyChange(val as Currency)}>
        <SelectTrigger className="w-[100px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="KRW">
            <span className="flex items-center gap-1.5">
              <span>₩</span> KRW
            </span>
          </SelectItem>
          <SelectItem value="USD">
            <span className="flex items-center gap-1.5">
              <span>$</span> USD
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {getCurrencySymbol(currency)}
        </span>
        <Input
          type="text"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="pl-7"
        />
      </div>
    </div>
  );
}
