import { useEffect, useRef } from 'react';
import { CandlestickSeries, ColorType, createChart, createSeriesMarkers, type BusinessDay, type SeriesMarker } from 'lightweight-charts';
import { DateTime } from 'luxon';
import type { DailyBar, TradeResult } from '../../shared/types';

const businessDay = (value: string): BusinessDay => {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
};

export function StockChart({ bars, trades, onSelectDate }: { bars: DailyBar[]; trades: TradeResult[]; onSelectDate: (date: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !bars.length) return;
    const chart = createChart(ref.current, {
      height: 390, layout: { background: { type: ColorType.Solid, color: '#FFFFFF' }, textColor: '#687386', fontFamily: 'IBM Plex Mono' },
      grid: { vertLines: { color: '#EDF0F4' }, horzLines: { color: '#EDF0F4' } }, rightPriceScale: { borderColor: '#DDE2E9' }, timeScale: { borderColor: '#DDE2E9' },
      crosshair: { vertLine: { color: '#91A0B5' }, horzLine: { color: '#91A0B5' } },
    });
    const series = chart.addSeries(CandlestickSeries, { upColor: '#087F5B', downColor: '#C23B3B', borderVisible: false, wickUpColor: '#087F5B', wickDownColor: '#C23B3B' });
    series.setData(bars.map((bar) => ({ time: businessDay(bar.date), open: Number(bar.open), high: Number(bar.high), low: Number(bar.low), close: Number(bar.close) })));
    const grouped = new Map<string, { buys: number; sells: number }>();
    trades.forEach((trade) => {
      const date = DateTime.fromISO(trade.executedAt).setZone('America/New_York').toISODate()!;
      const value = grouped.get(date) ?? { buys: 0, sells: 0 };
      if (trade.side === 'BUY') value.buys += 1; else value.sells += 1;
      grouped.set(date, value);
    });
    const markers: SeriesMarker<BusinessDay>[] = [];
    grouped.forEach((value, date) => {
      if (value.buys) markers.push({ time: businessDay(date), position: 'belowBar', color: '#2F6FED', shape: 'arrowUp', text: value.buys > 1 ? `买 ×${value.buys}` : '买' });
      if (value.sells) markers.push({ time: businessDay(date), position: 'aboveBar', color: '#D97706', shape: 'arrowDown', text: value.sells > 1 ? `卖 ×${value.sells}` : '卖' });
    });
    createSeriesMarkers(series, markers);
    chart.timeScale().fitContent();
    chart.subscribeClick((param) => {
      if (!param.time) return;
      const date = typeof param.time === 'string'
        ? param.time
        : typeof param.time === 'number'
          ? DateTime.fromSeconds(param.time, { zone: 'utc' }).toISODate()!
          : `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}`;
      if (grouped.has(date)) onSelectDate(date);
    });
    const observer = new ResizeObserver(([entry]) => chart.applyOptions({ width: entry.contentRect.width }));
    observer.observe(ref.current);
    return () => { observer.disconnect(); chart.remove(); };
  }, [bars, onSelectDate, trades]);
  return <div ref={ref} className="stock-chart">{!bars.length && <div className="chart-empty">同步历史日线后，这里会显示价格与买卖位置。</div>}</div>;
}
