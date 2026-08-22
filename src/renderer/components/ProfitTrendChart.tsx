import { useMemo } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DateTime } from 'luxon';
import type { TradeResult } from '../../shared/types';
import { money } from '../format';

export function ProfitTrendChart({ trades }: { trades: TradeResult[] }) {
  const data = useMemo(() => {
    const monthly = new Map<string, number>();
    trades.forEach((trade) => {
      const value = Number(trade.realizedPnl);
      if (!value) return;
      const month = DateTime.fromISO(trade.executedAt).setZone('America/New_York').toFormat('yyyy-LL');
      monthly.set(month, (monthly.get(month) ?? 0) + value);
    });
    let cumulative = 0;
    return [...monthly].sort(([a], [b]) => a.localeCompare(b)).map(([month, realized]) => {
      cumulative += realized;
      const date = DateTime.fromFormat(month, 'yyyy-LL');
      return { month, label: `${date.year}年${date.month}月`, realized, cumulative };
    });
  }, [trades]);

  if (!data.length) return <div className="profit-chart-empty"><span className="empty-glyph">↗</span><div><strong>完成一次平仓后，这里会出现盈亏轨迹</strong><p>柱形表示当月已实现盈亏，折线表示累计结果。</p></div></div>;

  return <div className="profit-chart-wrap" aria-label="已实现盈亏趋势图">
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="#edf0f4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#7d899a', fontFamily: 'IBM Plex Mono', fontSize: 10 }} dy={8} />
        <YAxis yAxisId="monthly" hide />
        <YAxis yAxisId="cumulative" hide orientation="right" />
        <ReferenceLine yAxisId="monthly" y={0} stroke="#cfd6df" />
        <Tooltip cursor={{ fill: 'rgba(47, 111, 237, .045)' }} content={({ active, payload, label }) => active && payload?.length ? <div className="profit-chart-tooltip"><span>{label}</span><div><i />当月 <strong className={Number(payload[0]?.value) >= 0 ? 'is-profit' : 'is-loss'}>{money(Number(payload[0]?.value), true)}</strong></div><div><i className="line" />累计 <strong className={Number(payload[1]?.value) >= 0 ? 'is-profit' : 'is-loss'}>{money(Number(payload[1]?.value), true)}</strong></div></div> : null} />
        <Bar yAxisId="monthly" dataKey="realized" radius={[4, 4, 1, 1]} maxBarSize={28}>{data.map((item) => <Cell key={item.month} fill={item.realized >= 0 ? 'var(--profit)' : 'var(--loss)'} fillOpacity={0.72} />)}</Bar>
        <Line yAxisId="cumulative" type="monotone" dataKey="cumulative" stroke="#2f6fed" strokeWidth={2} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>;
}
