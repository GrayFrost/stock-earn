import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(value: string) {
  const match = DATE_PATTERN.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
}

function datePart(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function readableDate(value: string) {
  const date = parseDate(value);
  return date ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` : '选择日期';
}

export function DatePicker({ value, onChange, max, ariaLabel = '选择日期' }: { value: string; onChange: (value: string) => void; max?: string; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const maxDate = max ? parseDate(max) : undefined;

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="secondary" className="date-picker-trigger" aria-label={ariaLabel}>
        <CalendarDays size={16} />
        <span>{readableDate(value)}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent className="date-picker-popover" align="start" aria-label={ariaLabel}>
      <Calendar
        mode="single"
        selected={parseDate(value)}
        disabled={maxDate ? { after: maxDate } : undefined}
        onSelect={(date) => { if (!date) return; onChange(datePart(date)); setOpen(false); }}
        autoFocus
      />
    </PopoverContent>
  </Popover>;
}
