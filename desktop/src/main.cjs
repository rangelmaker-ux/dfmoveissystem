const { app, BrowserWindow, WebContentsView, Menu, ipcMain, dialog, shell, net } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { SITE_ORIGIN, isAppUrl, isDocumentUrl, parseRelease, needsUpdate } = require('./update-policy.cjs');
const { shouldShowIntro } = require('./startup-policy.cjs');
const SHELL_FILE = path.join(__dirname, 'shell.html');
const SHELL_URL = pathToFileURL(SHELL_FILE).href;
const PARTITION = 'persist:df-moveis';
let win, view, installed, latest, checking = false, interval;
let introTimer, startup = {};
let nativeAvailable = false, nativeDownloaded = false;
const state = { message: 'Conectando à loja…', update: false, busy: false, offline: false, nativeVersion: app.getVersion(), intro: false };
const statePath = () => path.join(app.getPath('userData'), 'system-version.json');
const startupPath = () => path.join(app.getPath('userData'), 'startup-state.json');
function rememberStartup(patch) {
  startup = { ...startup, ...patch };
  try { fs.writeFileSync(startupPath(), JSON.stringify(startup), { mode: 0o600 }); }
  catch { /* A read-only profile must not prevent opening the system. */ }
}
function emit(patch = {}) {
  Object.assign(state, patch);
  if (win && !win.isDestroyed()) win.webContents.send('df:status', state);
}
function remember(revision) {
  fs.writeFileSync(statePath(), JSON.stringify({ revision }), { mode: 0o600 });
  installed = revision;
}
async function checkUpdates() {
  if (checking) return state;
  checking = true;
  try {
    const response = await net.fetch(`${SITE_ORIGIN}/desktop-release.json?check=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Não foi possível verificar a versão.');
    latest = parseRelease(await response.json());
    if (!installed && view && !view.webContents.isLoadingMainFrame() && isAppUrl(view.webContents.getURL())) remember(latest.revision);
    const update = nativeAvailable || needsUpdate(installed, latest.revision);
    emit({ offline: false, update, message: update ? 'Nova atualização disponível' : 'Sistema atualizado' });
  } catch {
    emit({ offline: true, message: 'Sem conexão. Verifique a internet e tente novamente.' });
  } finally { checking = false; }
  return state;
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
  emit({ message: 'Conectando à loja…', offline: false });
  try { await view.webContents.loadURL(SITE_ORIGIN); }
  catch { emit({ offline: true, message: 'Não foi possível abrir a loja. Verifique a internet.' }); }
}
function validateSender(event) {
  if (!win || event.sender !== win.webContents || event.senderFrame?.url !== SHELL_URL) throw new Error('Ação não autorizada.');
}
function configureNativeUpdates() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('update-available', info => {
    nativeAvailable = true;
    emit({ update: true, message: `Nova versão Windows ${info.version} disponível` });
  });
  autoUpdater.on('download-progress', info => emit({ busy: true, message: `Instalando atualização: ${Math.round(info.percent)}%` }));
  autoUpdater.on('update-downloaded', () => { nativeDownloaded = true; autoUpdater.quitAndInstall(false, true); });
  autoUpdater.on('error', () => {
    if (state.busy) emit({ busy: false, message: 'Não foi possível baixar a atualização. Tente novamente.' });
  });
}
async function installUpdate() {
  if (state.busy || !state.update) return state;
  const result = await dialog.showMessageBox(win, {
    type: 'question', title: 'Atualizar DF Móveis', message: 'Instalar atualização e reiniciar?',
    detail: 'Salve o que estiver editando antes de continuar.', buttons: ['Instalar e reiniciar', 'Agora não'], defaultId: 0, cancelId: 1,
  });
  if (result.response !== 0) return state;
  emit({ busy: true, message: 'Instalando atualização…' });
  try {
    if (nativeDownloaded) autoUpdater.quitAndInstall(false, true);
    else if (nativeAvailable) await autoUpdater.downloadUpdate();
    else {
      // Clear cached application files while preserving the user's login and data.
      await view.webContents.session.clearCache();
      await view.webContents.session.clearStorageData({ origin: SITE_ORIGIN, storages: ['serviceworkers', 'cachestorage'] });
      if (latest) remember(latest.revision);
      rememberStartup({ pendingUpdate: true });
      app.relaunch(); app.exit(0);
    }
  } catch { emit({ busy: false, message: 'Atualização não concluída. Tente novamente.' }); }
  return state;
}
function createWindow() {
  try { installed = JSON.parse(fs.readFileSync(statePath(), 'utf8')).revision; } catch { installed = null; }
  try { startup = JSON.parse(fs.readFileSync(startupPath(), 'utf8')) || {}; } catch { startup = {}; }
  state.intro = shouldShowIntro(startup, app.getVersion());
  win = new BrowserWindow({ width: 1360, height: 900, minWidth: 900, minHeight: 600,
    title: 'DF Móveis Planejados', icon: path.join(__dirname, '../build/icon.png'), backgroundColor: '#191c21',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  view = new WebContentsView({ webPreferences: { partition: PARTITION, nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false } });
  win.contentView.addChildView(view);
  view.setVisible(!state.intro);
  const layout = () => { const [width, height] = win.getContentSize(); view.setBounds({ x: 0, y: 64, width, height: Math.max(0, height - 64) }); };
  win.on('resize', layout); layout();
  restrict(view.webContents);
  view.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  view.webContents.on('did-finish-load', () => {
    if (!installed && latest && isAppUrl(view.webContents.getURL())) remember(latest.revision);
    emit({ offline: false });
    void checkUpdates();
  });
  view.webContents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
    if (mainFrame && code !== -3) emit({ offline: true, message: 'Não foi possível abrir a loja. Clique em Tentar novamente.' });
  });
  win.on('closed', () => { clearInterval(interval); clearTimeout(introTimer); if (!view.webContents.isDestroyed()) view.webContents.close(); win = null; });
  void win.loadFile(SHELL_FILE).then(() => {
    emit();
    if (state.intro) introTimer = setTimeout(() => {
      if (!win || win.isDestroyed()) return;
      rememberStartup({ version: app.getVersion(), pendingUpdate: false });
      emit({ intro: false });
      view.setVisible(true);
    }, 2000);
  });
  void loadSite();
  void checkUpdates();
  if (app.isPackaged) void autoUpdater.checkForUpdates().catch(() => {});
  interval = setInterval(() => {
    void checkUpdates();
    if (app.isPackaged && !state.busy) void autoUpdater.checkForUpdates().catch(() => {});
  }, 300000);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    app.setAppUserModelId('br.com.dfmoveis.sistema');
    configureNativeUpdates();
    for (const [name, action] of Object.entries({ state: () => state, check: checkUpdates, install: installUpdate, retry: async () => { await loadSite(); return checkUpdates(); } })) {
      ipcMain.handle(`df:${name}`, (event) => { validateSender(event); return action(); });
    }
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
