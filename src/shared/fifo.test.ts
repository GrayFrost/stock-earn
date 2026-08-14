import { describe, expect, it } from 'vitest';
import { computeFifo, PositionRuleError } from './fifo';
import type { Trade } from './types';

const trade = (id: string, side: 'BUY' | 'SELL', quantity: string, price: string, fee = '0', sequence = 1): Trade => ({
  id, instrumentId: '00000000-0000-4000-8000-000000000001', platformId: '00000000-0000-4000-8000-000000000002',
  side, quantity, unitPrice: price, fee, executedAt: `2026-01-${String(sequence).padStart(2, '0')}T15:00:00.000Z`, note: '', sequence, createdAt: '2026-01-01T00:00:00.000Z',
});

describe('computeFifo', () => {
  it('计算多头 FIFO、部分平仓和费用', () => {
    const result = computeFifo([trade('a', 'BUY', '10', '100', '1', 1), trade('b', 'BUY', '5', '120', '0.5', 2), trade('c', 'SELL', '12', '130', '1.2', 3)], '125');
    expect(result.direction).toBe('LONG');
    expect(result.longQuantity).toBe('3');
    expect(Number(result.realizedPnl)).toBeCloseTo(317.6, 8);
    expect(Number(result.unrealizedPnl)).toBeCloseTo(14.7, 8);
  });

  it('计算空头开仓和回补', () => {
    const result = computeFifo([trade('a', 'SELL', '4', '50', '0.4', 1), trade('b', 'BUY', '1.5', '40', '0.15', 2)], '45');
    expect(result.direction).toBe('SHORT');
    expect(result.shortQuantity).toBe('2.5');
    expect(Number(result.realizedPnl)).toBeCloseTo(14.7, 8);
    expect(Number(result.unrealizedPnl)).toBeCloseTo(12.25, 8);
  });

  it('拒绝单笔反手', () => {
    expect(() => computeFifo([trade('a', 'BUY', '2', '10', '0', 1), trade('b', 'SELL', '3', '11', '0', 2)])).toThrow(PositionRuleError);
  });

  it('支持碎股并按时间与序号排序', () => {
    const result = computeFifo([trade('b', 'SELL', '0.1', '12', '0', 2), trade('a', 'BUY', '0.3', '10', '0', 1)], '11');
    expect(result.longQuantity).toBe('0.2');
    expect(result.realizedPnl).toBe('0.2');
  });
});
