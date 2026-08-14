import { flexRender, getCoreRowModel, getExpandedRowModel, getSortedRowModel, useReactTable, type ColumnDef, type ExpandedState, type Row, type SortingState } from '@tanstack/react-table';
import { Archive, ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, CirclePlus, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Instrument, InstrumentPosition } from '../../shared/types';
import { money, number, pnlClass, price } from '../format';
import { Button } from './ui/button';
import { Tooltip } from './ui/tooltip';

export function PositionsTable({ data, hasInstruments, onAddStock, onTrade, onOpen, onArchive }: {
  data: InstrumentPosition[];
  hasInstruments: boolean;
  onAddStock: () => void;
  onTrade: (instrument: Instrument) => void;
  onOpen: (instrument: Instrument) => void;
  onArchive: (instrument: Instrument) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'netPnl', desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const columns = useMemo<ColumnDef<InstrumentPosition>[]>(() => [
    {
      id: 'instrument', accessorFn: (row) => row.instrument.symbol,
      header: '股票',
      cell: ({ row }) => <div className="instrument-cell"><Button variant="icon" size="icon" className="expand-button" onClick={row.getToggleExpandedHandler()} aria-label={row.getIsExpanded() ? '收起平台明细' : '展开平台明细'}>{row.getIsExpanded() ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</Button><div className="stock-identity"><strong>{row.original.instrument.symbol}</strong><span>{row.original.instrument.name || '未填写公司名'} · {row.original.platforms.length} 个平台</span></div></div>,
    },
    { id: 'quote', header: '最新参考价', accessorFn: (row) => Number(row.quote?.price ?? 0), cell: ({ row }) => <><strong className="mono">{price(row.original.quote?.price)}</strong><span className={`quote-status ${row.original.quote?.stale ? 'stale' : ''}`}>{row.original.quote ? row.original.quote.stale ? '缓存' : `${Number(row.original.quote.changePercent) >= 0 ? '+' : ''}${Number(row.original.quote.changePercent).toFixed(2)}%` : '无行情'}</span></> },
    { id: 'sinceEntryHigh', header: () => <span title="账本起始日至今的盘中最高价">入市最高</span>, accessorFn: (row) => row.sinceEntryHigh === null ? undefined : Number(row.sinceEntryHigh), sortUndefined: 'last', cell: ({ row }) => <span className="range-price high" title={row.original.sinceEntryHigh === null ? '同步历史日线后显示' : undefined}>{price(row.original.sinceEntryHigh)}</span> },
    { id: 'sinceEntryLow', header: () => <span title="账本起始日至今的盘中最低价">入市最低</span>, accessorFn: (row) => row.sinceEntryLow === null ? undefined : Number(row.sinceEntryLow), sortUndefined: 'last', cell: ({ row }) => <span className="range-price low" title={row.original.sinceEntryLow === null ? '同步历史日线后显示' : undefined}>{price(row.original.sinceEntryLow)}</span> },
    { id: 'long', header: '多头', accessorFn: (row) => Number(row.longQuantity), cell: ({ row }) => row.original.longQuantity !== '0' ? <span className="position-chip long"><TrendingUp size={13} />{number(row.original.longQuantity)}</span> : '—' },
    { id: 'short', header: '空头', accessorFn: (row) => Number(row.shortQuantity), cell: ({ row }) => row.original.shortQuantity !== '0' ? <span className="position-chip short"><TrendingDown size={13} />{number(row.original.shortQuantity)}</span> : '—' },
    { id: 'exposure', header: '总敞口', accessorFn: (row) => Number(row.exposure), cell: ({ row }) => money(row.original.exposure) },
    { id: 'realizedPnl', header: '已实现', accessorFn: (row) => Number(row.realizedPnl), cell: ({ row }) => <span className={pnlClass(row.original.realizedPnl)}>{money(row.original.realizedPnl, true)}</span> },
    { id: 'unrealizedPnl', header: '未实现', accessorFn: (row) => Number(row.unrealizedPnl), cell: ({ row }) => <span className={pnlClass(row.original.unrealizedPnl)}>{money(row.original.unrealizedPnl, true)}</span> },
    { id: 'netPnl', header: '净盈亏', accessorFn: (row) => Number(row.netPnl), cell: ({ row }) => <span className={`pnl-total ${pnlClass(row.original.netPnl)}`}>{money(row.original.netPnl, true)}</span> },
    { id: 'actions', enableSorting: false, header: '', cell: ({ row }) => <div className="row-actions"><Tooltip label="记录交易"><Button variant="icon" size="icon" onClick={() => onTrade(row.original.instrument)}><CirclePlus size={17} /></Button></Tooltip><Tooltip label="打开详情"><Button variant="icon" size="icon" onClick={() => onOpen(row.original.instrument)}><ChartIcon /></Button></Tooltip><Tooltip label={row.original.instrument.archived ? '恢复股票' : '归档股票'}><Button variant="icon" size="icon" onClick={() => onArchive(row.original.instrument)}>{row.original.instrument.archived ? <RotateCcw size={16} /> : <Archive size={16} />}</Button></Tooltip></div> },
  ], [onArchive, onOpen, onTrade]);

  const table = useReactTable({ data, columns, state: { sorting, expanded }, onSortingChange: setSorting, onExpandedChange: setExpanded, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getExpandedRowModel: getExpandedRowModel(), getRowCanExpand: (row) => row.original.platforms.length > 0 });
  return <div className="table-scroll"><table className="positions-table"><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className={header.column.id === 'instrument' ? 'symbol-col' : header.column.id === 'actions' ? 'table-actions-column' : ''}>{header.isPlaceholder ? null : header.column.getCanSort() ? <button className="sort-header" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === 'asc' ? <ArrowUp size={12} /> : header.column.getIsSorted() === 'desc' ? <ArrowDown size={12} /> : <ArrowUpDown size={12} />}</button> : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>
    {table.getRowModel().rows.map((row) => <Rows key={row.id} row={row} onOpen={() => onOpen(row.original.instrument)} />)}
  </tbody></table>{!data.length && <div className="empty-state"><div className="empty-glyph">$</div><h3>{hasInstruments ? '没有符合条件的股票' : '从第一只股票开始'}</h3><p>{hasInstruments ? '试试切换筛选条件或搜索词。' : '添加股票后，就可以记录买卖和查看盈亏。'}</p>{!hasInstruments && <Button variant="primary" onClick={onAddStock}>添加股票</Button>}</div>}</div>;
}

function Rows({ row, onOpen }: { row: Row<InstrumentPosition>; onOpen: () => void }) {
  return <>{<tr className="instrument-row" onDoubleClick={onOpen}>{row.getVisibleCells().map((cell) => <td key={cell.id} className={cell.column.id === 'actions' ? 'table-actions-column' : undefined}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>}{row.getIsExpanded() && row.original.platforms.map((platform) => <tr className="platform-row" key={platform.platform.id}><td><span className="platform-branch">↳</span><div className="stock-identity"><strong>{platform.platform.name}</strong><span>{platform.direction === 'LONG' ? '多头持仓' : platform.direction === 'SHORT' ? '空头持仓' : '已清仓'} · 均价 {price(platform.averageOpenPrice)}</span></div></td><td className="muted-cell">平台明细</td><td>—</td><td>—</td><td>{platform.longQuantity !== '0' ? number(platform.longQuantity) : '—'}</td><td>{platform.shortQuantity !== '0' ? number(platform.shortQuantity) : '—'}</td><td>{money(platform.exposure)}</td><td className={pnlClass(platform.realizedPnl)}>{money(platform.realizedPnl, true)}</td><td className={pnlClass(platform.unrealizedPnl)}>{money(platform.unrealizedPnl, true)}</td><td className={pnlClass(platform.netPnl)}>{money(platform.netPnl, true)}</td><td className="table-actions-column" /></tr>)}</>;
}

function ChartIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 4-7"/></svg>; }
