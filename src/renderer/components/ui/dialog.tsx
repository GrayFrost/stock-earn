import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';

export function Dialog({ open, onOpenChange, title, description, children, wide = false }: PropsWithChildren<{ open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: ReactNode; wide?: boolean }>) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ui-dialog-overlay" />
      <DialogPrimitive.Content className={cn('ui-dialog-content', wide && 'ui-dialog-wide')}>
        <div className="ui-dialog-header">
          <div><DialogPrimitive.Title>{title}</DialogPrimitive.Title>{description && <DialogPrimitive.Description>{description}</DialogPrimitive.Description>}</div>
          <DialogPrimitive.Close asChild><Button variant="icon" size="icon" aria-label="关闭"><X size={18} /></Button></DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

export const DialogClose = DialogPrimitive.Close;
