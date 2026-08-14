import { CalendarDays, Check, Clock3 } from 'lucide-react';
import { useState } from 'react';
import { toEtInput } from '../format';
import { Calendar } from './ui/calendar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function parts(value: string) {
  const match = DATE_TIME_PATTERN.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), time: `${match[4]}:${match[5]}` };
}

function dateValue(value: string) {
  const current = parts(value);
  return current ? new Date(current.year, current.month - 1, current.day) : undefined;
}

function datePart(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function readableValue(value: string) {
  const current = parts(value);
  if (!current) return '选择成交时间';
  return `${current.year}/${String(current.month).padStart(2, '0')}/${String(current.day).padStart(2, '0')} · ${current.time}`;
}

export function DateTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = parts(value);

  function updateDate(date?: Date) {
    if (!date) return;
    onChange(`${datePart(date)}T${current?.time ?? '09:30'}`);
  }

  function updateTime(time: string) {
    if (!/^\d{2}:\d{2}$/.test(time)) return;
    const date = current ? `${current.year}-${String(current.month).padStart(2, '0')}-${String(current.day).padStart(2, '0')}` : datePart(new Date());
    onChange(`${date}T${time}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" className="date-time-trigger" aria-label="选择成交日期和时间">
          <CalendarDays size={16} />
          <span>{readableValue(value)}</span>
          <small>ET</small>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="date-time-popover" aria-label="成交日期和时间">
        <Calendar mode="single" selected={dateValue(value)} onSelect={updateDate} autoFocus />
        <div className="date-time-controls">
          <div className="date-time-heading">
            <span><Clock3 size={14} />成交时间</span>
            <small>美国东部时间</small>
          </div>
          <div className="date-time-row">
            <Input
              type="time"
              value={current?.time ?? ''}
              onChange={(event) => updateTime(event.target.value)}
              aria-label="成交时间（美国东部时间）"
              required
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(toEtInput())}>此刻</Button>
            <Button type="button" variant="primary" size="sm" onClick={() => setOpen(false)}><Check size={14} />完成</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
