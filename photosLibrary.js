const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

class PhotosLibrary {
  constructor() {
    this.db = null;
    this.libraryPath = null;
  }

  // Find the default Photos library location on macOS
  findPhotosLibrary() {
    if (process.platform !== 'darwin') {
      return null;
    }

    const homeDir = os.homedir();
    const possiblePaths = [
      path.join(homeDir, 'Pictures', 'Photos Library.photoslibrary'),
      path.join(homeDir, 'Pictures', 'Photos.photoslibrary')
    ];

    for (const libPath of possiblePaths) {
      if (fs.existsSync(libPath)) {
        return libPath;
      }
    }

    return null;
  }

  // Connect to the Photos database
  connect() {
    this.libraryPath = this.findPhotosLibrary();

    if (!this.libraryPath) {
      throw new Error('Photos library not found');
    }

    const dbPath = path.join(this.libraryPath, 'database', 'photos.db');

    if (!fs.existsSync(dbPath)) {
      throw new Error('Photos database not found at: ' + dbPath);
    }

    try {
      this.db = new Database(dbPath, { readonly: true, fileMustExist: true });
      return true;
    } catch (error) {
      throw new Error('Failed to open Photos database: ' + error.message);
    }
  }

  // Get all photos from the library
  getPhotos(limit = 100, offset = 0) {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        SELECT
          ZASSET.Z_PK as id,
          ZASSET.ZFILENAME as filename,
          ZASSET.ZDIRECTORY as directory,
          ZASSET.ZUUID as uuid,
          ZASSET.ZADDEDDATE as addedDate,
          ZASSET.ZDATECREATED as dateCreated,
          ZASSET.ZMODIFICATIONDATE as modificationDate,
          ZASSET.ZWIDTH as width,
          ZASSET.ZHEIGHT as height,
          ZASSET.ZKIND as kind
        FROM ZASSET
        WHERE ZASSET.ZTRASHEDSTATE = 0
          AND ZASSET.ZKIND = 0
        ORDER BY ZASSET.ZDATECREATED DESC
        LIMIT ? OFFSET ?
      `;

      const rows = this.db.prepare(query).all(limit, offset);

      return rows.map(row => this.mapPhotoRow(row));
    } catch (error) {
      console.error('Error querying photos:', error);
      throw new Error('Failed to query photos: ' + error.message);
    }
  }

  // Get total photo count
  getPhotoCount() {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      const query = `
        SELECT COUNT(*) as count
        FROM ZASSET
        WHERE ZASSET.ZTRASHEDSTATE = 0
          AND ZASSET.ZKIND = 0
      `;

      const result = this.db.prepare(query).get();
      return result.count;
    } catch (error) {
      throw new Error('Failed to count photos: ' + error.message);
    }
  }

  // Get the actual file path for a photo
  getPhotoPath(photo) {
    if (!this.libraryPath) {
      return null;
    }

    // Photos are stored in Masters directory with a specific structure
    const mastersPath = path.join(this.libraryPath, 'originals');

    if (photo.directory && photo.filename) {
      const fullPath = path.join(mastersPath, photo.directory, photo.filename);

      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    // Try alternative path structure (newer Photos versions)
    if (photo.uuid && photo.filename) {
      const uuidPath = photo.uuid.split('-')[0];
      const altPath = path.join(mastersPath, uuidPath, photo.filename);

      if (fs.existsSync(altPath)) {
        return altPath;
      }
    }

    return null;
  }

  // Map database row to photo object
  mapPhotoRow(row) {
    return {
      id: row.id,
      name: row.filename || 'Unknown',
      uuid: row.uuid,
      directory: row.directory,
      filename: row.filename,
      width: row.width,
      height: row.height,
      addedDate: this.convertAppleDate(row.addedDate),
      dateCreated: this.convertAppleDate(row.dateCreated),
      modificationDate: this.convertAppleDate(row.modificationDate),
      kind: row.kind
    };
  }

  // Convert Apple's date format (seconds since 2001-01-01) to JavaScript Date
  convertAppleDate(appleDate) {
    if (!appleDate) return null;
    const referenceDate = new Date('2001-01-01T00:00:00Z');
    return new Date(referenceDate.getTime() + appleDate * 1000);
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Check if Photos library is available
  static isAvailable() {
    if (process.platform !== 'darwin') {
      return false;
    }

    const library = new PhotosLibrary();
    const libraryPath = library.findPhotosLibrary();
    return libraryPath !== null;
  }
}

module.exports = PhotosLibrary;
