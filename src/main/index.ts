import { join } from 'node:path';
import { app, BrowserWindow, session } from 'electron';
import { LedgerDatabase } from './database';
import { registerIpc } from './ipc';
import { MarketService } from './market';
import { SecretStore } from './secrets';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let database: LedgerDatabase | null = null;
let market: MarketService | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1120, minHeight: 720,
    backgroundColor: '#F5F7FA',
    icon: join(__dirname, '../../resources/icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#F5F7FA', symbolColor: '#172132', height: 44 },
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL();
    if (current && new URL(url).origin !== new URL(current).origin) event.preventDefault();
  });
  mainWindow.on('focus', () => {
    if (!database || !market || !database.getSettings().initialized) return;
    const stale = database.getPortfolioSummary().instruments.filter((item) => !item.quote || item.quote.stale).map((item) => item.instrument.id);
    if (stale.length) void market.refreshQuotes(stale).catch(() => undefined);
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  database = new LedgerDatabase(join(app.getPath('userData'), 'stock-earn.db'));
  const secrets = new SecretStore(join(app.getPath('userData'), 'quote-key.bin'));
  market = new MarketService(database, secrets);
  registerIpc(database, market, secrets);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => database?.close());
