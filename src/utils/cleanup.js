const cron = require('node-cron');
const qrService = require('../services/qrService');

class CleanupService {
  constructor() {
    this.isRunning = false;
  }

  start() {
    // Run cleanup every hour
    cron.schedule('0 * * * *', async () => {
      if (this.isRunning) {
        console.log('Cleanup already running, skipping...');
        return;
      }

      this.isRunning = true;
      try {
        console.log('Starting cleanup of expired QR codes...');
        const deletedCount = await qrService.cleanupExpired();
        console.log(`Cleanup completed. Deleted ${deletedCount} expired QR codes.`);
      } catch (error) {
        console.error('Cleanup failed:', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('Cleanup service started');
  }

  async runOnce() {
    if (this.isRunning) {
      throw new Error('Cleanup already running');
    }

    this.isRunning = true;
    try {
      return await qrService.cleanupExpired();
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = new CleanupService();