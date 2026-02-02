const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

const dbPath = path.join(__dirname, '../../data/qr_system.db');

async function connectSQLite() {
  return new Promise((resolve, reject) => {
    // Create data directory if it doesn't exist
    const fs = require('fs');
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('SQLite connection failed:', err);
        reject(err);
      } else {
        console.log('✅ SQLite database connected successfully');
        console.log(`📁 Database location: ${dbPath}`);
        createTables().then(resolve).catch(reject);
      }
    });
  });
}

async function createTables() {
  return new Promise((resolve, reject) => {
    const createQRCodesTable = `
      CREATE TABLE IF NOT EXISTS qr_codes (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        qr_image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        access_count INTEGER DEFAULT 0,
        user_id TEXT,
        metadata TEXT DEFAULT '{}',
        is_active BOOLEAN DEFAULT 1
      )
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_qr_codes_expires_at ON qr_codes(expires_at);
      CREATE INDEX IF NOT EXISTS idx_qr_codes_user_id ON qr_codes(user_id);
      CREATE INDEX IF NOT EXISTS idx_qr_codes_created_at ON qr_codes(created_at);
      CREATE INDEX IF NOT EXISTS idx_qr_codes_is_active ON qr_codes(is_active);
    `;

    const createScanLogsTable = `
      CREATE TABLE IF NOT EXISTS qr_scan_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qr_id TEXT NOT NULL,
        scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        scanner_ip TEXT,
        scanner_user_agent TEXT,
        scanner_location TEXT,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (qr_id) REFERENCES qr_codes (id)
      )
    `;

    const createScanIndexes = `
      CREATE INDEX IF NOT EXISTS idx_scan_logs_qr_id ON qr_scan_logs(qr_id);
      CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at ON qr_scan_logs(scanned_at);
      CREATE INDEX IF NOT EXISTS idx_scan_logs_scanner_ip ON qr_scan_logs(scanner_ip);
    `;

    db.exec(createQRCodesTable, (err) => {
      if (err) {
        console.error('Error creating qr_codes table:', err);
        reject(err);
        return;
      }

      db.exec(createIndexes, (err) => {
        if (err) {
          console.error('Error creating indexes:', err);
          reject(err);
          return;
        }

        db.exec(createScanLogsTable, (err) => {
          if (err) {
            console.error('Error creating scan_logs table:', err);
            reject(err);
            return;
          }

          db.exec(createScanIndexes, (err) => {
            if (err) {
              console.error('Error creating scan indexes:', err);
              reject(err);
              return;
            }

            console.log('✅ Database tables and indexes created successfully');
            resolve();
          });
        });
      });
    });
  });
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

async function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          resolve({ rows });
        }
      });
    } else {
      db.run(sql, params, function(err) {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          resolve({ 
            rowCount: this.changes,
            lastID: this.lastID,
            rows: []
          });
        }
      });
    }
  });
}

// Log QR code scan
async function logScan(qrId, scannerInfo = {}) {
  try {
    const insertScanLog = `
      INSERT INTO qr_scan_logs (qr_id, scanner_ip, scanner_user_agent, scanner_location, metadata)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await query(insertScanLog, [
      qrId,
      scannerInfo.ip || null,
      scannerInfo.userAgent || null,
      scannerInfo.location || null,
      JSON.stringify(scannerInfo.metadata || {})
    ]);
    
    console.log(`📊 Scan logged for QR: ${qrId}`);
    return true;
  } catch (error) {
    console.error('Failed to log scan:', error);
    return false;
  }
}

// Get scan statistics
async function getScanStats(qrId = null, userId = null) {
  try {
    let sql = `
      SELECT 
        COUNT(DISTINCT s.qr_id) as scanned_codes,
        COUNT(s.id) as total_scans,
        COUNT(DISTINCT s.scanner_ip) as unique_scanners
      FROM qr_scan_logs s
      JOIN qr_codes q ON s.qr_id = q.id
      WHERE q.is_active = 1
    `;
    
    const params = [];
    
    if (qrId) {
      sql += ' AND s.qr_id = ?';
      params.push(qrId);
    }
    
    if (userId) {
      sql += ' AND q.user_id = ?';
      params.push(userId);
    }
    
    const result = await query(sql, params);
    return result.rows[0] || { scanned_codes: 0, total_scans: 0, unique_scanners: 0 };
  } catch (error) {
    console.error('Failed to get scan stats:', error);
    return { scanned_codes: 0, total_scans: 0, unique_scanners: 0 };
  }
}

module.exports = {
  connectSQLite,
  getDatabase,
  query,
  logScan,
  getScanStats
};