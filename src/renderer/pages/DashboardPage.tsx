import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Info, Plus, ReceiptText, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Instrument, Platform, PortfolioSummary, TradeResult } from '../../shared/types';
import { errorMessage, money, pnlClass } from '../format';
import { Modal } from '../components/Modal';
import { PositionsTable } from '../components/PositionsTable';
import { ProfitTrendChart } from '../components/ProfitTrendChart';
import { TradeModal } from '../components/TradeModal';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Field, Input } from '../components/ui/input';
import { Tabs } from '../components/ui/tabs';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('刷新超时，请稍后重试')), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  });
}

export function DashboardPage({ showAllInitially = false }: { showAllInitially?: boolean }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [trades, setTrades] = useState<TradeResult[]>([]);
  const [filter, setFilter] = useState<'active' | 'all' | 'closed'>(showAllInitially ? 'all' : 'active');
  const [search, setSearch] = useState('');
  const [stockModal, setStockModal] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null);
  const [tradeInstrument, setTradeInstrument] = useState<Instrument | null>(null);
  const [pendingAction, setPendingAction] = useState<{ kind: 'archive' | 'delete'; instrument: Instrument } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => Promise.all([window.stockEarn.portfolio.getSummary(), window.stockEarn.platforms.list(true), window.stockEarn.trades.list()]).then(([nextSummary, nextPlatforms, nextTrades]) => { setSummary(nextSummary); setPlatforms(nextPlatforms); setTrades(nextTrades); }), []);
  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => {
    if (!summary) return [];
    return summary.instruments.filter((item) => {
      const matchesFilter = filter === 'all' || (filter === 'active' ? item.active && !item.instrument.archived : !item.active);
      return matchesFilter && `${item.instrument.symbol} ${item.instrument.name}`.toLowerCase().includes(search.toLowerCase());
    });
  }, [filter, search, summary]);

  async function refresh() {
    setRefreshing(true); setNotice('');
    try {
      const ids = summary?.instruments.filter((item) => !item.instrument.archived).map((item) => item.instrument.id);
      const result = await withTimeout(window.stockEarn.market.refreshQuotes(ids), 25_000);
      const failureMessages = [...new Set(result.failed.map((item) => item.message))].slice(0, 2).join('；');
      setNotice(`已更新 ${result.updated} 只股票${result.failed.length ? `，${result.failed.length} 只沿用缓存（${failureMessages}）` : ''}`);
      await load();
    } catch (reason) { setNotice(errorMessage(reason)); }
    finally { setRefreshing(false); }
  }

  async function archive(instrument: Instrument) {
    setNotice('');
    try { await window.stockEarn.instruments.archive({ id: instrument.id, archived: !instrument.archived }); await load(); }
    catch (reason) { setNotice(errorMessage(reason)); }
  }

  async function removeInstrument(instrument: Instrument) {
    setNotice('');
    try { await window.stockEarn.instruments.delete(instrument.id); await load(); }
    catch (reason) { setNotice(errorMessage(reason)); }
  }

  if (!summary) return <PageLoading />;
  const quoteTimes = summary.instruments.map((item) => item.quote?.fetchedAt).filter(Boolean) as string[];
  const latestQuote = quoteTimes.sort().at(-1);
  return <div className="page dashboard-page">
    <header className="page-header"><div><p className="eyebrow">PORTFOLIO LEDGER</p><h1>我的美股账本</h1><p>只记录发生过的交易，只计算真实的价差与费用。</p></div><div className="header-actions"><Button variant="secondary" onClick={refresh} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} />{refreshing ? '刷新中…' : '刷新参考价'}</Button><Button variant="primary" onClick={() => setStockModal(true)}><Plus size={17} />添加股票</Button></div></header>
    <section className="ledger-band">
      <div className="ledger-origin"><span>起始日</span><strong>{summary.startDate}</strong></div><div className="ledger-line"><i /><span>累计净盈亏</span><strong className={pnlClass(summary.netPnl)}>{money(summary.netPnl, true)}</strong><i /></div><div className="ledger-today"><span>今天</span><strong>{new Date().toISOString().slice(0, 10)}</strong></div>
      <div className="ledger-metrics"><div><span>已实现</span><strong className={pnlClass(summary.realizedPnl)}>{money(summary.realizedPnl, true)}</strong></div><div><span>未实现</span><strong className={pnlClass(summary.unrealizedPnl)}>{money(summary.unrealizedPnl, true)}</strong></div><div><span>累计费用</span><strong>{money(summary.fees)}</strong></div><div><span>多 / 空敞口</span><strong>{money(summary.longExposure)} / {money(summary.shortExposure)}</strong></div><div><span>参考价更新</span><strong>{latestQuote ? new Date(latestQuote).toLocaleString('zh-CN', { hour12: false }) : '尚未更新'}</strong></div></div>
    </section>
    {notice && <div className="notice-bar">{notice}</div>}
    <PlatformFeesPanel summary={summary} />
    <section className="profit-trend-panel"><div className="section-heading"><div><p className="eyebrow">REALIZED PROFIT PATH</p><h2>已实现盈亏轨迹</h2><p>按平仓月份回看真正落袋的结果，不让短期浮动干扰判断。</p></div><div className="trend-legend"><span><i className="bar" />当月</span><span><i className="line" />累计</span></div></div><ProfitTrendChart trades={trades} /></section>
    <section className="ledger-table-section">
      <div className="table-toolbar"><Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)} items={[{ value: 'active', label: '持仓中' }, { value: 'all', label: '全部' }, { value: 'closed', label: '已清仓' }]} /><div className="toolbar-right"><div className="search-box"><Search size={15} /><Input aria-label="搜索股票" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索股票" /></div><span className="table-hint">点击列名排序</span></div></div>
      {rows.some((item) => item.sinceEntryHigh === null || item.sinceEntryLow === null) && <div className="history-data-hint"><Info size={14} />入市最高和最低来自历史日线，请进入对应股票详情同步或更新日线数据。</div>}
      <PositionsTable data={rows} hasInstruments={Boolean(summary.instruments.length)} onAddStock={() => setStockModal(true)} onTrade={setTradeInstrument} onOpen={(instrument) => navigate(`/stock/${instrument.id}`)} onEdit={setEditingInstrument} onArchive={(instrument) => instrument.archived ? void archive(instrument) : setPendingAction({ kind: 'archive', instrument })} onDelete={(instrument) => setPendingAction({ kind: 'delete', instrument })} />
    </section>
    {stockModal && <AddStockModal onClose={() => setStockModal(false)} onSaved={() => { setStockModal(false); void load(); }} />}
    {editingInstrument && <EditStockModal instrument={editingInstrument} onClose={() => setEditingInstrument(null)} onSaved={() => { setEditingInstrument(null); void load(); }} />}
    {tradeInstrument && <TradeModal instrument={tradeInstrument} platforms={platforms} onClose={() => setTradeInstrument(null)} onSaved={() => { setTradeInstrument(null); void load(); }} />}
    <ConfirmDialog open={Boolean(pendingAction)} onOpenChange={(open) => { if (!open) setPendingAction(null); }} title={pendingAction?.kind === 'delete' ? `永久删除 ${pendingAction.instrument.symbol}？` : `归档 ${pendingAction?.instrument.symbol ?? ''}？`} description={pendingAction?.kind === 'delete' ? '该股票没有交易记录，相关参考价缓存和历史日线也会一并删除。此操作无法撤销。' : '股票会从持仓列表隐藏，但所有交易记录和盈亏数据都会保留，之后可以恢复。'} confirmText={pendingAction?.kind === 'delete' ? '永久删除' : '确认归档'} tone={pendingAction?.kind === 'delete' ? 'danger' : 'primary'} onConfirm={async () => { if (!pendingAction) return; if (pendingAction.kind === 'delete') await removeInstrument(pendingAction.instrument); else await archive(pendingAction.instrument); }} />
  </div>;
}

