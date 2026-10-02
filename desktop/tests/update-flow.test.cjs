const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');
const policy = require('../src/update-policy.cjs');

for (const packaged of [false, true]) test(`abertura ${packaged ? 'nativa' : 'web'} atualiza sem aviso; preserva login e recusa IPC remoto`, async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'df-update-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'system-version.json'), JSON.stringify({ revision: 'c'.repeat(40) }));
  let revision = 'a'.repeat(40), restarted = false, exitCode, manifestOffline = false;
  const clearCalls = [], handlers = new Map(), statuses = [];
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => { updater.emit('update-available', { version: '1.0.4' }); };
  updater.downloadUpdate = async () => null;
  let nativeInstall;
  updater.quitAndInstall = (...args) => { nativeInstall = args; };
  updater.downloadUpdate = async () => { updater.emit('download-progress', { percent: 45 }); updater.emit('update-downloaded'); };
  class Contents extends EventEmitter {
    constructor() {
      super(); this.url = '';
      this.session = { clearCache: async () => clearCalls.push('cache'), clearStorageData: async args => clearCalls.push(args), setPermissionRequestHandler() {} };
    }
    async loadURL(url) { this.url = url; this.emit('did-finish-load'); }
    getURL() { return this.url; }
    isLoadingMainFrame() { return false; }
    setWindowOpenHandler() {}
    isDestroyed() { return false; }
    close() {}
    send(_channel, state) { statuses.push({ ...state }); }
  }
  let windowInstance, viewInstance;
  class Window extends EventEmitter {
    constructor(options) { super(); this.options = options; this.webContents = new Contents(); this.contentView = { addChildView() {} }; windowInstance = this; }
    getContentSize() { return [1360, 900]; }
    isDestroyed() { return false; }
    async loadFile(file) { this.webContents.url = pathToFileURL(file).href; }
  }
  class View { constructor(options) { this.options = options; this.webContents = new Contents(); viewInstance = this; } setBounds(value) { this.bounds = value; } setVisible(value) { this.visible = value; } }
  const app = Object.assign(new EventEmitter(), {
    isPackaged: packaged, getVersion: () => '1.0.0', getPath: () => directory,
    requestSingleInstanceLock: () => true, whenReady: async () => {},
    setAppUserModelId() {}, relaunch: () => { restarted = true; }, exit: code => { exitCode = code; }, quit() {},
  });
  const electron = {
    app, BrowserWindow: Window, WebContentsView: View, Menu: { setApplicationMenu() {} },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    dialog: { showMessageBox: async () => { throw new Error('No confirmation allowed'); } }, shell: { openExternal: async () => {} },
    net: { fetch: async () => {
      if (manifestOffline) throw new Error('Offline');
      return { ok: true, json: async () => ({ schema: 1, revision, publishedAt: new Date().toISOString() }) };
    } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main.cjs'), 'utf8'), {
    require: name => name === 'electron' ? electron : name === 'electron-updater' ? { autoUpdater: updater } : name === './update-policy.cjs' ? policy : require(name),
    __dirname: path.resolve(__dirname, '../src'), setInterval: () => { throw new Error('No periodic update checks allowed'); }, clearInterval() {},
    AbortSignal,
  });
  await new Promise(resolve => setImmediate(resolve));
  const event = { sender: windowInstance.webContents, senderFrame: { url: windowInstance.webContents.url } };
  assert.equal(viewInstance.options.webPreferences.nodeIntegration, false);
  assert.equal(viewInstance.options.webPreferences.contextIsolation, true);
  assert.equal(viewInstance.options.webPreferences.sandbox, true);
  assert.equal(viewInstance.bounds.y, 0);
  assert.equal(viewInstance.bounds.height, 900);
  assert.equal(handlers.has('df:install'), false);
  assert.equal(handlers.has('df:check'), false);
  assert.throws(() => handlers.get('df:retry')({ sender: viewInstance.webContents, senderFrame: { url: policy.SITE_ORIGIN } }));
  assert.equal(statuses.some(state => /disponível|Instalar atualizações/.test(state.message)), false);
  assert.equal(restarted, false);
  assert.equal(exitCode, undefined);
  if (packaged) {
    assert.equal(viewInstance.visible, false);
    assert.deepEqual(nativeInstall, [true, true]);
    assert.equal(statuses.some(state => state.progress === 45), true);
    assert.equal(viewInstance.webContents.getURL(), '');
    assert.equal(updater.autoRunAppAfterInstall, true);
    assert.equal(updater.autoInstallOnAppQuit, false);
    return;
  }
  assert.equal(viewInstance.visible, true);
  assert.equal(clearCalls[0], 'cache');
  assert.equal(clearCalls[1].storages.join(','), 'serviceworkers,cachestorage');
  assert.equal(clearCalls[1].origin, policy.SITE_ORIGIN);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'system-version.json'))).revision, revision);
  const statusCount = statuses.length;
  revision = 'b'.repeat(40);
  assert.equal(statuses.length, statusCount, 'An active session must not announce or apply updates');
  manifestOffline = true;
  viewInstance.webContents.emit('did-fail-load', {}, -105, 'Offline', policy.SITE_ORIGIN, true);
  assert.equal(viewInstance.visible, false);
  await handlers.get('df:retry')(event);
  assert.equal(viewInstance.visible, true, 'The site can open even if its version manifest is unavailable');
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'system-version.json'))).revision, 'a'.repeat(40));
  manifestOffline = false;
  await handlers.get('df:retry')(event);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'system-version.json'))).revision, revision);
});
