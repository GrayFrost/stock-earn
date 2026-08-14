import { CalendarDays, Check, Clock3 } from 'lucide-react';
import { useState } from 'react';
import { toEtInput } from '../format';
import { Calendar } from './ui/calendar';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Select } from './ui/select';

const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const HOURS = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, value) => String(value).padStart(2, '0'));
const timeOptions = (values: string[], suffix: string) => values.map((value) => ({ value, label: `${value} ${suffix}` }));

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

  function updateTime(hour: string, minute: string) {
    const date = current ? `${current.year}-${String(current.month).padStart(2, '0')}-${String(current.day).padStart(2, '0')}` : datePart(new Date());
    onChange(`${date}T${hour}:${minute}`);
  }

  const [hour = '09', minute = '30'] = (current?.time ?? '09:30').split(':');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" className="date-time-trigger" aria-label="选择成交日期和时间">
          <CalendarDays size={16} />
          <span>{readableValue(value)}</span>
          <small>ET</small>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="date-time-popover" side="top" aria-label="成交日期和时间">
        <Calendar mode="single" selected={dateValue(value)} onSelect={updateDate} autoFocus />
        <div className="date-time-controls">
          <div className="date-time-heading">
            <span><Clock3 size={14} />成交时间</span>
            <small>美国东部时间</small>
          </div>
          <div className="date-time-row">
            <div className="date-time-selects" aria-label="成交时间（美国东部时间）">
              <Select value={hour} onValueChange={(nextHour) => updateTime(nextHour, minute)} options={timeOptions(HOURS, '时')} className="date-time-select" />
              <span>:</span>
              <Select value={minute} onValueChange={(nextMinute) => updateTime(hour, nextMinute)} options={timeOptions(MINUTES, '分')} className="date-time-select" />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(toEtInput())}>此刻</Button>
            <Button type="button" variant="primary" size="sm" onClick={() => setOpen(false)}><Check size={14} />完成</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