function PlatformFeesPanel({ summary }: { summary: PortfolioSummary }) {
  const totalFees = Number(summary.fees);
  const maxFees = Math.max(0, ...summary.platformFees.map((item) => Number(item.fees)));

  return <section className="platform-fees-panel">
    <div className="section-heading">
      <div><p className="eyebrow">FEE LEDGER</p><h2>平台手续费</h2><p>按交易平台汇总已记录的费用，历史归档平台也计入其中。</p></div>
      <div className="platform-fees-total"><ReceiptText size={17} /><span>累计支出</span><strong>{money(summary.fees)}</strong></div>
    </div>
    {summary.platformFees.length ? <div className="platform-fee-grid" role="list">
      {summary.platformFees.map((item) => {
        const fees = Number(item.fees);
        const share = totalFees > 0 ? fees / totalFees * 100 : 0;
        const width = maxFees > 0 ? Math.max(fees / maxFees * 100, fees > 0 ? 3 : 0) : 0;
        return <article className={`platform-fee-item${item.platform.archived ? ' archived' : ''}`} key={item.platform.id} role="listitem">
          <span className="platform-fee-avatar" aria-hidden="true">{item.platform.name.trim().slice(0, 2).toUpperCase()}</span>
          <div className="platform-fee-copy"><strong>{item.platform.name}</strong><span>{item.tradeCount} 笔交易{item.platform.archived ? ' · 已归档' : ''}</span><div className="platform-fee-track" aria-hidden="true"><i style={{ width: `${width}%` }} /></div></div>
          <div className="platform-fee-value"><strong>{money(item.fees)}</strong><span>{share.toFixed(1)}%</span></div>
        </article>;
      })}
    </div> : <div className="platform-fee-empty"><ReceiptText size={20} /><div><strong>还没有平台记录</strong><p>添加交易平台并录入交易后，手续费会自动汇总到这里。</p></div></div>}
  </section>;
}

