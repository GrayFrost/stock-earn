import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Edit3, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { DateTime } from 'luxon';
import type { InstrumentDetail, Platform, TradeResult } from '../../shared/types';
import { StockChart } from '../components/StockChart';
import { TradeModal } from '../components/TradeModal';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Tooltip } from '../components/ui/tooltip';
import { actionLabel, errorMessage, formatEt, money, number, pnlClass, price } from '../format';

export function DetailPage() {
  const { id = '' } = useParams(); const navigate = useNavigate();
  const [detail, setDetail] = useState<InstrumentDetail | null>(null); const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [tradeModal, setTradeModal] = useState<TradeResult | 'new' | null>(null); const [syncing, setSyncing] = useState(false); const [notice, setNotice] = useState(''); const [selectedDate, setSelectedDate] = useState('');
  const [pendingDelete, setPendingDelete] = useState<TradeResult | null>(null);
  const load = useCallback(() => Promise.all([window.stockEarn.instruments.getDetail(id), window.stockEarn.platforms.list(true)]).then(([nextDetail, nextPlatforms]) => { setDetail(nextDetail); setPlatforms(nextPlatforms); }), [id]);
  useEffect(() => { void load(); }, [load]);
  const selectDate = useCallback((date: string) => setSelectedDate(date), []);
  const platformNames = useMemo(() => new Map(platforms.map((platform) => [platform.id, platform.name])), [platforms]);

  async function syncBars() { setSyncing(true); setNotice(''); try { await window.stockEarn.market.syncDailyBars(id); await load(); setNotice('历史日线已同步'); } catch (reason) { setNotice(errorMessage(reason)); } finally { setSyncing(false); } }
  async function removeTrade(trade: TradeResult) { try { await window.stockEarn.trades.delete(trade.id); await load(); } catch (reason) { setNotice(errorMessage(reason)); } }
  if (!detail) return <div className="page-loading"><span /><p>正在读取股票详情…</p></div>;
  const quote = detail.position.quote;
  return <div className="page detail-page">
    <header className="detail-header"><Button variant="ghost" className="back-button" onClick={() => navigate(-1)}><ArrowLeft size={19} />返回账本</Button><div className="detail-title"><div><span className="ticker-block">{detail.instrument.symbol}</span><div><h1>{detail.instrument.name || detail.instrument.symbol}</h1><p>{detail.instrument.exchange || '美股'} · USD</p></div></div><div className="detail-quote"><strong>{price(quote?.price)}</strong><span className={quote ? pnlClass(quote.change) : ''}>{quote ? `${Number(quote.change) >= 0 ? '+' : ''}${Number(quote.changePercent).toFixed(2)}%` : '尚无参考价'}</span></div></div><Button variant="primary" onClick={() => setTradeModal('new')}><Plus size={17} />记录交易</Button></header>
    <section className="detail-metrics"><div><span>净盈亏</span><strong className={pnlClass(detail.position.netPnl)}>{money(detail.position.netPnl, true)}</strong></div><div><span>已实现</span><strong className={pnlClass(detail.position.realizedPnl)}>{money(detail.position.realizedPnl, true)}</strong></div><div><span>未实现</span><strong className={pnlClass(detail.position.unrealizedPnl)}>{money(detail.position.unrealizedPnl, true)}</strong></div><div><span>多头 / 空头</span><strong>{number(detail.position.longQuantity)} / {number(detail.position.shortQuantity)}</strong></div><div><span>累计费用</span><strong>{money(detail.position.fees)}</strong></div></section>
    {notice && <div className="notice-bar">{notice}</div>}
    <section className="chart-panel"><div className="section-heading"><div><p className="eyebrow">PRICE & EXECUTIONS</p><h2>价格与买卖位置</h2><p>日K为参考行情，标记展示你实际记录的成交。</p></div><Button variant="secondary" onClick={syncBars} disabled={syncing}><RefreshCw size={16} className={syncing ? 'spin' : ''} />{syncing ? '同步中…' : detail.bars.length ? '更新日线' : '同步历史日线'}</Button></div><StockChart bars={detail.bars} trades={detail.trades} onSelectDate={selectDate} /><div className="chart-legend"><span><i className="buy-dot" />买入</span><span><i className="sell-dot" />卖出</span><span>点击交易日标记可定位下方流水</span></div></section>
    <section className="trades-panel"><div className="section-heading"><div><p className="eyebrow">TRANSACTION LOG</p><h2>交易流水</h2></div><span className="record-count">{detail.trades.length} 笔</span></div><div className="table-scroll"><table className="trades-table"><thead><tr><th>时间（ET）</th><th>平台</th><th>方向</th><th>系统判断</th><th>股数</th><th>每股价格</th><th>手续费</th><th>本笔已实现</th><th /></tr></thead><tbody>{detail.trades.map((trade) => {
      const date = DateTime.fromISO(trade.executedAt).setZone('America/New_York').toISODate(); const selected = selectedDate && selectedDate === date;
      return <tr key={trade.id} className={selected ? 'selected-trade' : ''}><td>{formatEt(trade.executedAt)}</td><td>{platformNames.get(trade.platformId) ?? '已归档平台'}</td><td><span className={`side-label ${trade.side.toLowerCase()}`}>{trade.side === 'BUY' ? '买入' : '卖出'}</span></td><td>{actionLabel[trade.action]}</td><td>{number(trade.quantity)}</td><td>{price(trade.unitPrice)}</td><td>{money(trade.fee)}</td><td className={pnlClass(trade.realizedPnl)}>{Number(trade.realizedPnl) ? money(trade.realizedPnl, true) : '—'}</td><td><div className="row-actions"><Tooltip label="编辑交易"><Button variant="icon" size="icon" onClick={() => setTradeModal(trade)}><Edit3 size={15} /></Button></Tooltip><Tooltip label="删除交易"><Button variant="icon" size="icon" className="danger" onClick={() => setPendingDelete(trade)}><Trash2 size={15} /></Button></Tooltip></div></td></tr>;
    })}</tbody></table>{!detail.trades.length && <div className="empty-state compact"><h3>还没有交易</h3><p>记录第一笔买入或卖出，系统会自动判断开多或开空。</p></div>}</div></section>
    {tradeModal && <TradeModal instrument={detail.instrument} platforms={platforms} trade={tradeModal === 'new' ? undefined : tradeModal} onClose={() => setTradeModal(null)} onSaved={() => { setTradeModal(null); void load(); }} />}
    <ConfirmDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }} title="删除这笔交易？" description={<>将删除 {pendingDelete ? formatEt(pendingDelete.executedAt) : ''} 的交易，之后的 FIFO 持仓和盈亏会重新计算。此操作无法撤销。</>} confirmText="删除交易" onConfirm={async () => { if (pendingDelete) await removeTrade(pendingDelete); }} />
  </div>;
}
