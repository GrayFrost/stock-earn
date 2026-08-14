import { contextBridge, ipcRenderer } from 'electron';
import type { StockEarnApi } from '../shared/types';

const invoke = <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>;

const api: StockEarnApi = {
  settings: {
    get: () => invoke('settings.get'),
    update: (input) => invoke('settings.update', input),
    testQuoteProvider: (apiKey) => invoke('settings.testQuoteProvider', apiKey),
  },
  platforms: {
    list: (includeArchived) => invoke('platforms.list', includeArchived),
    create: (input) => invoke('platforms.create', input),
    update: (input) => invoke('platforms.update', input),
    archive: (input) => invoke('platforms.archive', input),
  },
  instruments: {
    list: (includeArchived) => invoke('instruments.list', includeArchived),
    add: (input) => invoke('instruments.add', input),
    update: (input) => invoke('instruments.update', input),
    archive: (input) => invoke('instruments.archive', input),
    getDetail: (id) => invoke('instruments.getDetail', id),
  },
  trades: {
    create: (input) => invoke('trades.create', input),
    update: (input) => invoke('trades.update', input),
    delete: (id) => invoke('trades.delete', id),
    list: (instrumentId) => invoke('trades.list', instrumentId),
    preview: (input) => invoke('trades.preview', input),
  },
  portfolio: { getSummary: () => invoke('portfolio.getSummary') },
  market: {
    getQuotes: (instrumentIds) => invoke('market.getQuotes', instrumentIds),
    refreshQuotes: (instrumentIds) => invoke('market.refreshQuotes', instrumentIds),
    getDailyBars: (instrumentId) => invoke('market.getDailyBars', instrumentId),
    syncDailyBars: (instrumentId) => invoke('market.syncDailyBars', instrumentId),
  },
  backup: { export: () => invoke('backup.export'), restore: () => invoke('backup.restore') },
};

contextBridge.exposeInMainWorld('stockEarn', api);
