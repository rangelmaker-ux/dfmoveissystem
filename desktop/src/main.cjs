const { app, BrowserWindow, WebContentsView, Menu, ipcMain, shell, net } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { SITE_ORIGIN, isAppUrl, isDocumentUrl, parseRelease, needsUpdate } = require('./update-policy.cjs');
const SHELL_FILE = path.join(__dirname, 'shell.html');
const SHELL_URL = pathToFileURL(SHELL_FILE).href;
const PARTITION = 'persist:df-moveis';
let win, view, installed, latest, starting = false;
let layout = () => {};
let nativeAvailable = false, nativeDownloaded = false;
const state = { message: 'Conectando à loja…', loading: true, progress: null, busy: false, offline: false, nativeVersion: app.getVersion(), loadFailed: false };
const statePath = () => path.join(app.getPath('userData'), 'system-version.json');
function emit(patch = {}) {
  Object.assign(state, patch);
  layout();
  if (win && !win.isDestroyed()) win.webContents.send('df:status', state);
}
function remember(revision) {
  fs.writeFileSync(statePath(), JSON.stringify({ revision }), { mode: 0o600 });
  installed = revision;
}
async function checkUpdates() {
  latest = null;
  try {
    const response = await net.fetch(`${SITE_ORIGIN}/desktop-release.json?check=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000),
    });
    if (response.ok) latest = parseRelease(await response.json());
  } catch { /* The site may still be reachable when the manifest is unavailable. */ }
}
function external(url) {
  try { if (new URL(url).protocol === 'https:') void shell.openExternal(url); } catch { /* Ignore unsupported URLs. */ }
}
function restrict(contents, allowDocuments = false) {
  contents.on('will-navigate', (event, url) => {
    if (isAppUrl(url) || (allowDocuments && isDocumentUrl(url))) return;
    event.preventDefault();
    external(url);
  });
  contents.on('will-redirect', (event, url) => {
    if (!isAppUrl(url) && !(allowDocuments && isDocumentUrl(url))) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || isDocumentUrl(url)) return {
      action: 'allow', overrideBrowserWindowOptions: {
        title: 'DF Móveis · Documento', autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, partition: PARTITION },
      },
    };
    external(url);
    return { action: 'deny' };
  });
  contents.on('did-create-window', child => restrict(child.webContents, true));
}
async function loadSite() {
  emit({ loading: true, message: 'Abrindo o sistema…', progress: 90, offline: false, loadFailed: false });
  try { await view.webContents.loadURL(SITE_ORIGIN); }
  catch { emit({ loading: false, busy: false, offline: true, loadFailed: true, message: 'Verifique a internet e tente novamente.' }); }
}
function validateSender(event) {
  if (!win || event.sender !== win.webContents || event.senderFrame?.url !== SHELL_URL) throw new Error('Ação não autorizada.');
}
function configureNativeUpdates() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.on('update-available', () => { nativeAvailable = true; });
  autoUpdater.on('download-progress', info => {
    if (starting) emit({ message: 'Atualizando…', progress: Math.max(0, Math.min(100, info.percent)) });
  });
  autoUpdater.on('update-downloaded', () => {
    if (!starting) return;
    nativeDownloaded = true;
    emit({ message: 'Concluindo atualização…', progress: 100 });
    autoUpdater.quitAndInstall(true, true);
  });
  autoUpdater.on('error', () => { /* Startup continues with the installed version if the channel is unavailable. */ });
}
async function startSystem() {
  if (starting) return state;
  starting = true;
  nativeAvailable = false;
  nativeDownloaded = false;
  emit({ loading: true, busy: true, loadFailed: false, offline: false, progress: null, message: 'Verificando atualizações…' });
  try {
    await checkUpdates();
    if (app.isPackaged) {
      try {
        await autoUpdater.checkForUpdates();
        if (nativeAvailable) {
          emit({ message: 'Atualizando…', progress: 0 });
          await autoUpdater.downloadUpdate();
          if (nativeDownloaded) return state;
        }
      } catch { /* Preserve access when downloading a native update fails. Retry on the next opening. */ }
    }
    if (latest && needsUpdate(installed, latest.revision)) {
      emit({ message: 'Atualizando…', progress: 50 });
      // Preserve cookies, local storage, and the user's login.
      await view.webContents.session.clearCache();
      await view.webContents.session.clearStorageData({ origin: SITE_ORIGIN, storages: ['serviceworkers', 'cachestorage'] });
    }
    await loadSite();
  } catch {
    emit({ loading: false, busy: false, loadFailed: true, message: 'Não foi possível abrir o sistema. Tente novamente.' });
  } finally { starting = false; }
  return state;
}
function createWindow() {
  try { installed = JSON.parse(fs.readFileSync(statePath(), 'utf8')).revision; } catch { installed = null; }
  win = new BrowserWindow({ width: 1360, height: 900, minWidth: 900, minHeight: 600,
    title: 'DF Móveis Planejados', icon: path.join(__dirname, '../build/icon.png'), backgroundColor: '#191c21',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  view = new WebContentsView({ webPreferences: { partition: PARTITION, nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false } });
  win.contentView.addChildView(view);
  layout = () => {
    if (!win || win.isDestroyed()) return;
    const [width, height] = win.getContentSize();
    view.setBounds({ x: 0, y: 0, width, height });
    view.setVisible(!state.loading && !state.busy && !state.loadFailed);
  };
  win.on('resize', layout); layout();
  restrict(view.webContents);
  view.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  view.webContents.on('did-finish-load', () => {
    if (latest && isAppUrl(view.webContents.getURL())) remember(latest.revision);
    emit({ loading: false, busy: false, progress: 100, offline: false, loadFailed: false });
  });
  view.webContents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
    if (mainFrame && code !== -3) emit({ loading: false, busy: false, offline: true, loadFailed: true, message: 'Não foi possível abrir a loja. Clique em Tentar novamente.' });
  });
  win.on('closed', () => { if (!view.webContents.isDestroyed()) view.webContents.close(); win = null; });
  void win.loadFile(SHELL_FILE).then(() => emit());
  void startSystem();
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    app.setAppUserModelId('br.com.dfmoveis.sistema');
    configureNativeUpdates();
    for (const [name, action] of Object.entries({ state: () => state, retry: startSystem })) {
      ipcMain.handle(`df:${name}`, (event) => { validateSender(event); return action(); });
    }
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
