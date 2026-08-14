import { randomUUID } from 'node:crypto';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import Decimal from 'decimal.js';
import { DateTime } from 'luxon';
import { computeFifo, PositionRuleError, previewTrade } from '../shared/fifo';
import type {
  AppSettings, ColorMode, DailyBar, FontSize, Instrument, InstrumentDetail, InstrumentPosition, Platform,
  PlatformPosition, PortfolioSummary, Quote, Trade, TradeInput, TradeResult,
} from '../shared/types';

type Row = Record<string, unknown>;

const now = () => new Date().toISOString();
const bool = (value: unknown) => Boolean(Number(value));
const str = (value: unknown) => String(value ?? '');
const decimal = (value: Decimal.Value) => new Decimal(value);
const decimalOut = (value: Decimal) => value.toDecimalPlaces(12).toString();

export interface BackupPayload {
  format: 'stock-earn-backup';
  version: 1;
  exportedAt: string;
  data: {
    settings: Row[];
    platforms: Row[];
    instruments: Row[];
    trades: Row[];
    quoteCache: Row[];
    dailyBars: Row[];
  };
}

export class LedgerDatabase {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  close() { this.db.close(); }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_meta (version INTEGER NOT NULL);
      INSERT INTO schema_meta(version) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM schema_meta);
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1), initialized INTEGER NOT NULL DEFAULT 0,
        start_date TEXT, color_mode TEXT NOT NULL DEFAULT 'us', font_size TEXT NOT NULL DEFAULT 'base'
      );
      CREATE TABLE IF NOT EXISTS platforms (
        id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS instruments (
        id TEXT PRIMARY KEY, symbol TEXT NOT NULL COLLATE NOCASE UNIQUE, name TEXT NOT NULL DEFAULT '',
        exchange TEXT NOT NULL DEFAULT '', archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY, instrument_id TEXT NOT NULL REFERENCES instruments(id), platform_id TEXT NOT NULL REFERENCES platforms(id),
        side TEXT NOT NULL CHECK(side IN ('BUY','SELL')), quantity TEXT NOT NULL, unit_price TEXT NOT NULL, fee TEXT NOT NULL,
        executed_at TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', sequence INTEGER NOT NULL UNIQUE, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_trades_position ON trades(instrument_id, platform_id, executed_at, sequence);
      CREATE TABLE IF NOT EXISTS quote_cache (
        instrument_id TEXT PRIMARY KEY REFERENCES instruments(id) ON DELETE CASCADE, price TEXT NOT NULL,
        change_value TEXT NOT NULL DEFAULT '0', change_percent TEXT NOT NULL DEFAULT '0', quoted_at TEXT NOT NULL, fetched_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS daily_bars (
        instrument_id TEXT NOT NULL REFERENCES instruments(id) ON DELETE CASCADE, date TEXT NOT NULL,
        open TEXT NOT NULL, high TEXT NOT NULL, low TEXT NOT NULL, close TEXT NOT NULL, volume TEXT NOT NULL DEFAULT '0',
        PRIMARY KEY(instrument_id, date)
      );
      CREATE TABLE IF NOT EXISTS provider_usage (
        day TEXT PRIMARY KEY, credits INTEGER NOT NULL DEFAULT 0, last_request_at TEXT
      );
    `);
    const settingsColumns = this.db.prepare('PRAGMA table_info(settings)').all() as Row[];
    if (!settingsColumns.some((column) => str(column.name) === 'font_size')) {
      this.db.exec("ALTER TABLE settings ADD COLUMN font_size TEXT NOT NULL DEFAULT 'base'");
    }
    this.db.prepare("INSERT OR IGNORE INTO settings(id, initialized, start_date, color_mode, font_size) VALUES (1, 0, NULL, 'us', 'base')").run();
    this.db.exec('UPDATE schema_meta SET version = 2 WHERE version < 2');
  }

  getSettings(hasApiKey = false): AppSettings {
    const row = this.db.prepare('SELECT * FROM settings WHERE id = 1').get() as Row;
    const fontSize = str(row.font_size);
    return {
      initialized: bool(row.initialized),
      startDate: row.start_date ? str(row.start_date) : null,
      colorMode: str(row.color_mode) as ColorMode,
      fontSize: ['base', 'comfortable', 'large', 'extra-large'].includes(fontSize) ? fontSize as FontSize : 'base',
      hasApiKey,
    };
  }

  updateSettings(input: { startDate?: string; colorMode?: ColorMode; fontSize?: FontSize; initialized?: boolean }) {
    const current = this.getSettings();
    if (input.startDate) {
      const dates = (this.db.prepare('SELECT executed_at FROM trades').all() as Row[]).map((row) => this.easternDate(str(row.executed_at))).sort();
      const earliest = dates[0];
      if (earliest && input.startDate > earliest) throw new Error(`起始日不能晚于最早交易日 ${earliest}`);
    }
    this.db.prepare('UPDATE settings SET start_date = ?, color_mode = ?, font_size = ?, initialized = ? WHERE id = 1').run(
      input.startDate ?? current.startDate,
      input.colorMode ?? current.colorMode,
      input.fontSize ?? current.fontSize,
      input.initialized === undefined ? Number(current.initialized) : Number(input.initialized),
    );
  }

  listPlatforms(includeArchived = false): Platform[] {
    return (this.db.prepare(`SELECT * FROM platforms ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY archived, name`).all() as Row[]).map(this.mapPlatform);
  }

  createPlatform(name: string): Platform {
    const platform = { id: randomUUID(), name, archived: false, createdAt: now() };
    this.db.prepare('INSERT INTO platforms(id,name,archived,created_at) VALUES (?,?,0,?)').run(platform.id, platform.name, platform.createdAt);
    return platform;
  }

  updatePlatform(id: string, name: string): Platform {
    this.db.prepare('UPDATE platforms SET name = ? WHERE id = ?').run(name, id);
    const row = this.db.prepare('SELECT * FROM platforms WHERE id = ?').get(id) as Row | undefined;
    if (!row) throw new Error('交易平台不存在');
    return this.mapPlatform(row);
  }

  archivePlatform(id: string, archived: boolean) {
    const result = this.db.prepare('UPDATE platforms SET archived = ? WHERE id = ?').run(Number(archived), id);
    if (!result.changes) throw new Error('交易平台不存在');
  }

  listInstruments(includeArchived = false): Instrument[] {
    return (this.db.prepare(`SELECT * FROM instruments ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY archived, symbol`).all() as Row[]).map(this.mapInstrument);
  }

  addInstrument(symbol: string, name = '', exchange = ''): Instrument {
    const instrument = { id: randomUUID(), symbol: symbol.toUpperCase(), name, exchange, archived: false, createdAt: now() };
    this.db.prepare('INSERT INTO instruments(id,symbol,name,exchange,archived,created_at) VALUES (?,?,?,?,0,?)').run(instrument.id, instrument.symbol, name, exchange, instrument.createdAt);
    return instrument;
  }

  updateInstrument(id: string, symbol: string, name: string, exchange: string): Instrument {
    return this.transaction(() => {
      const previous = this.db.prepare('SELECT symbol FROM instruments WHERE id = ?').get(id) as Row | undefined;
      if (!previous) throw new Error('股票不存在');
      const nextSymbol = symbol.toUpperCase();
      this.db.prepare('UPDATE instruments SET symbol = ?, name = ?, exchange = ? WHERE id = ?').run(nextSymbol, name, exchange, id);
      if (str(previous.symbol).toUpperCase() !== nextSymbol) {
        this.db.prepare('DELETE FROM quote_cache WHERE instrument_id = ?').run(id);
        this.db.prepare('DELETE FROM daily_bars WHERE instrument_id = ?').run(id);
      }
      return this.getInstrument(id);
    });
  }

  deleteInstrument(id: string) {
    this.transaction(() => {
      const instrument = this.db.prepare('SELECT id FROM instruments WHERE id = ?').get(id);
      if (!instrument) throw new Error('股票不存在');
      const tradeCount = Number((this.db.prepare('SELECT COUNT(*) AS value FROM trades WHERE instrument_id = ?').get(id) as Row).value);
      if (tradeCount) throw new Error('该股票仍有交易记录，不能永久删除；请先删除交易记录，或使用归档');
      this.db.prepare('DELETE FROM instruments WHERE id = ?').run(id);
    });
  }

  archiveInstrument(id: string, archived: boolean) {
    const result = this.db.prepare('UPDATE instruments SET archived = ? WHERE id = ?').run(Number(archived), id);
    if (!result.changes) throw new Error('股票不存在');
  }

  getInstrument(id: string): Instrument {
    const row = this.db.prepare('SELECT * FROM instruments WHERE id = ?').get(id) as Row | undefined;
    if (!row) throw new Error('股票不存在');
    return this.mapInstrument(row);
  }

  getTrades(instrumentId?: string, platformId?: string): Trade[] {
    const conditions: string[] = [];
    const values: string[] = [];
    if (instrumentId) { conditions.push('instrument_id = ?'); values.push(instrumentId); }
    if (platformId) { conditions.push('platform_id = ?'); values.push(platformId); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return (this.db.prepare(`SELECT * FROM trades ${where} ORDER BY executed_at, sequence`).all(...values) as Row[]).map(this.mapTrade);
  }

  getTradeResults(instrumentId?: string): TradeResult[] {
    const trades = this.getTrades(instrumentId);
    const groups = new Map<string, Trade[]>();
    for (const trade of trades) {
      const key = `${trade.instrumentId}:${trade.platformId}`;
      groups.set(key, [...(groups.get(key) ?? []), trade]);
    }
    return [...groups.values()].flatMap((group) => computeFifo(group).trades)
      .sort((a, b) => b.executedAt.localeCompare(a.executedAt) || b.sequence - a.sequence);
  }

  createTrade(input: TradeInput): Trade {
    return this.transaction(() => {
      this.assertTradeDate(input.executedAt);
      const trade: Trade = { ...input, note: input.note ?? '', id: randomUUID(), sequence: this.nextSequence(), createdAt: now() };
      this.insertTrade(trade);
      this.validatePosition(trade.instrumentId, trade.platformId);
      return trade;
    });
  }

  updateTrade(id: string, input: TradeInput): Trade {
    return this.transaction(() => {
      this.assertTradeDate(input.executedAt);
      const previous = this.db.prepare('SELECT * FROM trades WHERE id = ?').get(id) as Row | undefined;
      if (!previous) throw new Error('交易记录不存在');
      const old = this.mapTrade(previous);
      this.db.prepare(`UPDATE trades SET instrument_id=?, platform_id=?, side=?, quantity=?, unit_price=?, fee=?, executed_at=?, note=? WHERE id=?`).run(
        input.instrumentId, input.platformId, input.side, input.quantity, input.unitPrice, input.fee, input.executedAt, input.note ?? '', id,
      );
      this.validatePosition(old.instrumentId, old.platformId);
      this.validatePosition(input.instrumentId, input.platformId);
      return { ...old, ...input, note: input.note ?? '' };
    });
  }

  deleteTrade(id: string) {
    this.transaction(() => {
      const row = this.db.prepare('SELECT * FROM trades WHERE id = ?').get(id) as Row | undefined;
      if (!row) throw new Error('交易记录不存在');
      const trade = this.mapTrade(row);
      this.db.prepare('DELETE FROM trades WHERE id = ?').run(id);
      this.validatePosition(trade.instrumentId, trade.platformId);
    });
  }

  preview(input: TradeInput, editingId?: string) {
    this.assertTradeDate(input.executedAt);
    const editing = editingId ? this.db.prepare('SELECT * FROM trades WHERE id = ?').get(editingId) as Row | undefined : undefined;
    const mock: Trade = { ...input, note: input.note ?? '', id: randomUUID(), sequence: editing ? Number(editing.sequence) : this.nextSequence(), createdAt: now() };
    return previewTrade(this.getTrades(input.instrumentId, input.platformId).filter((trade) => trade.id !== editingId), mock);
  }

  getPortfolioSummary(): PortfolioSummary {
    const instruments = this.listInstruments(true);
    const platforms = new Map(this.listPlatforms(true).map((platform) => [platform.id, platform]));
    const quotes = new Map(this.getQuotes().map((quote) => [quote.instrumentId, quote]));
    const startDate = this.getSettings().startDate;
    const positions: InstrumentPosition[] = instruments.map((instrument) => {
      const quote = quotes.get(instrument.id) ?? null;
      const trades = this.getTrades(instrument.id);
      const bars = startDate ? this.getDailyBars(instrument.id).filter((bar) => bar.date >= startDate) : [];
      const highs = bars.map((bar) => decimal(bar.high));
      const lows = bars.map((bar) => decimal(bar.low));
      if (quote && bars.length) {
        highs.push(decimal(quote.price));
        lows.push(decimal(quote.price));
      }
      const sinceEntryHigh = highs.length ? decimalOut(Decimal.max(...highs)) : null;
      const sinceEntryLow = lows.length ? decimalOut(Decimal.min(...lows)) : null;
      const grouped = new Map<string, Trade[]>();
      for (const trade of trades) grouped.set(trade.platformId, [...(grouped.get(trade.platformId) ?? []), trade]);
      const platformPositions: PlatformPosition[] = [...grouped].map(([platformId, group]) => {
        const result = computeFifo(group, quote?.price);
        return {
          platform: platforms.get(platformId)!, direction: result.direction, longQuantity: result.longQuantity,
          shortQuantity: result.shortQuantity, averageOpenPrice: result.averageOpenPrice, realizedPnl: result.realizedPnl,
          unrealizedPnl: result.unrealizedPnl, netPnl: decimalOut(decimal(result.realizedPnl).plus(result.unrealizedPnl)),
          fees: result.fees, exposure: result.exposure,
        };
      });
      const sum = (key: 'longQuantity' | 'shortQuantity' | 'realizedPnl' | 'unrealizedPnl' | 'fees' | 'exposure') =>
        decimalOut(platformPositions.reduce((total, item) => total.plus(item[key]), decimal(0)));
      const realizedPnl = sum('realizedPnl');
      const unrealizedPnl = sum('unrealizedPnl');
      return {
        instrument, quote, sinceEntryHigh, sinceEntryLow, longQuantity: sum('longQuantity'), shortQuantity: sum('shortQuantity'), realizedPnl, unrealizedPnl,
        netPnl: decimalOut(decimal(realizedPnl).plus(unrealizedPnl)), fees: sum('fees'), exposure: sum('exposure'),
        platforms: platformPositions, active: platformPositions.some((item) => item.direction !== 'FLAT'),
      };
    });
    const total = (key: 'realizedPnl' | 'unrealizedPnl' | 'fees') => decimalOut(positions.reduce((sum, item) => sum.plus(item[key]), decimal(0)));
    const realizedPnl = total('realizedPnl');
    const unrealizedPnl = total('unrealizedPnl');
    const longExposure = decimalOut(positions.reduce((sum, item) => sum.plus(item.platforms.filter((p) => p.direction === 'LONG').reduce((s, p) => s.plus(p.exposure), decimal(0))), decimal(0)));
    const shortExposure = decimalOut(positions.reduce((sum, item) => sum.plus(item.platforms.filter((p) => p.direction === 'SHORT').reduce((s, p) => s.plus(p.exposure), decimal(0))), decimal(0)));
    return { startDate, asOf: now(), realizedPnl, unrealizedPnl, netPnl: decimalOut(decimal(realizedPnl).plus(unrealizedPnl)), fees: total('fees'), longExposure, shortExposure, instruments: positions };
  }

  getInstrumentDetail(id: string): InstrumentDetail {
    const position = this.getPortfolioSummary().instruments.find((item) => item.instrument.id === id);
    if (!position) throw new Error('股票不存在');
    return { instrument: position.instrument, position, trades: this.getTradeResults(id), bars: this.getDailyBars(id) };
  }

  getQuotes(instrumentIds?: string[]): Quote[] {
    let rows: Row[];
    if (instrumentIds?.length) {
      const marks = instrumentIds.map(() => '?').join(',');
      rows = this.db.prepare(`SELECT * FROM quote_cache WHERE instrument_id IN (${marks})`).all(...instrumentIds) as Row[];
    } else rows = this.db.prepare('SELECT * FROM quote_cache').all() as Row[];
    return rows.map((row) => ({
      instrumentId: str(row.instrument_id), price: str(row.price), change: str(row.change_value), changePercent: str(row.change_percent),
      quotedAt: str(row.quoted_at), fetchedAt: str(row.fetched_at), stale: Date.now() - new Date(str(row.fetched_at)).getTime() > 15 * 60_000,
    }));
  }

  upsertQuote(quote: Omit<Quote, 'stale'>) {
    this.db.prepare(`INSERT INTO quote_cache(instrument_id,price,change_value,change_percent,quoted_at,fetched_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(instrument_id) DO UPDATE SET price=excluded.price,change_value=excluded.change_value,change_percent=excluded.change_percent,quoted_at=excluded.quoted_at,fetched_at=excluded.fetched_at`)
      .run(quote.instrumentId, quote.price, quote.change, quote.changePercent, quote.quotedAt, quote.fetchedAt);
  }

  getDailyBars(instrumentId: string): DailyBar[] {
    return (this.db.prepare('SELECT * FROM daily_bars WHERE instrument_id = ? ORDER BY date').all(instrumentId) as Row[]).map((row) => ({
      instrumentId: str(row.instrument_id), date: str(row.date), open: str(row.open), high: str(row.high), low: str(row.low), close: str(row.close), volume: str(row.volume),
    }));
  }

  upsertBars(bars: DailyBar[]) {
    const statement = this.db.prepare(`INSERT INTO daily_bars(instrument_id,date,open,high,low,close,volume) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(instrument_id,date) DO UPDATE SET open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,volume=excluded.volume`);
    this.transaction(() => bars.forEach((bar) => statement.run(bar.instrumentId, bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume)));
  }

  getUsage(day: string): { credits: number; lastRequestAt: string | null } {
    const row = this.db.prepare('SELECT * FROM provider_usage WHERE day = ?').get(day) as Row | undefined;
    return { credits: Number(row?.credits ?? 0), lastRequestAt: row?.last_request_at ? str(row.last_request_at) : null };
  }

  addUsage(day: string, credits: number) {
    this.db.prepare(`INSERT INTO provider_usage(day,credits,last_request_at) VALUES (?,?,?)
      ON CONFLICT(day) DO UPDATE SET credits=credits+excluded.credits,last_request_at=excluded.last_request_at`).run(day, credits, now());
  }

  createBackup(): BackupPayload {
    const all = (table: string) => this.db.prepare(`SELECT * FROM ${table}`).all() as Row[];
    return { format: 'stock-earn-backup', version: 1, exportedAt: now(), data: { settings: all('settings'), platforms: all('platforms'), instruments: all('instruments'), trades: all('trades'), quoteCache: all('quote_cache'), dailyBars: all('daily_bars') } };
  }

  restoreBackup(payload: BackupPayload) {
    if (payload.format !== 'stock-earn-backup' || payload.version !== 1 || !payload.data) throw new Error('不是有效的 Stock Earn 备份文件');
    this.transaction(() => {
      for (const table of ['daily_bars', 'quote_cache', 'trades', 'instruments', 'platforms', 'settings']) this.db.prepare(`DELETE FROM ${table}`).run();
      this.insertRows('settings', payload.data.settings);
      this.insertRows('platforms', payload.data.platforms);
      this.insertRows('instruments', payload.data.instruments);
      this.insertRows('trades', payload.data.trades);
      this.insertRows('quote_cache', payload.data.quoteCache);
      this.insertRows('daily_bars', payload.data.dailyBars);
      for (const instrument of this.listInstruments(true)) {
        const platformIds = new Set(this.getTrades(instrument.id).map((trade) => trade.platformId));
        platformIds.forEach((platformId) => this.validatePosition(instrument.id, platformId));
      }
    });
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private insertRows(table: string, rows: Row[]) {
    for (const row of rows) {
      const keys = Object.keys(row);
      this.db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((key) => row[key] as SQLInputValue));
    }
  }

  private insertTrade(trade: Trade) {
    this.db.prepare(`INSERT INTO trades(id,instrument_id,platform_id,side,quantity,unit_price,fee,executed_at,note,sequence,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(trade.id, trade.instrumentId, trade.platformId, trade.side, trade.quantity, trade.unitPrice, trade.fee, trade.executedAt, trade.note, trade.sequence, trade.createdAt);
  }

  private validatePosition(instrumentId: string, platformId: string) {
    try { computeFifo(this.getTrades(instrumentId, platformId)); }
    catch (error) {
      if (error instanceof PositionRuleError) {
        const conflicting = this.db.prepare('SELECT executed_at FROM trades WHERE id = ?').get(error.tradeId) as Row | undefined;
        throw new Error(`${error.message}（冲突交易：${conflicting?.executed_at ?? error.tradeId}）`);
      }
      throw error;
    }
  }

  private assertTradeDate(executedAt: string) {
    const startDate = this.getSettings().startDate;
    if (!startDate) throw new Error('请先设置入市起始日');
    if (this.easternDate(executedAt) < startDate) throw new Error(`交易时间不能早于入市起始日 ${startDate}`);
  }

  private easternDate(iso: string) { return DateTime.fromISO(iso).setZone('America/New_York').toISODate()!; }

  private nextSequence(): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM trades').get() as Row;
    return Number(row.value);
  }

  private mapPlatform = (row: Row): Platform => ({ id: str(row.id), name: str(row.name), archived: bool(row.archived), createdAt: str(row.created_at) });
  private mapInstrument = (row: Row): Instrument => ({ id: str(row.id), symbol: str(row.symbol), name: str(row.name), exchange: str(row.exchange), archived: bool(row.archived), createdAt: str(row.created_at) });
  private mapTrade = (row: Row): Trade => ({
    id: str(row.id), instrumentId: str(row.instrument_id), platformId: str(row.platform_id), side: str(row.side) as Trade['side'],
    quantity: str(row.quantity), unitPrice: str(row.unit_price), fee: str(row.fee), executedAt: str(row.executed_at), note: str(row.note), sequence: Number(row.sequence), createdAt: str(row.created_at),
  });
}
