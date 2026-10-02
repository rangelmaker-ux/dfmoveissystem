const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');
const policy = require('../src/update-policy.cjs');
const startupPolicy = require('../src/startup-policy.cjs');

test('atualização web pede confirmação, preserva login e reinicia; IPC remoto é recusado', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'df-update-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let revision = 'a'.repeat(40), restarted = false, exitCode, finishIntro;
  const clearCalls = [], handlers = new Map(), statuses = [];
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => null;
  updater.downloadUpdate = async () => null;
  updater.quitAndInstall = () => {};
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
  class View { constructor(options) { this.options = options; this.webContents = new Contents(); viewInstance = this; } setBounds() {} setVisible(value) { this.visible = value; } }
  const app = Object.assign(new EventEmitter(), {
    isPackaged: false, getVersion: () => '1.0.0', getPath: () => directory,
    requestSingleInstanceLock: () => true, whenReady: async () => {},
    setAppUserModelId() {}, relaunch: () => { restarted = true; }, exit: code => { exitCode = code; }, quit() {},
  });
  const electron = {
    app, BrowserWindow: Window, WebContentsView: View, Menu: { setApplicationMenu() {} },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    dialog: { showMessageBox: async () => ({ response: 0 }) }, shell: { openExternal: async () => {} },
    net: { fetch: async () => ({ ok: true, json: async () => ({ schema: 1, revision, publishedAt: new Date().toISOString() }) }) },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main.cjs'), 'utf8'), {
    require: name => name === 'electron' ? electron : name === 'electron-updater' ? { autoUpdater: updater } : name === './update-policy.cjs' ? policy : name === './startup-policy.cjs' ? startupPolicy : require(name),
    __dirname: path.resolve(__dirname, '../src'), setInterval: () => 1, clearInterval() {},
    setTimeout: (callback, delay) => { assert.equal(delay, 2000); finishIntro = callback; return 2; }, clearTimeout() {}, AbortSignal,
  });
  await new Promise(resolve => setImmediate(resolve));
  const event = { sender: windowInstance.webContents, senderFrame: { url: windowInstance.webContents.url } };
  assert.equal(viewInstance.options.webPreferences.nodeIntegration, false);
  assert.equal(viewInstance.options.webPreferences.contextIsolation, true);
  assert.equal(viewInstance.options.webPreferences.sandbox, true);
  assert.equal(viewInstance.visible, false);
  assert.equal(statuses.some(state => state.intro === true), true);
  finishIntro();
  assert.equal(viewInstance.visible, true);
  const startupFile = path.join(directory, 'startup-state.json');
  assert.equal(startupPolicy.shouldShowIntro(JSON.parse(fs.readFileSync(startupFile)), app.getVersion()), false);
  assert.equal(fs.existsSync(path.join(directory, 'system-version.json')), true);
  assert.throws(() => handlers.get('df:install')({ sender: viewInstance.webContents, senderFrame: { url: policy.SITE_ORIGIN } }));
  revision = 'b'.repeat(40);
  assert.equal((await handlers.get('df:check')(event)).update, true);
  await handlers.get('df:install')(event);
  assert.equal(restarted, true);
  assert.equal(exitCode, 0);
  assert.deepEqual(clearCalls[1].storages.join(','), 'serviceworkers,cachestorage');
  assert.equal(clearCalls[1].origin, policy.SITE_ORIGIN);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'system-version.json'))).revision, revision);
  assert.equal(startupPolicy.shouldShowIntro(JSON.parse(fs.readFileSync(startupFile)), app.getVersion()), true);
  assert.equal(statuses.some(state => state.message === 'Nova atualização disponível'), true);
});
