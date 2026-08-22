import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LedgerDatabase } from './database';

describe('LedgerDatabase', () => {
  let db: LedgerDatabase;
  beforeEach(() => { db = new LedgerDatabase(':memory:'); db.updateSettings({ startDate: '2026-01-01', initialized: true }); });
  afterEach(() => db.close());

  function seed() {
    const platform = db.createPlatform('IBKR');
    const instrument = db.addInstrument('AAPL', 'Apple Inc.', 'NASDAQ');
    return { platform, instrument };
  }

  it('持久化交易并汇总多头净盈亏', () => {
    const { platform, instrument } = seed();
    db.createTrade({ instrumentId: instrument.id, platformId: platform.id, side: 'BUY', quantity: '2.5', unitPrice: '100', fee: '0.5', executedAt: '2026-01-02T15:00:00.000Z', note: '' });
    db.upsertQuote({ instrumentId: instrument.id, price: '110', change: '1', changePercent: '0.92', quotedAt: '2026-01-03T21:00:00.000Z', fetchedAt: new Date().toISOString() });
    const summary = db.getPortfolioSummary();
    expect(summary.instruments[0].longQuantity).toBe('2.5');
    expect(summary.instruments[0].unrealizedPnl).toBe('24.5');
    expect(summary.netPnl).toBe('24.5');
  });

  it('按平台汇总手续费并保留已归档平台', () => {
    const { platform, instrument } = seed();
    const secondPlatform = db.createPlatform('Firstrade');
    db.createTrade({ instrumentId: instrument.id, platformId: platform.id, side: 'BUY', quantity: '1', unitPrice: '100', fee: '0.35', executedAt: '2026-01-02T15:00:00.000Z', note: '' });
    db.createTrade({ instrumentId: instrument.id, platformId: platform.id, side: 'SELL', quantity: '1', unitPrice: '105', fee: '0.65', executedAt: '2026-01-03T15:00:00.000Z', note: '' });
    db.createTrade({ instrumentId: instrument.id, platformId: secondPlatform.id, side: 'BUY', quantity: '1', unitPrice: '102', fee: '0.2', executedAt: '2026-01-04T15:00:00.000Z', note: '' });
    db.archivePlatform(platform.id, true);

    const summary = db.getPortfolioSummary();
    expect(summary.fees).toBe('1.2');
    expect(summary.platformFees).toEqual([
      { platform: expect.objectContaining({ id: platform.id, archived: true }), fees: '1', tradeCount: 2 },
      { platform: expect.objectContaining({ id: secondPlatform.id, archived: false }), fees: '0.2', tradeCount: 1 },
    ]);
  });

  it('按账本起始日汇总每只股票的最高价和最低价，并纳入最新参考价', () => {
    const { instrument } = seed();
    db.upsertBars([
      { instrumentId: instrument.id, date: '2025-12-31', open: '80', high: '500', low: '1', close: '90', volume: '100' },
      { instrumentId: instrument.id, date: '2026-01-02', open: '100', high: '120.25', low: '95.5', close: '115', volume: '100' },
      { instrumentId: instrument.id, date: '2026-01-03', open: '115', high: '130', low: '110', close: '125', volume: '100' },
    ]);
    db.upsertQuote({ instrumentId: instrument.id, price: '132.75', change: '7.75', changePercent: '6.2', quotedAt: '2026-01-04T21:00:00.000Z', fetchedAt: new Date().toISOString() });

    const position = db.getPortfolioSummary().instruments[0];
    expect(position.sinceEntryHigh).toBe('132.75');
    expect(position.sinceEntryLow).toBe('95.5');
  });

  it('没有历史日线时不把最新参考价误当成入市区间', () => {
    const { instrument } = seed();
    db.upsertQuote({ instrumentId: instrument.id, price: '110', change: '1', changePercent: '0.92', quotedAt: '2026-01-03T21:00:00.000Z', fetchedAt: new Date().toISOString() });

    const position = db.getPortfolioSummary().instruments[0];
    expect(position.sinceEntryHigh).toBeNull();
    expect(position.sinceEntryLow).toBeNull();
  });

  it('反手失败时回滚新交易', () => {
    const { platform, instrument } = seed();
    db.createTrade({ instrumentId: instrument.id, platformId: platform.id, side: 'SELL', quantity: '2', unitPrice: '50', fee: '0', executedAt: '2026-01-02T15:00:00.000Z' });
    expect(() => db.createTrade({ instrumentId: instrument.id, platformId: platform.id, side: 'BUY', quantity: '3', unitPrice: '45', fee: '0', executedAt: '2026-01-03T15:00:00.000Z' })).toThrow('不能穿过零仓位');
    expect(db.getTrades()).toHaveLength(1);
  });

  it('拒绝把起始日移动到已有交易之后', () => {
    const { platform, instrument } = seed();
    db.createTrade({ instrumentId: instrument.id, platformId: platform.id, side: 'BUY', quantity: '1', unitPrice: '10', fee: '0', executedAt: '2026-01-05T15:00:00.000Z' });
    expect(() => db.updateSettings({ startDate: '2026-01-06' })).toThrow('最早交易日');
  });

  it('默认使用基础字号并持久化字体设置', () => {
    expect(db.getSettings().fontSize).toBe('base');
    db.updateSettings({ fontSize: 'large' });
    expect(db.getSettings().fontSize).toBe('large');
  });

  it('可以修正股票代码和公司名称', () => {
    const { instrument } = seed();
    db.upsertQuote({ instrumentId: instrument.id, price: '25', change: '1', changePercent: '4', quotedAt: '2026-01-03T21:00:00.000Z', fetchedAt: new Date().toISOString() });
    db.upsertBars([{ instrumentId: instrument.id, date: '2026-01-02', open: '24', high: '26', low: '23', close: '25', volume: '100' }]);
    const updated = db.updateInstrument(instrument.id, 'PHG', 'Koninklijke Philips', 'NYSE');
    expect(updated).toMatchObject({ symbol: 'PHG', name: 'Koninklijke Philips', exchange: 'NYSE' });
    expect(db.getQuotes([instrument.id])).toHaveLength(0);
    expect(db.getDailyBars(instrument.id)).toHaveLength(0);
  });

  it('永久删除没有交易的股票及其行情数据', () => {
    const { instrument } = seed();
    db.upsertQuote({ instrumentId: instrument.id, price: '25', change: '1', changePercent: '4', quotedAt: '2026-01-03T21:00:00.000Z', fetchedAt: new Date().toISOString() });
    db.deleteInstrument(instrument.id);
    expect(db.listInstruments(true)).toHaveLength(0);
    expect(db.getQuotes()).toHaveLength(0);
  });

  it('有交易记录的股票不能被永久删除', () => {
    const { platform, instrument } = seed();
    db.createTrade({ instrumentId: instrument.id, platformId: platform.id, side: 'BUY', quantity: '1', unitPrice: '10', fee: '0', executedAt: '2026-01-05T15:00:00.000Z' });
    expect(() => db.deleteInstrument(instrument.id)).toThrow('仍有交易记录');
  });

  it('编辑交易成交价后重新计算盈亏', () => {
    const { platform, instrument } = seed();
    const buy = db.createTrade({ instrumentId: instrument.id, platformId: platform.id, side: 'BUY', quantity: '1', unitPrice: '10', fee: '0', executedAt: '2026-01-05T15:00:00.000Z' });
    db.createTrade({ instrumentId: instrument.id, platformId: platform.id, side: 'SELL', quantity: '1', unitPrice: '15', fee: '0', executedAt: '2026-01-06T15:00:00.000Z' });
    db.updateTrade(buy.id, { instrumentId: instrument.id, platformId: platform.id, side: 'BUY', quantity: '1', unitPrice: '12', fee: '0', executedAt: '2026-01-05T15:00:00.000Z', note: '' });
    expect(db.getPortfolioSummary().instruments[0].realizedPnl).toBe('3');
  });

  it('导出并恢复版本化备份', () => {
    const { platform, instrument } = seed();
    db.createTrade({ instrumentId: instrument.id, platformId: platform.id, side: 'BUY', quantity: '1', unitPrice: '10', fee: '0', executedAt: '2026-01-05T15:00:00.000Z' });
    const backup = db.createBackup();
    db.addInstrument('MSFT');
    db.restoreBackup(backup);
    expect(db.listInstruments(true).map((item) => item.symbol)).toEqual(['AAPL']);
    expect(db.getTrades()).toHaveLength(1);
  });
});
