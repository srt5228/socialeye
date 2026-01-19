const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle photo directory selection
ipcMain.handle('select-photo-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Photos Directory',
    buttonLabel: 'Select Folder'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Handle loading photos from a directory
ipcMain.handle('load-photos', async (event, directoryPath) => {
  try {
    const files = await fs.readdir(directoryPath);

    // Filter for image files
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic'];
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });

    // Get full paths and stats for each image
    const photos = await Promise.all(
      imageFiles.map(async (file) => {
        const fullPath = path.join(directoryPath, file);
        const stats = await fs.stat(fullPath);
        return {
          name: file,
          path: fullPath,
          size: stats.size,
          modified: stats.mtime
        };
      })
    );

    return photos;
  } catch (error) {
    console.error('Error loading photos:', error);
    throw error;
  }
});

// Handle reading a photo file as base64
ipcMain.handle('read-photo', async (event, photoPath) => {
  try {
    const data = await fs.readFile(photoPath);
    const base64 = data.toString('base64');
    const ext = path.extname(photoPath).toLowerCase();

    // Determine MIME type
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.heic': 'image/heic'
    };

    const mimeType = mimeTypes[ext] || 'image/jpeg';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error reading photo:', error);
    throw error;
  }
});
