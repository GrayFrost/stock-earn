export type TradeSide = 'BUY' | 'SELL';
export type InferredAction = 'OPEN_LONG' | 'ADD_LONG' | 'CLOSE_LONG' | 'OPEN_SHORT' | 'ADD_SHORT' | 'CLOSE_SHORT';
export type ColorMode = 'us' | 'cn';

export interface AppSettings {
  initialized: boolean;
  startDate: string | null;
  colorMode: ColorMode;
  hasApiKey: boolean;
}

export interface Platform {
  id: string;
  name: string;
  archived: boolean;
  createdAt: string;
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  archived: boolean;
  createdAt: string;
}

export interface Trade {
  id: string;
  instrumentId: string;
  platformId: string;
  side: TradeSide;
  quantity: string;
  unitPrice: string;
  fee: string;
  executedAt: string;
  note: string;
  sequence: number;
  createdAt: string;
}

export interface TradeInput {
  instrumentId: string;
  platformId: string;
  side: TradeSide;
  quantity: string;
  unitPrice: string;
  fee: string;
  executedAt: string;
  note?: string;
}

export interface TradeResult extends Trade {
  action: InferredAction;
  realizedPnl: string;
}

export interface Quote {
  instrumentId: string;
  price: string;
  change: string;
  changePercent: string;
  quotedAt: string;
  fetchedAt: string;
  stale: boolean;
}

export interface DailyBar {
  instrumentId: string;
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface PlatformPosition {
  platform: Platform;
  direction: 'LONG' | 'SHORT' | 'FLAT';
  longQuantity: string;
  shortQuantity: string;
  averageOpenPrice: string;
  realizedPnl: string;
  unrealizedPnl: string;
  netPnl: string;
  fees: string;
  exposure: string;
}

export interface InstrumentPosition {
  instrument: Instrument;
  quote: Quote | null;
  sinceEntryHigh: string | null;
  sinceEntryLow: string | null;
  longQuantity: string;
  shortQuantity: string;
  realizedPnl: string;
  unrealizedPnl: string;
  netPnl: string;
  fees: string;
  exposure: string;
  platforms: PlatformPosition[];
  active: boolean;
}

export interface PortfolioSummary {
  startDate: string | null;
  asOf: string;
  realizedPnl: string;
  unrealizedPnl: string;
  netPnl: string;
  fees: string;
  longExposure: string;
  shortExposure: string;
  instruments: InstrumentPosition[];
}

export interface InstrumentDetail {
  instrument: Instrument;
  position: InstrumentPosition;
  trades: TradeResult[];
  bars: DailyBar[];
}

export interface RefreshResult {
  updated: number;
  failed: Array<{ symbol: string; message: string }>;
  quotaUsed: number;
}

export interface StockEarnApi {
  settings: {
    get(): Promise<AppSettings>;
    update(input: { startDate?: string; colorMode?: ColorMode; apiKey?: string | null; initialized?: boolean }): Promise<AppSettings>;
    testQuoteProvider(apiKey: string): Promise<{ ok: boolean; message: string }>;
  };
  platforms: {
    list(includeArchived?: boolean): Promise<Platform[]>;
    create(input: { name: string }): Promise<Platform>;
    update(input: { id: string; name: string }): Promise<Platform>;
    archive(input: { id: string; archived: boolean }): Promise<void>;
  };
  instruments: {
    list(includeArchived?: boolean): Promise<Instrument[]>;
    add(input: { symbol: string; name?: string; exchange?: string }): Promise<Instrument>;
    update(input: { id: string; name: string; exchange: string }): Promise<Instrument>;
    archive(input: { id: string; archived: boolean }): Promise<void>;
    getDetail(id: string): Promise<InstrumentDetail>;
  };
  trades: {
    create(input: TradeInput): Promise<Trade>;
    update(input: TradeInput & { id: string }): Promise<Trade>;
    delete(id: string): Promise<void>;
    list(instrumentId?: string): Promise<TradeResult[]>;
    preview(input: TradeInput & { id?: string }): Promise<{ action: InferredAction; resultingQuantity: string }>;
  };
  portfolio: { getSummary(): Promise<PortfolioSummary> };
  market: {
    getQuotes(instrumentIds?: string[]): Promise<Quote[]>;
    refreshQuotes(instrumentIds?: string[]): Promise<RefreshResult>;
    getDailyBars(instrumentId: string): Promise<DailyBar[]>;
    syncDailyBars(instrumentId: string): Promise<DailyBar[]>;
  };
  backup: {
    export(): Promise<{ path: string | null }>;
    restore(): Promise<{ restored: boolean; path: string | null }>;
  };
}
