const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const PhotosLibrary = require('./photosLibrary');

let mainWindow;
let photosLibrary = null;

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

// Check if macOS Photos library is available
ipcMain.handle('check-photos-library', async () => {
  return PhotosLibrary.isAvailable();
});

// Load photos from macOS Photos library
ipcMain.handle('load-photos-library', async (event, limit = 100, offset = 0) => {
  try {
    if (!photosLibrary) {
      photosLibrary = new PhotosLibrary();
      photosLibrary.connect();
    }

    const photos = photosLibrary.getPhotos(limit, offset);
    const count = photosLibrary.getPhotoCount();

    // Get actual file paths for photos
    const photosWithPaths = photos.map(photo => {
      const photoPath = photosLibrary.getPhotoPath(photo);
      return {
        name: photo.name,
        path: photoPath,
        size: 0, // Size will be read when needed
        modified: photo.dateCreated || photo.modificationDate,
        width: photo.width,
        height: photo.height,
        uuid: photo.uuid
      };
    }).filter(photo => photo.path !== null); // Filter out photos we can't find

    return {
      photos: photosWithPaths,
      total: count,
      limit,
      offset
    };
  } catch (error) {
    console.error('Error loading Photos library:', error);
    throw error;
  }
});

// Clean up on app quit
app.on('before-quit', () => {
  if (photosLibrary) {
    photosLibrary.close();
  }
});
