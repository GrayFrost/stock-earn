import { describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../shared/types';
import type { LedgerDatabase } from './database';
import { MarketService } from './market';
import type { SecretStore } from './secrets';

const instrument: Instrument = {
  id: 'instrument-1', symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', archived: false, createdAt: '2026-01-01T00:00:00.000Z',
};

function dependencies(instrumentCount = 1) {
  let credits = 0;
  const upsertQuote = vi.fn();
  const instruments = Array.from({ length: instrumentCount }, (_value, index) => ({
    ...instrument, id: `instrument-${index + 1}`, symbol: `STOCK${String(index + 1).padStart(2, '0')}`,
  }));
  const db = {
    listInstruments: () => instruments,
    getQuotes: () => [],
    getUsage: () => ({ credits, lastRequestAt: null }),
    addUsage: (_day: string, count: number) => { credits += count; },
    upsertQuote,
  } as unknown as LedgerDatabase;
  const secrets = { getApiKey: () => 'test-key' } as unknown as SecretStore;
  return { db, secrets, upsertQuote };
}

describe('MarketService', () => {
  it('行情请求无响应时会超时并结束刷新', async () => {
    const { db, secrets } = dependencies();
    const fetcher = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      if (init?.signal?.aborted) abort();
      else init?.signal?.addEventListener('abort', abort, { once: true });
    })) as typeof fetch;
    const market = new MarketService(db, secrets, fetcher, 5);

    const result = await market.refreshQuotes();

    expect(result.updated).toBe(0);
    expect(result.failed).toEqual([{ symbol: 'STOCK01', message: '行情服务连接超时（1 秒），请稍后重试' }]);
  });

  it('并发刷新会复用正在进行的行情请求', async () => {
    const { db, secrets, upsertQuote } = dependencies();
    let finishRequest!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { finishRequest = resolve; })) as unknown as typeof fetch;
    const market = new MarketService(db, secrets, fetcher, 1_000);

    const first = market.refreshQuotes();
    const second = market.refreshQuotes();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    finishRequest(new Response(JSON.stringify({ close: '123', change: '1', percent_change: '0.82', datetime: '2026-08-14' })));

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ updated: 1, failed: [] }),
      expect.objectContaining({ updated: 1, failed: [] }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(upsertQuote).toHaveBeenCalledTimes(1);
  });

  it('股票超过每分钟额度时快速返回，不等待一分钟', async () => {
    const { db, secrets } = dependencies(15);
    const payload = Object.fromEntries(Array.from({ length: 8 }, (_value, index) => [
      `STOCK${String(index + 1).padStart(2, '0')}`,
      { close: '100', change: '0', percent_change: '0', datetime: '2026-08-14' },
    ]));
    const fetcher = vi.fn(async () => new Response(JSON.stringify(payload))) as unknown as typeof fetch;
    const market = new MarketService(db, secrets, fetcher, 1_000);

    const result = await market.refreshQuotes();

    expect(result.updated).toBe(8);
    expect(result.failed).toHaveLength(7);
    expect(result.failed[0].message).toMatch(/免费行情额度暂时用完/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
