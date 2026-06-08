const { ipcRenderer } = require('electron');
window._cngmBbs = {
    minimize: () => ipcRenderer.send('bbs-minimize'),
    close:    () => window.close()
};
