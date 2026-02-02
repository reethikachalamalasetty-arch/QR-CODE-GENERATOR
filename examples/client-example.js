const axios = require('axios');

// Example client for the QR Code Generation System
class QRClient {
  constructor(baseURL = 'http://localhost:3000/api') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async generateQR(data, options = {}) {
    try {
      const response = await this.client.post('/qr/generate', {
        data,
        ...options
      });
      return response.data;
    } catch (error) {
      throw new Error(`QR generation failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getQR(id) {
    try {
      const response = await this.client.get(`/qr/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(`QR retrieval failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async deleteQR(id, userId = null) {
    try {
      const response = await this.client.delete(`/qr/${id}`, {
        data: userId ? { userId } : {}
      });
      return response.data;
    } catch (error) {
      throw new Error(`QR deletion failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async batchGenerate(items) {
    try {
      const response = await this.client.post('/qr/batch', { items });
      return response.data;
    } catch (error) {
      throw new Error(`Batch generation failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getStats(userId = null) {
    try {
      const endpoint = userId ? `/qr/stats/${userId}` : '/qr/stats';
      const response = await this.client.get(endpoint);
      return response.data;
    } catch (error) {
      throw new Error(`Stats retrieval failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw new Error(`Health check failed: ${error.response?.data?.error || error.message}`);
    }
  }
}

// Example usage
async function demonstrateUsage() {
  const client = new QRClient();

  try {
    console.log('🚀 QR Code System Demo\n');

    // 1. Health check
    console.log('1. Checking system health...');
    const health = await client.healthCheck();
    console.log(`✅ System is ${health.status}\n`);

    // 2. Generate a simple QR code
    console.log('2. Generating QR code...');
    const qr1 = await client.generateQR('https://example.com', {
      userId: 'demo-user',
      metadata: { type: 'website', demo: true }
    });
    console.log(`✅ Generated QR: ${qr1.data.id}`);
    console.log(`   Data: ${qr1.data.data}`);
    console.log(`   Expires: ${qr1.data.expiresAt}\n`);

    // 3. Retrieve the QR code
    console.log('3. Retrieving QR code...');
    const retrieved = await client.getQR(qr1.data.id);
    console.log(`✅ Retrieved QR: ${retrieved.data.id}`);
    console.log(`   Access count: ${retrieved.data.accessCount}\n`);

    // 4. Batch generate QR codes
    console.log('4. Batch generating QR codes...');
    const batchItems = [
      { data: 'https://example.com/page1', userId: 'demo-user' },
      { data: 'https://example.com/page2', userId: 'demo-user' },
      { data: 'https://example.com/page3', userId: 'demo-user' }
    ];
    const batchResult = await client.batchGenerate(batchItems);
    console.log(`✅ Batch generated: ${batchResult.data.totalGenerated} QR codes\n`);

    // 5. Get statistics
    console.log('5. Getting statistics...');
    const stats = await client.getStats('demo-user');
    console.log(`✅ User stats:`);
    console.log(`   Total codes: ${stats.data.totalCodes}`);
    console.log(`   Active codes: ${stats.data.activeCodes}`);
    console.log(`   Total accesses: ${stats.data.totalAccesses}\n`);

    // 6. Generate QR with custom options
    console.log('6. Generating QR with custom options...');
    const customQR = await client.generateQR('Custom QR Code Data', {
      userId: 'demo-user',
      expiryHours: 1, // Expires in 1 hour
      metadata: { priority: 'high', category: 'custom' },
      options: {
        errorCorrectionLevel: 'H',
        width: 300,
        margin: 2
      }
    });
    console.log(`✅ Custom QR generated: ${customQR.data.id}`);
    console.log(`   Size: 300px, High error correction\n`);

    // 7. Clean up - delete one QR code
    console.log('7. Cleaning up...');
    await client.deleteQR(qr1.data.id, 'demo-user');
    console.log(`✅ Deleted QR: ${qr1.data.id}\n`);

    console.log('🎉 Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Concurrent usage example
async function demonstrateConcurrency() {
  const client = new QRClient();
  const concurrentRequests = 50;
  
  console.log(`\n🔄 Testing ${concurrentRequests} concurrent QR generations...\n`);

  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < concurrentRequests; i++) {
    const promise = client.generateQR(`https://example.com/concurrent-test-${i}`, {
      userId: `user-${i % 10}`, // Distribute across 10 users
      metadata: { test: 'concurrency', index: i }
    });
    promises.push(promise);
  }

  try {
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Generated ${results.length} QR codes concurrently`);
    console.log(`⏱️  Total time: ${duration}ms`);
    console.log(`📊 Average time per QR: ${(duration / results.length).toFixed(2)}ms`);
    console.log(`🚀 Throughput: ${(results.length / (duration / 1000)).toFixed(2)} QR/second\n`);

  } catch (error) {
    console.error('❌ Concurrency test failed:', error.message);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  (async () => {
    await demonstrateUsage();
    await demonstrateConcurrency();
  })();
}

module.exports = QRClient;