import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../lib/utils';

export function Tabs({ value, onValueChange, items, className }: { value: string; onValueChange: (value: string) => void; items: Array<{ value: string; label: string }>; className?: string }) {
  return <TabsPrimitive.Root value={value} onValueChange={onValueChange}><TabsPrimitive.List className={cn('ui-tabs-list', className)}>{items.map((item) => <TabsPrimitive.Trigger className="ui-tabs-trigger" value={item.value} key={item.value}>{item.label}</TabsPrimitive.Trigger>)}</TabsPrimitive.List></TabsPrimitive.Root>;
}
