const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { query: sqliteQuery, logScan, getScanStats } = require('../config/sqlite');
const { setCache, getCache, deleteCache } = require('../config/redis');

class QRService {
  constructor() {
    this.defaultOptions = {
      errorCorrectionLevel: process.env.QR_CODE_ERROR_CORRECTION || 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: parseInt(process.env.QR_CODE_SIZE) || 200
    };
    
    // In-memory storage for degraded mode
    this.memoryStore = new Map();
  }

  async generateQR(data, options = {}) {
    try {
      const id = uuidv4();
      const qrOptions = { ...this.defaultOptions, ...options };
      
      // Generate QR code image
      const qrImageBuffer = await QRCode.toBuffer(data, qrOptions);
      const qrImageBase64 = qrImageBuffer.toString('base64');
      const qrImageUrl = `data:image/png;base64,${qrImageBase64}`;
      
      // Calculate expiration
      const expiryHours = parseInt(process.env.QR_CODE_EXPIRY_HOURS) || 24;
      const expiresAt = new Date(Date.now() + (expiryHours * 60 * 60 * 1000));
      
      let qrRecord = {
        id,
        data,
        qr_image_url: qrImageUrl,
        created_at: new Date(),
        expires_at: expiresAt,
        access_count: 0
      };

      // Try to store in database (SQLite first, then PostgreSQL fallback)
      try {
        const insertQuery = `
          INSERT INTO qr_codes (id, data, qr_image_url, expires_at, user_id, metadata)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const result = await sqliteQuery(insertQuery, [
          id,
          data,
          qrImageUrl,
          expiresAt.toISOString(),
          options.userId || null,
          JSON.stringify(options.metadata || {})
        ]);
        
        qrRecord = {
          id,
          data,
          qr_image_url: qrImageUrl,
          created_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          access_count: 0,
          user_id: options.userId || null,
          metadata: JSON.stringify(options.metadata || {}),
          is_active: 1
        };
        
        console.log(`✅ QR code ${id} stored in SQLite database`);
      } catch (sqliteError) {
        console.warn('SQLite storage failed, trying PostgreSQL:', sqliteError.message);
        
        try {
          const insertQuery = `
            INSERT INTO qr_codes (id, data, qr_image_url, expires_at, user_id, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
          `;
          
          const result = await query(insertQuery, [
            id,
            data,
            qrImageUrl,
            expiresAt,
            options.userId || null,
            JSON.stringify(options.metadata || {})
          ]);
          
          qrRecord = result.rows[0];
          console.log(`✅ QR code ${id} stored in PostgreSQL database`);
        } catch (pgError) {
          console.error('PostgreSQL storage also failed:', pgError.message);
          // Store in memory as final fallback
          this.memoryStore.set(id, qrRecord);
          console.log(`⚠️ QR code ${id} stored in memory (degraded mode)`);
          
          // In production, this should be an error
          if (process.env.NODE_ENV === 'production') {
            throw new Error('Database storage failed');
          }
        }
      }
      
      // Try to cache the QR code for fast retrieval
      try {
        const cacheKey = `qr:${id}`;
        await setCache(cacheKey, qrRecord, expiryHours * 3600);
        console.log(`QR code ${id} cached`);
      } catch (cacheError) {
        console.warn('Failed to cache QR code:', cacheError.message);
        // Continue without caching
      }
      
      return {
        id: qrRecord.id,
        data: qrRecord.data,
        qrImageUrl: qrRecord.qr_image_url,
        createdAt: qrRecord.created_at,
        expiresAt: qrRecord.expires_at,
        accessCount: qrRecord.access_count
      };
      
    } catch (error) {
      console.error('QR generation error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  async getQR(id, scannerInfo = {}) {
    try {
      let qrRecord = null;
      
      // Try cache first
      try {
        const cacheKey = `qr:${id}`;
        qrRecord = await getCache(cacheKey);
        if (qrRecord) {
          console.log(`📋 QR code ${id} retrieved from cache`);
        }
      } catch (cacheError) {
        console.warn('Cache retrieval failed:', cacheError.message);
      }
      
      if (!qrRecord) {
        // Try SQLite first
        try {
          const selectQuery = `
            SELECT * FROM qr_codes 
            WHERE id = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))
          `;
          
          const result = await sqliteQuery(selectQuery, [id]);
          
          if (result.rows.length > 0) {
            qrRecord = result.rows[0];
            console.log(`📋 QR code ${id} retrieved from SQLite database`);
          }
        } catch (sqliteError) {
          console.warn('SQLite retrieval failed, trying PostgreSQL:', sqliteError.message);
          
          // Fallback to PostgreSQL
          try {
            const selectQuery = `
              SELECT * FROM qr_codes 
              WHERE id = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())
            `;
            
            const result = await query(selectQuery, [id]);
            
            if (result.rows.length > 0) {
              qrRecord = result.rows[0];
              console.log(`📋 QR code ${id} retrieved from PostgreSQL database`);
            }
          } catch (pgError) {
            console.warn('PostgreSQL retrieval failed:', pgError.message);
          }
        }
        
        // Final fallback to memory store
        if (!qrRecord) {
          qrRecord = this.memoryStore.get(id);
          if (qrRecord) {
            console.log(`📋 QR code ${id} retrieved from memory`);
            // Check expiration
            if (qrRecord.expires_at && new Date(qrRecord.expires_at) < new Date()) {
              this.memoryStore.delete(id);
              throw new Error('QR code not found or expired');
            }
          }
        }
        
        if (!qrRecord) {
          throw new Error('QR code not found or expired');
        }
        
        // Try to cache for future requests
        try {
          const cacheKey = `qr:${id}`;
          const ttl = qrRecord.expires_at ? 
            Math.max(0, Math.floor((new Date(qrRecord.expires_at) - new Date()) / 1000)) : 
            3600;
          await setCache(cacheKey, qrRecord, ttl);
        } catch (cacheError) {
          console.warn('Failed to cache retrieved QR code:', cacheError.message);
        }
      }
      
      // Log the scan with detailed information
      try {
        await logScan(id, {
          ip: scannerInfo.ip,
          userAgent: scannerInfo.userAgent,
          location: scannerInfo.location,
          metadata: scannerInfo.metadata || {}
        });
      } catch (scanError) {
        console.warn('Failed to log scan:', scanError.message);
      }
      
      // Increment access count asynchronously (don't fail if this fails)
      this.incrementAccessCount(id).catch(err => 
        console.error('Failed to increment access count:', err.message)
      );
      
      return {
        id: qrRecord.id,
        data: qrRecord.data,
        qrImageUrl: qrRecord.qr_image_url,
        createdAt: qrRecord.created_at,
        expiresAt: qrRecord.expires_at,
        accessCount: qrRecord.access_count
      };
      
    } catch (error) {
      console.error('QR retrieval error:', error);
      throw error;
    }
  }

  async deleteQR(id, userId = null) {
    try {
      let deleted = false;
      
      // Try SQLite first
      try {
        const deleteQuery = userId ? 
          'UPDATE qr_codes SET is_active = 0 WHERE id = ? AND user_id = ?' :
          'UPDATE qr_codes SET is_active = 0 WHERE id = ?';
        
        const params = userId ? [id, userId] : [id];
        const result = await sqliteQuery(deleteQuery, params);
        
        if (result.rowCount > 0) {
          deleted = true;
          console.log(`✅ QR code ${id} deleted from SQLite database`);
        }
      } catch (sqliteError) {
        console.warn('SQLite deletion failed, trying PostgreSQL:', sqliteError.message);
        
        // Try PostgreSQL
        try {
          const deleteQuery = userId ? 
            'UPDATE qr_codes SET is_active = false WHERE id = $1 AND user_id = $2' :
            'UPDATE qr_codes SET is_active = false WHERE id = $1';
          
          const params = userId ? [id, userId] : [id];
          const result = await query(deleteQuery, params);
          
          if (result.rowCount > 0) {
            deleted = true;
            console.log(`✅ QR code ${id} deleted from PostgreSQL database`);
          }
        } catch (pgError) {
          console.warn('PostgreSQL deletion failed:', pgError.message);
        }
      }
      
      // Try memory store (for degraded mode)
      if (this.memoryStore.has(id)) {
        this.memoryStore.delete(id);
        deleted = true;
        console.log(`✅ QR code ${id} deleted from memory`);
      }
      
      if (!deleted) {
        throw new Error('QR code not found or access denied');
      }
      
      // Remove from cache
      try {
        const cacheKey = `qr:${id}`;
        await deleteCache(cacheKey);
      } catch (cacheError) {
        console.warn('Failed to delete from cache:', cacheError.message);
      }
      
      return true;
      
    } catch (error) {
      console.error('QR deletion error:', error);
      throw error;
    }
  }

  async incrementAccessCount(id) {
    try {
      // Try SQLite first
      try {
        const updateQuery = 'UPDATE qr_codes SET access_count = access_count + 1 WHERE id = ?';
        await sqliteQuery(updateQuery, [id]);
        console.log(`📊 Access count incremented for QR ${id} in SQLite database`);
      } catch (sqliteError) {
        console.warn('Failed to increment access count in SQLite, trying PostgreSQL:', sqliteError.message);
        
        // Try PostgreSQL
        try {
          const updateQuery = 'UPDATE qr_codes SET access_count = access_count + 1 WHERE id = $1';
          await query(updateQuery, [id]);
          console.log(`📊 Access count incremented for QR ${id} in PostgreSQL database`);
        } catch (pgError) {
          console.warn('Failed to increment access count in PostgreSQL, trying memory store:', pgError.message);
          
          // Try memory store
          if (this.memoryStore.has(id)) {
            const qrRecord = this.memoryStore.get(id);
            qrRecord.access_count = (qrRecord.access_count || 0) + 1;
            this.memoryStore.set(id, qrRecord);
            console.log(`📊 Access count incremented for QR ${id} in memory`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to increment access count:', error);
    }
  }

  async cleanupExpired() {
    try {
      let deletedCount = 0;
      
      // Try SQLite cleanup first
      try {
        const deleteQuery = "DELETE FROM qr_codes WHERE expires_at < datetime('now')";
        const result = await sqliteQuery(deleteQuery);
        deletedCount += result.rowCount || 0;
        console.log(`🧹 Cleaned up ${result.rowCount || 0} expired QR codes from SQLite database`);
      } catch (sqliteError) {
        console.warn('Failed to cleanup SQLite, trying PostgreSQL:', sqliteError.message);
        
        // Try PostgreSQL cleanup
        try {
          const deleteQuery = 'DELETE FROM qr_codes WHERE expires_at < NOW()';
          const result = await query(deleteQuery);
          deletedCount += result.rowCount || 0;
          console.log(`🧹 Cleaned up ${result.rowCount || 0} expired QR codes from PostgreSQL database`);
        } catch (pgError) {
          console.warn('Failed to cleanup PostgreSQL:', pgError.message);
        }
      }
      
      // Cleanup memory store
      const now = new Date();
      let memoryDeleted = 0;
      for (const [id, qrRecord] of this.memoryStore) {
        if (qrRecord.expires_at && new Date(qrRecord.expires_at) < now) {
          this.memoryStore.delete(id);
          memoryDeleted++;
        }
      }
      
      if (memoryDeleted > 0) {
        console.log(`🧹 Cleaned up ${memoryDeleted} expired QR codes from memory`);
        deletedCount += memoryDeleted;
      }
      
      if (deletedCount > 0) {
        console.log(`🧹 Total cleaned up: ${deletedCount} expired QR codes`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Cleanup error:', error);
      throw error;
    }
  }

  async getStats(userId = null) {
    try {
      // Try SQLite first
      try {
        const statsQuery = userId ?
          `SELECT 
            COUNT(*) as total_codes,
            COUNT(CASE WHEN expires_at > datetime('now') OR expires_at IS NULL THEN 1 END) as active_codes,
            SUM(access_count) as total_accesses
           FROM qr_codes WHERE user_id = ? AND is_active = 1` :
          `SELECT 
            COUNT(*) as total_codes,
            COUNT(CASE WHEN expires_at > datetime('now') OR expires_at IS NULL THEN 1 END) as active_codes,
            SUM(access_count) as total_accesses
           FROM qr_codes WHERE is_active = 1`;
        
        const params = userId ? [userId] : [];
        const result = await sqliteQuery(statsQuery, params);
        
        console.log('📊 SQLite stats result:', result.rows[0]);
        
        // Get scan statistics
        const scanStats = await getScanStats(null, userId);
        
        return {
          total_codes: (result.rows[0].total_codes || 0).toString(),
          active_codes: (result.rows[0].active_codes || 0).toString(),
          total_accesses: (result.rows[0].total_accesses || 0).toString(),
          total_scans: scanStats.total_scans.toString(),
          unique_scanners: scanStats.unique_scanners.toString(),
          scanned_codes: scanStats.scanned_codes.toString()
        };
      } catch (sqliteError) {
        console.warn('Failed to get stats from SQLite, trying PostgreSQL:', sqliteError.message);
        
        // Fallback to PostgreSQL
        try {
          const statsQuery = userId ?
            `SELECT 
              COUNT(*) as total_codes,
              COUNT(CASE WHEN expires_at > NOW() OR expires_at IS NULL THEN 1 END) as active_codes,
              SUM(access_count) as total_accesses
             FROM qr_codes WHERE user_id = $1 AND is_active = true` :
            `SELECT 
              COUNT(*) as total_codes,
              COUNT(CASE WHEN expires_at > NOW() OR expires_at IS NULL THEN 1 END) as active_codes,
              SUM(access_count) as total_accesses
             FROM qr_codes WHERE is_active = true`;
          
          const params = userId ? [userId] : [];
          const result = await query(statsQuery, params);
          
          return {
            total_codes: (result.rows[0].total_codes || 0).toString(),
            active_codes: (result.rows[0].active_codes || 0).toString(),
            total_accesses: (result.rows[0].total_accesses || 0).toString(),
            total_scans: '0',
            unique_scanners: '0',
            scanned_codes: '0'
          };
        } catch (pgError) {
          console.warn('Failed to get stats from PostgreSQL, using memory store:', pgError.message);
          
          // Final fallback to memory store stats
          let totalCodes = 0;
          let activeCodes = 0;
          let totalAccesses = 0;
          const now = new Date();
          
          for (const [id, qrRecord] of this.memoryStore) {
            // Filter by user if specified
            if (userId && qrRecord.user_id !== userId) {
              continue;
            }
            
            totalCodes++;
            
            // Check if active (not expired)
            if (!qrRecord.expires_at || new Date(qrRecord.expires_at) > now) {
              activeCodes++;
            }
            
            totalAccesses += qrRecord.access_count || 0;
          }
          
          return {
            total_codes: totalCodes.toString(),
            active_codes: activeCodes.toString(),
            total_accesses: totalAccesses.toString(),
            total_scans: '0',
            unique_scanners: '0',
            scanned_codes: '0'
          };
        }
      }
    } catch (error) {
      console.error('Stats error:', error);
      return {
        total_codes: '0',
        active_codes: '0',
        total_accesses: '0',
        total_scans: '0',
        unique_scanners: '0',
        scanned_codes: '0'
      };
    }
  }
}

module.exports = new QRService();