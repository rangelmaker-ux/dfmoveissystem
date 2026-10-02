const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('dfDesktop', {
  state: () => ipcRenderer.invoke('df:state'),
  retry: () => ipcRenderer.invoke('df:retry'),
  subscribe: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('df:status', listener);
    return () => ipcRenderer.removeListener('df:status', listener);
  },
});
