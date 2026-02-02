import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 500 }, // Ramp up to 500 users
    { duration: '5m', target: 500 }, // Stay at 500 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate must be below 10%
    errors: ['rate<0.1'],
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  // Test QR code generation
  const generatePayload = JSON.stringify({
    data: `https://example.com/test-${Math.random()}`,
    userId: `user-${Math.floor(Math.random() * 1000)}`,
    metadata: {
      testRun: true,
      timestamp: Date.now()
    }
  });

  const generateParams = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const generateResponse = http.post(`${BASE_URL}/api/qr/generate`, generatePayload, generateParams);
  
  const generateSuccess = check(generateResponse, {
    'QR generation status is 201': (r) => r.status === 201,
    'QR generation response time < 500ms': (r) => r.timings.duration < 500,
    'QR generation has valid response': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && body.data && body.data.id;
      } catch (e) {
        return false;
      }
    },
  });

  errorRate.add(!generateSuccess);

  // If generation was successful, test retrieval
  if (generateSuccess && generateResponse.status === 201) {
    try {
      const generateBody = JSON.parse(generateResponse.body);
      const qrId = generateBody.data.id;

      sleep(0.1); // Small delay between generation and retrieval

      const retrieveResponse = http.get(`${BASE_URL}/api/qr/${qrId}`);
      
      const retrieveSuccess = check(retrieveResponse, {
        'QR retrieval status is 200': (r) => r.status === 200,
        'QR retrieval response time < 200ms': (r) => r.timings.duration < 200,
        'QR retrieval has valid response': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.success === true && body.data && body.data.id === qrId;
          } catch (e) {
            return false;
          }
        },
      });

      errorRate.add(!retrieveSuccess);
    } catch (e) {
      console.error('Error parsing generate response:', e);
      errorRate.add(true);
    }
  }

  // Test health endpoint occasionally
  if (Math.random() < 0.1) { // 10% of the time
    const healthResponse = http.get(`${BASE_URL}/api/health`);
    check(healthResponse, {
      'Health check status is 200': (r) => r.status === 200,
      'Health check response time < 100ms': (r) => r.timings.duration < 100,
    });
  }

  sleep(1); // Wait 1 second between iterations
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: `
Load Test Summary:
==================
Total Requests: ${data.metrics.http_reqs.count}
Failed Requests: ${data.metrics.http_req_failed.count} (${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%)
Average Response Time: ${data.metrics.http_req_duration.avg.toFixed(2)}ms
95th Percentile: ${data.metrics['http_req_duration{p(95)}'].toFixed(2)}ms
Max Response Time: ${data.metrics.http_req_duration.max.toFixed(2)}ms

QR Generation Performance:
- Average: ${data.metrics.http_req_duration.avg.toFixed(2)}ms
- 95th Percentile: ${data.metrics['http_req_duration{p(95)}'].toFixed(2)}ms

Test completed successfully!
    `,
  };
}