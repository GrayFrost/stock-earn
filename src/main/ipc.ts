import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, dialog, ipcMain, type WebFrameMain } from 'electron';
import { archiveSchema, idSchema, instrumentAddSchema, instrumentUpdateSchema, platformCreateSchema, platformUpdateSchema, settingsUpdateSchema, tradeInputSchema, tradePreviewSchema, tradeUpdateSchema } from '../shared/schemas';
import type { StockEarnApi } from '../shared/types';
import type { BackupPayload, LedgerDatabase } from './database';
import type { MarketService } from './market';
import type { SecretStore } from './secrets';

type ApiGroups = keyof StockEarnApi;

function isTrusted(frame: WebFrameMain | null) {
  if (!frame) return false;
  const url = frame.url;
  return url.startsWith('file://') || url.startsWith('http://localhost:') || url.startsWith('https://localhost:');
}

export function registerIpc(db: LedgerDatabase, market: MarketService, secrets: SecretStore) {
  const handle = <T extends unknown[], R>(channel: `${ApiGroups}.${string}`, fn: (...args: T) => R | Promise<R>) => {
    ipcMain.handle(channel, async (event, ...args: T) => {
      if (!isTrusted(event.senderFrame)) throw new Error('拒绝不可信的窗口调用');
      return fn(...args);
    });
  };

  handle('settings.get', () => db.getSettings(secrets.hasApiKey()));
  handle('settings.update', (raw: unknown) => {
    const input = settingsUpdateSchema.parse(raw);
    if (input.apiKey !== undefined) secrets.setApiKey(input.apiKey);
    db.updateSettings(input);
    return db.getSettings(secrets.hasApiKey());
  });
  handle('settings.testQuoteProvider', (raw: unknown) => market.testApiKey(String(raw ?? '')));

  handle('platforms.list', (include = false) => db.listPlatforms(Boolean(include)));
  handle('platforms.create', (raw: unknown) => { const input = platformCreateSchema.parse(raw); return db.createPlatform(input.name); });
  handle('platforms.update', (raw: unknown) => { const input = platformUpdateSchema.parse(raw); return db.updatePlatform(input.id, input.name); });
  handle('platforms.archive', (raw: unknown) => { const input = archiveSchema.parse(raw); db.archivePlatform(input.id, input.archived); });

  handle('instruments.list', (include = false) => db.listInstruments(Boolean(include)));
  handle('instruments.add', (raw: unknown) => { const input = instrumentAddSchema.parse(raw); return db.addInstrument(input.symbol, input.name, input.exchange); });
  handle('instruments.update', (raw: unknown) => { const input = instrumentUpdateSchema.parse(raw); return db.updateInstrument(input.id, input.name, input.exchange); });
  handle('instruments.archive', (raw: unknown) => { const input = archiveSchema.parse(raw); db.archiveInstrument(input.id, input.archived); });
  handle('instruments.getDetail', (raw: unknown) => db.getInstrumentDetail(idSchema.parse(raw)));

  handle('trades.create', (raw: unknown) => db.createTrade(tradeInputSchema.parse(raw)));
  handle('trades.update', (raw: unknown) => { const input = tradeUpdateSchema.parse(raw); return db.updateTrade(input.id, input); });
  handle('trades.delete', (raw: unknown) => db.deleteTrade(idSchema.parse(raw)));
  handle('trades.list', (raw?: unknown) => db.getTradeResults(raw ? idSchema.parse(raw) : undefined));
  handle('trades.preview', (raw: unknown) => { const input = tradePreviewSchema.parse(raw); return db.preview(input, input.id); });
  handle('portfolio.getSummary', () => db.getPortfolioSummary());

  handle('market.getQuotes', (raw?: unknown) => db.getQuotes(Array.isArray(raw) ? raw.map((id) => idSchema.parse(id)) : undefined));
  handle('market.refreshQuotes', (raw?: unknown) => market.refreshQuotes(Array.isArray(raw) ? raw.map((id) => idSchema.parse(id)) : undefined));
  handle('market.getDailyBars', (raw: unknown) => db.getDailyBars(idSchema.parse(raw)));
  handle('market.syncDailyBars', (raw: unknown) => market.syncDailyBars(idSchema.parse(raw)));

  handle('backup.export', async () => {
    const result = await dialog.showSaveDialog({ title: '导出 Stock Earn 备份', defaultPath: `stock-earn-${new Date().toISOString().slice(0, 10)}.stockearn.json`, filters: [{ name: 'Stock Earn 备份', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return { path: null };
    writeFileSync(result.filePath, JSON.stringify(db.createBackup(), null, 2), 'utf8');
    return { path: result.filePath };
  });
  handle('backup.restore', async () => {
    const result = await dialog.showOpenDialog({ title: '恢复 Stock Earn 备份', properties: ['openFile'], filters: [{ name: 'Stock Earn 备份', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return { restored: false, path: null };
    const payload = JSON.parse(readFileSync(result.filePaths[0], 'utf8')) as BackupPayload;
    const backupDir = join(app.getPath('userData'), 'backups');
    mkdirSync(backupDir, { recursive: true });
    writeFileSync(join(backupDir, `before-restore-${Date.now()}.json`), JSON.stringify(db.createBackup(), null, 2), 'utf8');
    db.restoreBackup(payload);
    return { restored: true, path: result.filePaths[0] };
  });
}
