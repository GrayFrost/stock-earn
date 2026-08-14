import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { InferredAction, Instrument, Platform, TradeInput, TradeResult } from '../../shared/types';
import { actionLabel, errorMessage, etInputToUtc, money, number, toEtInput } from '../format';
import { Modal } from './Modal';
import { DateTimePicker } from './DateTimePicker';
import { Button } from './ui/button';
import { Field, Input, Textarea } from './ui/input';
import { Select } from './ui/select';

export function TradeModal({ instrument, platforms, trade, onClose, onSaved }: { instrument: Instrument; platforms: Platform[]; trade?: TradeResult; onClose: () => void; onSaved: () => void }) {
  const [platformId, setPlatformId] = useState(trade?.platformId ?? platforms[0]?.id ?? '');
  const [side, setSide] = useState<'BUY' | 'SELL'>(trade?.side ?? 'BUY');
  const [quantity, setQuantity] = useState(trade?.quantity ?? '');
  const [unitPrice, setUnitPrice] = useState(trade?.unitPrice ?? '');
  const [fee, setFee] = useState(trade?.fee ?? '0');
  const [executedAt, setExecutedAt] = useState(toEtInput(trade?.executedAt));
  const [note, setNote] = useState(trade?.note ?? '');
  const [preview, setPreview] = useState<{ action: InferredAction; resultingQuantity: string } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const input = useMemo<TradeInput | null>(() => {
    if (!platformId || !quantity || !unitPrice || !executedAt) return null;
    return { instrumentId: instrument.id, platformId, side, quantity, unitPrice, fee: fee || '0', executedAt: etInputToUtc(executedAt), note };
  }, [executedAt, fee, instrument.id, note, platformId, quantity, side, unitPrice]);

  useEffect(() => {
    if (!input) { setPreview(null); return; }
    const timer = window.setTimeout(() => window.stockEarn.trades.preview({ ...input, id: trade?.id }).then((value) => { setPreview(value); setError(''); }).catch((reason) => { setPreview(null); setError(errorMessage(reason)); }), 180);
    return () => window.clearTimeout(timer);
  }, [input, trade]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!input) return;
    setSaving(true); setError('');
    try {
      if (trade) await window.stockEarn.trades.update({ ...input, id: trade.id });
      else await window.stockEarn.trades.create(input);
      onSaved();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setSaving(false); }
  }

  const gross = Number(quantity || 0) * Number(unitPrice || 0);
  return <Modal title={trade ? `编辑 ${instrument.symbol} 交易` : `记录 ${instrument.symbol} 交易`} subtitle="时间按美国东部时间记录" onClose={onClose}>
    <form onSubmit={submit} className="form-stack">
      <div className="side-switch" aria-label="交易方向">
        <Button type="button" variant="ghost" className={side === 'BUY' ? 'active buy' : ''} onClick={() => setSide('BUY')}><ArrowDownLeft size={17} />买入</Button>
        <Button type="button" variant="ghost" className={side === 'SELL' ? 'active sell' : ''} onClick={() => setSide('SELL')}><ArrowUpRight size={17} />卖出</Button>
      </div>
      <Field label="交易平台"><Select value={platformId} onValueChange={setPlatformId} options={platforms.filter((item) => !item.archived || item.id === trade?.platformId).map((item) => ({ value: item.id, label: item.name }))} /></Field>
      <div className="form-grid three"><Field label="股数"><Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="10 或 0.25" required /></Field><Field label="每股价格"><Input inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="185.42" required /></Field><Field label="手续费"><Input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} required /></Field></div>
      <Field label="成交时间（ET）"><DateTimePicker value={executedAt} onChange={setExecutedAt} /></Field>
      <Field label="备注"><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="可选：订单号、交易理由…" /></Field>
      <div className="trade-preview">
        <div><span>成交金额</span><strong>{money(gross)}</strong></div>
        <div><span>系统判断</span><strong>{preview ? actionLabel[preview.action] : trade ? actionLabel[trade.action] : '—'}</strong></div>
        <div><span>交易后持仓</span><strong>{preview ? number(preview.resultingQuantity) : '—'} 股</strong></div>
      </div>
      {error && <div className="inline-error">{error}</div>}
      <footer className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>取消</Button><Button variant="primary" disabled={saving || !preview}>{saving ? '保存中…' : trade ? '保存修改' : '记录交易'}</Button></footer>
    </form>
  </Modal>;
}
