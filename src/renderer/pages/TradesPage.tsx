import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Instrument, Platform, TradeResult } from '../../shared/types';
import { TradeModal } from '../components/TradeModal';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Tooltip } from '../components/ui/tooltip';
import { actionLabel, errorMessage, formatEt, money, number, pnlClass, price } from '../format';

const PAGE_SIZE = 50;

export function TradesPage() {
  const navigate = useNavigate();
  const listPanelRef = useRef<HTMLElement>(null);
  const [trades, setTrades] = useState<TradeResult[] | null>(null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [editingTrade, setEditingTrade] = useState<TradeResult | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TradeResult | null>(null);
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const [nextTrades, nextInstruments, nextPlatforms] = await Promise.all([
        window.stockEarn.trades.list(),
        window.stockEarn.instruments.list(true),
        window.stockEarn.platforms.list(true),
      ]);
      setTrades(nextTrades);
      setInstruments(nextInstruments);
      setPlatforms(nextPlatforms);
    } catch (reason) {
      setNotice(errorMessage(reason));
      setTrades([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const instrumentById = useMemo(
    () => new Map(instruments.map((instrument) => [instrument.id, instrument])),
    [instruments],
  );
  const platformById = useMemo(
    () => new Map(platforms.map((platform) => [platform.id, platform])),
    [platforms],
  );
  const tradeCount = trades?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(tradeCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageTrades = trades?.slice(pageStart, pageStart + PAGE_SIZE) ?? [];

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function goToPage(nextPage: number) {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
    window.requestAnimationFrame(() => listPanelRef.current?.scrollIntoView({ block: 'start' }));
  }

  async function removeTrade(trade: TradeResult) {
    setNotice('');
    try {
      await window.stockEarn.trades.delete(trade.id);
      await load();
    } catch (reason) {
      setNotice(errorMessage(reason));
    }
  }

  if (trades === null) return <div className="page-loading"><span /><p>正在读取交易流水…</p></div>;

  const editingInstrument = editingTrade ? instrumentById.get(editingTrade.instrumentId) : undefined;

  return <div className="page trades-page">
    <header className="page-header trades-page-header">
      <div>
        <p className="eyebrow">TRANSACTION LOG</p>
        <h1>交易流水</h1>
        <p>每一笔实际成交，按美国东部时间从新到旧排列。</p>
      </div>
      <span className="trades-total"><strong>{trades.length}</strong> 笔交易</span>
    </header>

    {notice && <div className="notice-bar">{notice}</div>}

    <section ref={listPanelRef} className="trades-list-panel" aria-label="全部交易流水">
      <div className="table-scroll">
        <table className="all-trades-table">
          <thead><tr>
            <th>时间（ET）</th>
            <th>股票</th>
            <th>平台</th>
            <th>方向</th>
            <th>股数</th>
            <th>成交价</th>
            <th>成交额</th>
            <th>手续费</th>
            <th>已实现盈亏</th>
            <th>备注</th>
            <th className="table-actions-column"><span className="sr-only">操作</span></th>
          </tr></thead>
          <tbody>{pageTrades.map((trade) => {
            const instrument = instrumentById.get(trade.instrumentId);
            const platform = platformById.get(trade.platformId);
            const tradeValue = Number(trade.quantity) * Number(trade.unitPrice);
            return <tr key={trade.id} className={`trade-list-row ${trade.side.toLowerCase()}`}>
              <td className="trade-time">{formatEt(trade.executedAt)}</td>
              <td>
                <button
                  type="button"
                  className="trade-instrument-link"
                  onClick={() => navigate(`/stock/${trade.instrumentId}`)}
                  title={`查看 ${instrument?.symbol ?? '股票'} 详情`}
                >
                  <strong>{instrument?.symbol ?? '—'}</strong>
                  <span>{instrument?.name || (instrument?.archived ? '已归档股票' : '股票详情')}</span>
                </button>
              </td>
              <td>{platform?.name ?? '已归档平台'}</td>
              <td><div className="trade-direction">
                <span className={`side-label ${trade.side.toLowerCase()}`}>{trade.side === 'BUY' ? '买入' : '卖出'}</span>
                <small>{actionLabel[trade.action]}</small>
              </div></td>
              <td>{number(trade.quantity)}</td>
              <td>{price(trade.unitPrice)}</td>
              <td>{money(tradeValue)}</td>
              <td>{money(trade.fee)}</td>
              <td className={pnlClass(trade.realizedPnl)}>{Number(trade.realizedPnl) ? money(trade.realizedPnl, true) : '—'}</td>
              <td><span className={trade.note ? 'trade-note' : 'trade-note empty'} title={trade.note}>{trade.note || '—'}</span></td>
              <td className="table-actions-column"><div className="row-actions">
                <Tooltip label="编辑交易"><Button variant="icon" size="icon" onClick={() => setEditingTrade(trade)}><Edit3 size={15} /></Button></Tooltip>
                <Tooltip label="删除交易"><Button variant="icon" size="icon" className="danger" onClick={() => setPendingDelete(trade)}><Trash2 size={15} /></Button></Tooltip>
              </div></td>
            </tr>;
          })}</tbody>
        </table>
        {!trades.length && <div className="empty-state">
          <div className="empty-glyph">$</div>
          <h3>还没有交易流水</h3>
          <p>先到总览选择一只股票，再记录第一笔买入或卖出。</p>
        </div>}
      </div>
      {Boolean(trades.length) && <footer className="trades-pagination">
        <p><span>{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, trades.length)}</span> / 共 {trades.length} 笔</p>
        <nav aria-label="交易流水分页">
          <Button variant="secondary" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="上一页">
            <ChevronLeft size={14} />上一页
          </Button>
          <span className="pagination-page" aria-live="polite">第 <strong>{currentPage}</strong> / {totalPages} 页</span>
          <Button variant="secondary" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="下一页">
            下一页<ChevronRight size={14} />
          </Button>
        </nav>
      </footer>}
    </section>

    {editingTrade && editingInstrument && <TradeModal
      instrument={editingInstrument}
      platforms={platforms}
      trade={editingTrade}
      onClose={() => setEditingTrade(null)}
      onSaved={() => { setEditingTrade(null); void load(); }}
    />}
    <ConfirmDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }} title={`删除 ${pendingDelete ? instrumentById.get(pendingDelete.instrumentId)?.symbol ?? '股票' : ''} 交易？`} description={<>将删除 {pendingDelete ? formatEt(pendingDelete.executedAt) : ''} 的交易，之后的 FIFO 持仓和盈亏会重新计算。此操作无法撤销。</>} confirmText="删除交易" onConfirm={async () => { if (pendingDelete) await removeTrade(pendingDelete); }} />
  </div>;
}
