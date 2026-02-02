const axios = require('axios');

async function testWebInterface() {
    console.log('🧪 Testing Web Interface QR Generation\n');
    
    try {
        // Test the exact same request that the web interface would make
        const response = await axios.post('http://localhost:3000/api/qr/generate', {
            data: 'https://example.com',
            userId: 'web-test-user',
            options: {
                errorCorrectionLevel: 'M',
                width: 200
            }
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ QR Generation Response:');
        console.log(`   Status: ${response.status}`);
        console.log(`   Success: ${response.data.success}`);
        console.log(`   QR ID: ${response.data.data.id}`);
        console.log(`   Data: ${response.data.data.data}`);
        console.log(`   Image URL Length: ${response.data.data.qrImageUrl.length} characters`);
        console.log(`   Created: ${response.data.data.createdAt}`);
        console.log(`   Expires: ${response.data.data.expiresAt}`);
        
        // Test retrieval
        const qrId = response.data.data.id;
        const retrieveResponse = await axios.get(`http://localhost:3000/api/qr/${qrId}`);
        
        console.log('\n✅ QR Retrieval Response:');
        console.log(`   Status: ${retrieveResponse.status}`);
        console.log(`   Success: ${retrieveResponse.data.success}`);
        console.log(`   Access Count: ${retrieveResponse.data.data.accessCount}`);
        
        // Test stats
        const statsResponse = await axios.get('http://localhost:3000/api/qr/stats/web-test-user');
        
        console.log('\n✅ Stats Response:');
        console.log(`   Status: ${statsResponse.status}`);
        console.log(`   Success: ${statsResponse.data.success}`);
        console.log(`   Total Codes: ${statsResponse.data.data.totalCodes}`);
        console.log(`   Active Codes: ${statsResponse.data.data.activeCodes}`);
        
        console.log('\n🎉 Web interface backend is working correctly!');
        console.log('\n📝 If the web interface still doesn\'t work:');
        console.log('   1. Open browser developer tools (F12)');
        console.log('   2. Check the Console tab for JavaScript errors');
        console.log('   3. Check the Network tab to see if API calls are being made');
        console.log('   4. Refresh the page (Ctrl+F5) to clear cache');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testWebInterface();