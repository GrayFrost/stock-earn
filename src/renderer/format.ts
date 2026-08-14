import { DateTime } from 'luxon';
import type { InferredAction } from '../shared/types';

export const money = (value: string | number, signed = false) => {
  const number = Number(value || 0);
  const text = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(number));
  if (number < 0) return `−${text}`;
  if (signed && number > 0) return `+${text}`;
  return text;
};

export const number = (value: string | number, digits = 8) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(Number(value || 0));
export const price = (value?: string | number | null) => value === undefined || value === null ? '—' : `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
export const pnlClass = (value: string | number) => Number(value) > 0 ? 'is-profit' : Number(value) < 0 ? 'is-loss' : '';
export const formatEt = (iso: string) => DateTime.fromISO(iso).setZone('America/New_York').toFormat('yyyy-LL-dd HH:mm');
export const toEtInput = (iso = new Date().toISOString()) => DateTime.fromISO(iso).setZone('America/New_York').toFormat("yyyy-LL-dd'T'HH:mm");
export const etInputToUtc = (value: string) => DateTime.fromFormat(value, "yyyy-LL-dd'T'HH:mm", { zone: 'America/New_York' }).toUTC().toISO()!;
export const actionLabel: Record<InferredAction, string> = { OPEN_LONG: '开多', ADD_LONG: '加多', CLOSE_LONG: '平多', OPEN_SHORT: '开空', ADD_SHORT: '加空', CLOSE_SHORT: '平空' };

export function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return '操作失败';
  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '').replace(/^Error: /, '');
}
