const axios = require('axios');

// Simple test script for the QR system
async function testQRSystem() {
  const baseURL = 'http://localhost:3000/api';
  
  console.log('🧪 Testing QR Code Generation System\n');
  
  try {
    // 1. Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log(`✅ Health check: ${healthResponse.data.status}`);
    
    // 2. Generate QR code
    console.log('\n2. Testing QR code generation...');
    const generateResponse = await axios.post(`${baseURL}/qr/generate`, {
      data: 'https://example.com/test',
      userId: 'test-user',
      metadata: { test: true }
    });
    
    const qrId = generateResponse.data.data.id;
    console.log(`✅ QR code generated: ${qrId}`);
    console.log(`   Data: ${generateResponse.data.data.data}`);
    console.log(`   Image size: ${generateResponse.data.data.qrImageUrl.length} characters`);
    
    // 3. Retrieve QR code
    console.log('\n3. Testing QR code retrieval...');
    const retrieveResponse = await axios.get(`${baseURL}/qr/${qrId}`);
    console.log(`✅ QR code retrieved: ${retrieveResponse.data.data.id}`);
    console.log(`   Access count: ${retrieveResponse.data.data.accessCount}`);
    
    // 4. Test stats
    console.log('\n4. Testing statistics...');
    const statsResponse = await axios.get(`${baseURL}/qr/stats/test-user`);
    console.log(`✅ Stats retrieved:`);
    console.log(`   Total codes: ${statsResponse.data.data.totalCodes}`);
    console.log(`   Active codes: ${statsResponse.data.data.activeCodes}`);
    
    // 5. Test batch generation
    console.log('\n5. Testing batch generation...');
    const batchResponse = await axios.post(`${baseURL}/qr/batch`, {
      items: [
        { data: 'https://example.com/batch1', userId: 'test-user' },
        { data: 'https://example.com/batch2', userId: 'test-user' }
      ]
    });
    console.log(`✅ Batch generated: ${batchResponse.data.data.totalGenerated} QR codes`);
    
    // 6. Delete QR code
    console.log('\n6. Testing QR code deletion...');
    const deleteResponse = await axios.delete(`${baseURL}/qr/${qrId}`, {
      data: { userId: 'test-user' }
    });
    console.log(`✅ QR code deleted successfully`);
    
    console.log('\n🎉 All tests passed! The QR system is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data?.error || error.message);
    if (error.response?.status) {
      console.error(`   Status: ${error.response.status}`);
    }
  }
}

// Run tests if server is available
testQRSystem();