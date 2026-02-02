const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const { connectDatabase } = require('./config/database');
const { connectSQLite } = require('./config/sqlite');
const { connectRedis } = require('./config/redis');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const qrRoutes = require('./routes/qrRoutes');
const healthRoutes = require('./routes/healthRoutes');
const cleanupService = require('./utils/cleanup');

class QRServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware with relaxed CSP for development
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    }));
    
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true
    }));
    
    // Performance middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Rate limiting
    this.app.use('/api/', rateLimiter.general);
  }

  setupRoutes() {
    // Serve static files
    this.app.use(express.static('public'));
    
    this.app.use('/api/qr', qrRoutes);
    this.app.use('/api/health', healthRoutes);
    
    // Root route redirect to index.html
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
    
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });
  }

  setupErrorHandling() {
    this.app.use(errorHandler);
  }

  async start() {
    try {
      // Initialize database connections
      console.log('Initializing SQLite database connection...');
      await connectSQLite();
      
      // Skip Redis for now
      console.log('⚠️ Skipping Redis connection (not required for basic functionality)');
      
      // Start cleanup service
      console.log('Starting cleanup service...');
      cleanupService.start();
      
      // Start server
      this.server = this.app.listen(this.port, () => {
        console.log(`🚀 QR Server running on port ${this.port}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Health check: http://localhost:${this.port}/api/health`);
        console.log(`🌐 Web interface: http://localhost:${this.port}`);
        console.log(`💾 Database: SQLite (persistent storage)`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
      
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      
      // In development, try to start without external dependencies
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️  Starting in degraded mode (without external dependencies)...');
        this.server = this.app.listen(this.port, () => {
          console.log(`🚀 QR Server running on port ${this.port} (degraded mode)`);
          console.log(`⚠️  Some features may not work without database/Redis`);
        });
      } else {
        process.exit(1);
      }
    }
  }

  async shutdown() {
    console.log('Shutting down server...');
    if (this.server) {
      this.server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    }
  }
}

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const server = new QRServer();
  server.start();
}

module.exports = QRServer;