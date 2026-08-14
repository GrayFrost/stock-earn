import type { DailyBar, Quote, RefreshResult } from '../shared/types';
import type { LedgerDatabase } from './database';
import type { SecretStore } from './secrets';

type Fetcher = typeof fetch;
const API = 'https://api.twelvedata.com';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function marketDay() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export class MarketService {
  private creditTimes: number[] = [];
  constructor(private readonly db: LedgerDatabase, private readonly secrets: SecretStore, private readonly fetcher: Fetcher = fetch) {}

  async testApiKey(apiKey: string) {
    try {
      const response = await this.fetcher(`${API}/quote?symbol=AAPL&apikey=${encodeURIComponent(apiKey)}`);
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok || data.status === 'error' || data.code) return { ok: false, message: String(data.message ?? 'API Key 无效或服务不可用') };
      if (!data.close) return { ok: false, message: '未收到有效的 AAPL 行情' };
      return { ok: true, message: `连接成功 · AAPL $${data.close}` };
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : '网络连接失败' }; }
  }

  async refreshQuotes(instrumentIds?: string[]): Promise<RefreshResult> {
    const apiKey = this.secrets.getApiKey();
    if (!apiKey) throw new Error('请先在设置中填写 Twelve Data API Key');
    const all = this.db.listInstruments(false);
    const selected = instrumentIds?.length ? all.filter((item) => instrumentIds.includes(item.id)) : all;
    const failed: RefreshResult['failed'] = [];
    let updated = 0;
    for (let index = 0; index < selected.length; index += 8) {
      const batch = selected.slice(index, index + 8);
      await this.acquireCredits(batch.length);
      try {
        const symbols = batch.map((item) => item.symbol).join(',');
        const response = await this.fetcher(`${API}/quote?symbol=${encodeURIComponent(symbols)}&apikey=${encodeURIComponent(apiKey)}`);
        const payload = await response.json() as Record<string, unknown>;
        if (!response.ok || payload.status === 'error' || payload.code) throw new Error(String(payload.message ?? '行情服务返回错误'));
        for (const instrument of batch) {
          const raw = batch.length === 1 ? payload : payload[instrument.symbol] as Record<string, unknown> | undefined;
          if (!raw || raw.status === 'error' || !raw.close) { failed.push({ symbol: instrument.symbol, message: String(raw?.message ?? '没有最新价格') }); continue; }
          const fetchedAt = new Date().toISOString();
          this.db.upsertQuote({ instrumentId: instrument.id, price: String(raw.close), change: String(raw.change ?? '0'), changePercent: String(raw.percent_change ?? '0'), quotedAt: String(raw.datetime ?? fetchedAt), fetchedAt });
          updated += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '行情刷新失败';
        batch.forEach((item) => failed.push({ symbol: item.symbol, message }));
      }
    }
    return { updated, failed, quotaUsed: this.db.getUsage(marketDay()).credits };
  }

  async syncDailyBars(instrumentId: string): Promise<DailyBar[]> {
    const apiKey = this.secrets.getApiKey();
    if (!apiKey) throw new Error('请先在设置中填写 Twelve Data API Key');
    const instrument = this.db.getInstrument(instrumentId);
    const startDate = this.db.getSettings().startDate;
    if (!startDate) throw new Error('请先设置入市起始日');
    await this.acquireCredits(1);
    const url = `${API}/time_series?symbol=${encodeURIComponent(instrument.symbol)}&interval=1day&start_date=${startDate}&order=ASC&outputsize=5000&apikey=${encodeURIComponent(apiKey)}`;
    const response = await this.fetcher(url);
    const payload = await response.json() as { status?: string; code?: number; message?: string; values?: Array<Record<string, unknown>> };
    if (!response.ok || payload.status === 'error' || payload.code || !payload.values) throw new Error(payload.message ?? '无法获取历史日线');
    const bars: DailyBar[] = payload.values.map((value) => ({
      instrumentId, date: String(value.datetime).slice(0, 10), open: String(value.open), high: String(value.high), low: String(value.low), close: String(value.close), volume: String(value.volume ?? '0'),
    }));
    this.db.upsertBars(bars);
    return this.db.getDailyBars(instrumentId);
  }

  private async acquireCredits(count: number) {
    const day = marketDay();
    const usage = this.db.getUsage(day);
    if (usage.credits + count > 800) throw new Error('今日行情额度已用完，请明日再刷新');
    while (true) {
      const cutoff = Date.now() - 60_000;
      this.creditTimes = this.creditTimes.filter((time) => time > cutoff);
      if (this.creditTimes.length + count <= 8) break;
      await wait(Math.max(250, this.creditTimes[0] + 60_000 - Date.now()));
    }
    const timestamp = Date.now();
    for (let i = 0; i < count; i += 1) this.creditTimes.push(timestamp);
    this.db.addUsage(day, count);
  }
}
