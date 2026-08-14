import type { PropsWithChildren, ReactNode } from 'react';
import { Dialog } from './ui/dialog';

export function Modal({ title, subtitle, onClose, children, wide = false }: PropsWithChildren<{ title: string; subtitle?: ReactNode; onClose: () => void; wide?: boolean }>) {
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title={title} description={subtitle} wide={wide}>{children}</Dialog>;
}
