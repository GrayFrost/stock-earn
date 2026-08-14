import { ChevronLeft, ChevronRight } from 'lucide-react';
import { zhCN } from 'date-fns/locale';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { cn } from '../../lib/utils';

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: DayPickerProps) {
  return (
    <DayPicker
      locale={zhCN}
      showOutsideDays={showOutsideDays}
      className={cn('ui-calendar', className)}
      classNames={{
        months: 'ui-calendar-months',
        month: 'ui-calendar-month',
        month_caption: 'ui-calendar-caption',
        caption_label: 'ui-calendar-caption-label',
        nav: 'ui-calendar-nav',
        button_previous: 'ui-calendar-nav-button ui-calendar-nav-previous',
        button_next: 'ui-calendar-nav-button ui-calendar-nav-next',
        month_grid: 'ui-calendar-grid',
        weekdays: 'ui-calendar-weekdays',
        weekday: 'ui-calendar-weekday',
        week: 'ui-calendar-week',
        day: 'ui-calendar-day',
        day_button: 'ui-calendar-day-button',
        selected: 'is-selected',
        today: 'is-today',
        outside: 'is-outside',
        disabled: 'is-disabled',
        hidden: 'is-hidden',
        ...classNames,
      }}
      components={{
        Chevron: ({ className: iconClassName, orientation }) => orientation === 'left'
          ? <ChevronLeft className={iconClassName} size={16} />
          : <ChevronRight className={iconClassName} size={16} />,
      }}
      {...props}
    />
  );
}
