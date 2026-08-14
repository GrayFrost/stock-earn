import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Instrument, Platform, PortfolioSummary, TradeResult } from '../../shared/types';
import { errorMessage, money, pnlClass } from '../format';
import { Modal } from '../components/Modal';
import { PositionsTable } from '../components/PositionsTable';
import { ProfitTrendChart } from '../components/ProfitTrendChart';
import { TradeModal } from '../components/TradeModal';
import { Button } from '../components/ui/button';
import { Field, Input } from '../components/ui/input';
import { Tabs } from '../components/ui/tabs';

export function DashboardPage({ showAllInitially = false }: { showAllInitially?: boolean }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [trades, setTrades] = useState<TradeResult[]>([]);
  const [filter, setFilter] = useState<'active' | 'all' | 'closed'>(showAllInitially ? 'all' : 'active');
  const [search, setSearch] = useState('');
  const [stockModal, setStockModal] = useState(false);
  const [tradeInstrument, setTradeInstrument] = useState<Instrument | null>(null);
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
      const result = await window.stockEarn.market.refreshQuotes(ids);
      setNotice(`已更新 ${result.updated} 只股票${result.failed.length ? `，${result.failed.length} 只沿用缓存` : ''}`);
      await load();
    } catch (reason) { setNotice(errorMessage(reason)); }
    finally { setRefreshing(false); }
  }

  async function archive(instrument: Instrument) {
    if (!instrument.archived && !confirm(`将 ${instrument.symbol} 从活跃列表归档？交易记录会保留。`)) return;
    await window.stockEarn.instruments.archive({ id: instrument.id, archived: !instrument.archived }); await load();
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
    <section className="profit-trend-panel"><div className="section-heading"><div><p className="eyebrow">REALIZED PROFIT PATH</p><h2>已实现盈亏轨迹</h2><p>按平仓月份回看真正落袋的结果，不让短期浮动干扰判断。</p></div><div className="trend-legend"><span><i className="bar" />当月</span><span><i className="line" />累计</span></div></div><ProfitTrendChart trades={trades} /></section>
    <section className="ledger-table-section">
      <div className="table-toolbar"><Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)} items={[{ value: 'active', label: '持仓中' }, { value: 'all', label: '全部' }, { value: 'closed', label: '已清仓' }]} /><div className="toolbar-right"><div className="search-box"><Search size={15} /><Input aria-label="搜索股票" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索股票" /></div><span className="table-hint">点击列名排序</span></div></div>
      <PositionsTable data={rows} hasInstruments={Boolean(summary.instruments.length)} onAddStock={() => setStockModal(true)} onTrade={setTradeInstrument} onOpen={(instrument) => navigate(`/stock/${instrument.id}`)} onArchive={archive} />
    </section>
    {stockModal && <AddStockModal onClose={() => setStockModal(false)} onSaved={() => { setStockModal(false); void load(); }} />}
    {tradeInstrument && <TradeModal instrument={tradeInstrument} platforms={platforms} onClose={() => setTradeInstrument(null)} onSaved={() => { setTradeInstrument(null); void load(); }} />}
  </div>;
}

function AddStockModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [symbol, setSymbol] = useState(''); const [name, setName] = useState(''); const [exchange, setExchange] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await window.stockEarn.instruments.add({ symbol, name, exchange }); onSaved(); } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(false); } }
  return <Modal title="添加美股" subtitle="股票代码用于获取最新参考价和历史日线" onClose={onClose}><form className="form-stack" onSubmit={submit}><Field label="股票代码"><Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" autoFocus required /></Field><Field label="公司名称"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apple Inc.（可选）" /></Field><Field label="交易所"><Input value={exchange} onChange={(e) => setExchange(e.target.value)} placeholder="NASDAQ（可选）" /></Field>{error && <div className="inline-error">{error.includes('UNIQUE') ? '这只股票已经在账本中。' : error}</div>}<footer className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>取消</Button><Button variant="primary" disabled={busy || !symbol}>{busy ? '添加中…' : '添加股票'}</Button></footer></form></Modal>;
}
function PageLoading() { return <div className="page-loading"><span /><p>正在整理账本…</p></div>; }
