const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', function() {
    // Set default values
    document.getElementById('data').value = 'https://example.com';
    
    // Start auto-updating stats
    startStatsAutoUpdate();
    
    // Add form submit handler
    document.getElementById('qrForm').addEventListener('submit', handleFormSubmit);
    
    // Add user ID change handler to update stats when user changes
    document.getElementById('userId').addEventListener('input', function() {
        const userId = this.value.trim() || null;
        startStatsAutoUpdate(userId);
    });
});

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const generateBtn = document.getElementById('generateBtn');
    const resultDiv = document.getElementById('result');
    
    // Get form data
    const data = document.getElementById('data').value;
    const userId = document.getElementById('userId').value;
    const expiryHours = document.getElementById('expiryHours').value;
    const errorCorrection = document.getElementById('errorCorrection').value;
    const size = document.getElementById('size').value;
    
    // Validate required fields
    if (!data.trim()) {
        showError('Please enter data to encode');
        return;
    }
    
    // Show loading
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    resultDiv.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Generating your QR code...</p>
        </div>
    `;
    resultDiv.style.display = 'block';
    
    try {
        const requestBody = {
            data: data.trim(),
            userId: userId.trim() || undefined,
            expiryHours: expiryHours ? parseInt(expiryHours) : undefined,
            options: {
                errorCorrectionLevel: errorCorrection,
                width: parseInt(size)
            }
        };
        
        console.log('Sending request:', requestBody);
        
        const response = await fetch(`${API_BASE}/qr/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Response data:', result);
        
        if (result.success) {
            showSuccess(result.data);
            // Update stats immediately and start auto-update
            const userId = requestBody.userId;
            startStatsAutoUpdate(userId);
        } else {
            throw new Error(result.error || 'Failed to generate QR code');
        }
        
    } catch (error) {
        console.error('Error generating QR code:', error);
        showError(error.message);
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate QR Code';
    }
}

function showSuccess(qrData) {
    const resultDiv = document.getElementById('result');
    
    // Hide sensitive data - only show first 50 characters
    const displayData = qrData.data.length > 50 ? 
        qrData.data.substring(0, 50) + '...' : 
        qrData.data;
    
    resultDiv.innerHTML = `
        <div class="success">
            <h3>✅ QR Code Generated Successfully!</h3>
            <div class="qr-image">
                <img src="${qrData.qrImageUrl}" alt="Generated QR Code" style="max-width: 300px; border: 2px solid #e1e5e9; border-radius: 8px;">
            </div>
            <div class="qr-info">
                <h3>QR Code Details</h3>
                <p><strong>ID:</strong> ${qrData.id}</p>
                <p><strong>Data:</strong> ${displayData}</p>
                <p><strong>Created:</strong> ${new Date(qrData.createdAt).toLocaleString()}</p>
                <p><strong>Expires:</strong> ${new Date(qrData.expiresAt).toLocaleString()}</p>
                <p><strong>Access Count:</strong> ${qrData.accessCount}</p>
                <button onclick="downloadQR('${qrData.qrImageUrl}', '${qrData.id}')" class="btn" style="margin-top: 15px; width: auto; padding: 10px 20px;">
                    Download QR Code
                </button>
                <button onclick="copyToClipboard('${qrData.id}')" class="btn" style="margin-top: 15px; margin-left: 10px; width: auto; padding: 10px 20px; background: #28a745;">
                    Copy QR ID
                </button>
            </div>
        </div>
    `;
}

function showError(message) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = `
        <div class="error">
            <h3>❌ Error</h3>
            <p>${message}</p>
            <p><small>Check the browser console for more details.</small></p>
        </div>
    `;
}

async function updateStats(userId) {
    try {
        const endpoint = userId ? `${API_BASE}/qr/stats/${userId}` : `${API_BASE}/qr/stats`;
        const response = await fetch(endpoint);
        
        if (!response.ok) {
            console.warn('Failed to fetch stats:', response.status);
            return;
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Animate the numbers
            animateNumber('totalCodes', result.data.totalCodes);
            animateNumber('activeCodes', result.data.activeCodes);
            animateNumber('totalAccesses', result.data.totalAccesses);
            
            document.getElementById('stats').style.display = 'block';
            
            // Update last updated time
            const now = new Date().toLocaleTimeString();
            let lastUpdatedElement = document.getElementById('lastUpdated');
            if (!lastUpdatedElement) {
                lastUpdatedElement = document.createElement('p');
                lastUpdatedElement.id = 'lastUpdated';
                lastUpdatedElement.style.textAlign = 'center';
                lastUpdatedElement.style.color = '#666';
                lastUpdatedElement.style.fontSize = '0.9em';
                lastUpdatedElement.style.marginTop = '10px';
                document.getElementById('stats').appendChild(lastUpdatedElement);
            }
            lastUpdatedElement.textContent = `Last updated: ${now}`;
        }
    } catch (error) {
        console.error('Failed to update stats:', error);
    }
}

function animateNumber(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const currentValue = parseInt(element.textContent) || 0;
    const target = parseInt(targetValue) || 0;
    
    if (currentValue === target) return;
    
    const duration = 500; // Animation duration in ms
    const steps = 20;
    const stepValue = (target - currentValue) / steps;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
        currentStep++;
        const newValue = Math.round(currentValue + (stepValue * currentStep));
        element.textContent = newValue;
        
        if (currentStep >= steps) {
            element.textContent = target;
            clearInterval(timer);
        }
    }, stepDuration);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Show temporary success message
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.background = '#28a745';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '#28a745';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
        alert('Failed to copy to clipboard');
    });
}

// Auto-update stats every 10 seconds
let statsUpdateInterval;
let currentUserId = null;

function startStatsAutoUpdate(userId = null) {
    currentUserId = userId;
    
    // Clear existing interval
    if (statsUpdateInterval) {
        clearInterval(statsUpdateInterval);
    }
    
    // Update immediately
    updateStats(userId);
    
    // Set up auto-update every 10 seconds
    statsUpdateInterval = setInterval(() => {
        updateStats(currentUserId);
    }, 10000);
}

function stopStatsAutoUpdate() {
    if (statsUpdateInterval) {
        clearInterval(statsUpdateInterval);
        statsUpdateInterval = null;
    }
}

function downloadQR(dataUrl, filename) {
    try {
        const link = document.createElement('a');
        link.download = `qr-code-${filename}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Failed to download QR code:', error);
        alert('Failed to download QR code. You can right-click on the image and save it manually.');
    }
}

// Test API connection on page load
fetch(`${API_BASE}/health`)
    .then(response => response.json())
    .then(data => {
        console.log('API Health Check:', data);
        if (data.status === 'healthy') {
            console.log('✅ API is connected and working');
        }
    })
    .catch(error => {
        console.error('❌ API connection failed:', error);
        document.getElementById('result').innerHTML = `
            <div class="error">
                <h3>❌ API Connection Error</h3>
                <p>Cannot connect to the QR generation service. Please make sure the server is running.</p>
                <p><small>Error: ${error.message}</small></p>
            </div>
        `;
        document.getElementById('result').style.display = 'block';
    });