function EditStockModal({ instrument, onClose, onSaved }: { instrument: Instrument; onClose: () => void; onSaved: () => void }) {
  const [symbol, setSymbol] = useState(instrument.symbol); const [name, setName] = useState(instrument.name); const [exchange, setExchange] = useState(instrument.exchange); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await window.stockEarn.instruments.update({ id: instrument.id, symbol, name, exchange }); onSaved(); } catch (reason) { const message = errorMessage(reason); setError(message.includes('UNIQUE') ? '这个股票代码已存在于账本中。' : message); } finally { setBusy(false); } }
  return <Modal title={`编辑 ${instrument.symbol}`} subtitle="修正股票代码、公司名称或交易所；已有交易和盈亏记录不会丢失。" onClose={onClose}><form className="form-stack" onSubmit={submit}><Field label="股票代码"><Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" autoFocus required /></Field><Field label="公司名称"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apple Inc.（可选）" /></Field><Field label="交易所"><Input value={exchange} onChange={(e) => setExchange(e.target.value)} placeholder="NASDAQ（可选）" /></Field>{error && <div className="inline-error">{error}</div>}<footer className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>取消</Button><Button variant="primary" disabled={busy || !symbol}>{busy ? '保存中…' : '保存修改'}</Button></footer></form></Modal>;
}

function AddStockModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [symbol, setSymbol] = useState(''); const [name, setName] = useState(''); const [exchange, setExchange] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await window.stockEarn.instruments.add({ symbol, name, exchange }); onSaved(); } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(false); } }
  return <Modal title="添加美股" subtitle="股票代码用于获取最新参考价和历史日线" onClose={onClose}><form className="form-stack" onSubmit={submit}><Field label="股票代码"><Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" autoFocus required /></Field><Field label="公司名称"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apple Inc.（可选）" /></Field><Field label="交易所"><Input value={exchange} onChange={(e) => setExchange(e.target.value)} placeholder="NASDAQ（可选）" /></Field>{error && <div className="inline-error">{error.includes('UNIQUE') ? '这只股票已经在账本中。' : error}</div>}<footer className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>取消</Button><Button variant="primary" disabled={busy || !symbol}>{busy ? '添加中…' : '添加股票'}</Button></footer></form></Modal>;
}
function PageLoading() { return <div className="page-loading"><span /><p>正在整理账本…</p></div>; }
