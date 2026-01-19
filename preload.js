const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectPhotoDirectory: () => ipcRenderer.invoke('select-photo-directory'),
  loadPhotos: (directoryPath) => ipcRenderer.invoke('load-photos', directoryPath),
  readPhoto: (photoPath) => ipcRenderer.invoke('read-photo', photoPath)
});
