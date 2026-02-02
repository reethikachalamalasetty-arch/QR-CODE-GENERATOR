const axios = require('axios');

async function generateTestData() {
    console.log('🧪 Generating test QR codes for statistics...\n');
    
    try {
        // Generate multiple QR codes with different users
        const testData = [
            { data: 'https://example.com/page1', userId: 'user1' },
            { data: 'https://example.com/page2', userId: 'user1' },
            { data: 'https://example.com/page3', userId: 'user2' },
            { data: 'https://github.com/test', userId: 'user2' },
            { data: 'https://google.com', userId: null },
        ];
        
        const generatedQRs = [];
        
        for (let i = 0; i < testData.length; i++) {
            const item = testData[i];
            console.log(`Generating QR ${i + 1}/5: ${item.data}`);
            
            const response = await axios.post('http://localhost:3000/api/qr/generate', {
                data: item.data,
                ...(item.userId && { userId: item.userId }),
                options: {
                    errorCorrectionLevel: 'M',
                    width: 200
                }
            });
            
            if (response.data.success) {
                generatedQRs.push(response.data.data);
                console.log(`✅ Generated: ${response.data.data.id}`);
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Access some QR codes to increase access count
        console.log('\n📊 Accessing QR codes to update statistics...');
        for (let i = 0; i < 3; i++) {
            const qr = generatedQRs[i];
            if (qr) {
                await axios.get(`http://localhost:3000/api/qr/${qr.id}`);
                console.log(`✅ Accessed QR: ${qr.id}`);
            }
        }
        
        // Get overall stats
        console.log('\n📈 Overall Statistics:');
        const overallStats = await axios.get('http://localhost:3000/api/qr/stats');
        console.log(`   Total Codes: ${overallStats.data.data.totalCodes}`);
        console.log(`   Active Codes: ${overallStats.data.data.activeCodes}`);
        console.log(`   Total Accesses: ${overallStats.data.data.totalAccesses}`);
        
        // Get user-specific stats
        console.log('\n📈 User1 Statistics:');
        const user1Stats = await axios.get('http://localhost:3000/api/qr/stats/user1');
        console.log(`   Total Codes: ${user1Stats.data.data.totalCodes}`);
        console.log(`   Active Codes: ${user1Stats.data.data.activeCodes}`);
        console.log(`   Total Accesses: ${user1Stats.data.data.totalAccesses}`);
        
        console.log('\n🎉 Test data generated successfully!');
        console.log('💡 Now refresh the web interface to see the updated statistics.');
        
    } catch (error) {
        console.error('❌ Error generating test data:', error.response?.data || error.message);
    }
}

generateTestData();