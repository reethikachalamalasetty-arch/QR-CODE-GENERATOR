const express = require('express');
const Joi = require('joi');
const qrService = require('../services/qrService');
const { qrGeneration, qrRetrieval } = require('../middleware/rateLimiter');

const router = express.Router();

// Validation schemas
const generateSchema = Joi.object({
  data: Joi.string().required().max(2048),
  userId: Joi.string().optional().max(255),
  expiryHours: Joi.number().optional().min(1).max(8760), // Max 1 year
  metadata: Joi.object().optional(),
  options: Joi.object({
    errorCorrectionLevel: Joi.string().valid('L', 'M', 'Q', 'H').optional(),
    width: Joi.number().min(100).max(1000).optional(),
    margin: Joi.number().min(0).max(10).optional()
  }).optional()
});

const idSchema = Joi.object({
  id: Joi.string().uuid().required()
});

// Generate QR Code
router.post('/generate', qrGeneration, async (req, res, next) => {
  try {
    const { error, value } = generateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { data, userId, expiryHours, metadata, options } = value;
    
    const qrOptions = {
      userId,
      metadata,
      ...options
    };

    // Override expiry if provided
    if (expiryHours) {
      process.env.QR_CODE_EXPIRY_HOURS = expiryHours.toString();
    }

    const qrCode = await qrService.generateQR(data, qrOptions);
    
    res.status(201).json({
      success: true,
      data: qrCode,
      message: 'QR code generated successfully'
    });

  } catch (error) {
    next(error);
  }
});

// Get QR Code Stats (must come before /:id route)
router.get('/stats/:userId?', async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const stats = await qrService.getStats(userId);
    
    res.json({
      success: true,
      data: {
        totalCodes: parseInt(stats.total_codes) || 0,
        activeCodes: parseInt(stats.active_codes) || 0,
        totalAccesses: parseInt(stats.total_accesses) || 0
      }
    });

  } catch (error) {
    next(error);
  }
});

// Get QR Code
router.get('/:id', qrRetrieval, async (req, res, next) => {
  try {
    const { error, value } = idSchema.validate(req.params);
    if (error) {
      return res.status(400).json({ 
        error: 'Invalid QR code ID format' 
      });
    }

    const { id } = value;
    
    // Collect scanner information
    const scannerInfo = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      location: req.get('CF-IPCountry') || req.get('X-Country'), // Cloudflare or other proxy headers
      metadata: {
        timestamp: new Date().toISOString(),
        referer: req.get('Referer'),
        acceptLanguage: req.get('Accept-Language')
      }
    };
    
    const qrCode = await qrService.getQR(id, scannerInfo);
    
    res.json({
      success: true,
      data: qrCode
    });

  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ 
        error: 'QR code not found or expired' 
      });
    }
    next(error);
  }
});

// Delete QR Code
router.delete('/:id', async (req, res, next) => {
  try {
    const { error, value } = idSchema.validate(req.params);
    if (error) {
      return res.status(400).json({ 
        error: 'Invalid QR code ID format' 
      });
    }

    const { id } = value;
    const userId = req.body.userId || req.query.userId;
    
    await qrService.deleteQR(id, userId);
    
    res.json({
      success: true,
      message: 'QR code deleted successfully'
    });

  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ 
        error: 'QR code not found or access denied' 
      });
    }
    next(error);
  }
});

// Batch generate QR codes
router.post('/batch', qrGeneration, async (req, res, next) => {
  try {
    const batchSchema = Joi.object({
      items: Joi.array().items(
        Joi.object({
          data: Joi.string().required().max(2048),
          userId: Joi.string().optional().max(255),
          metadata: Joi.object().optional()
        })
      ).min(1).max(10).required() // Limit batch size
    });

    const { error, value } = batchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details[0].message 
      });
    }

    const { items } = value;
    const results = [];
    const errors = [];

    // Process items concurrently but with controlled concurrency
    const promises = items.map(async (item, index) => {
      try {
        const qrCode = await qrService.generateQR(item.data, {
          userId: item.userId,
          metadata: item.metadata
        });
        results[index] = qrCode;
      } catch (error) {
        errors[index] = error.message;
      }
    });

    await Promise.all(promises);

    res.status(201).json({
      success: true,
      data: {
        results: results.filter(Boolean),
        errors: errors.filter(Boolean),
        totalRequested: items.length,
        totalGenerated: results.filter(Boolean).length
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;