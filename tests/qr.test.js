const request = require('supertest');
const QRServer = require('../src/server');

describe('QR Code API', () => {
  let app;
  let server;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    server = new QRServer();
    app = server.app;
  });

  afterAll(async () => {
    if (server.server) {
      server.server.close();
    }
  });

  describe('POST /api/qr/generate', () => {
    it('should generate a QR code successfully', async () => {
      const response = await request(app)
        .post('/api/qr/generate')
        .send({
          data: 'https://example.com',
          userId: 'test-user'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('qrImageUrl');
      expect(response.body.data.data).toBe('https://example.com');
    });

    it('should validate input data', async () => {
      const response = await request(app)
        .post('/api/qr/generate')
        .send({
          data: '' // Empty data should fail
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle large data input', async () => {
      const largeData = 'x'.repeat(2048);
      const response = await request(app)
        .post('/api/qr/generate')
        .send({
          data: largeData
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject oversized data', async () => {
      const oversizedData = 'x'.repeat(2049);
      const response = await request(app)
        .post('/api/qr/generate')
        .send({
          data: oversizedData
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/qr/:id', () => {
    let qrId;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/qr/generate')
        .send({
          data: 'test-data-for-retrieval'
        });
      qrId = response.body.data.id;
    });

    it('should retrieve a QR code successfully', async () => {
      const response = await request(app)
        .get(`/api/qr/${qrId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(qrId);
      expect(response.body.data.data).toBe('test-data-for-retrieval');
    });

    it('should return 404 for non-existent QR code', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .get(`/api/qr/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should validate UUID format', async () => {
      const response = await request(app)
        .get('/api/qr/invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid QR code ID format');
    });
  });

  describe('POST /api/qr/batch', () => {
    it('should generate multiple QR codes', async () => {
      const response = await request(app)
        .post('/api/qr/batch')
        .send({
          items: [
            { data: 'batch-test-1' },
            { data: 'batch-test-2' },
            { data: 'batch-test-3' }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(3);
      expect(response.body.data.totalGenerated).toBe(3);
    });

    it('should limit batch size', async () => {
      const items = Array.from({ length: 11 }, (_, i) => ({ data: `test-${i}` }));
      const response = await request(app)
        .post('/api/qr/batch')
        .send({ items });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memory');
    });
  });
});