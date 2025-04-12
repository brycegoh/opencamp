export const config = {
  baseUrl: 'http://localhost:3000',
  
  // Test users - these should exist in your test database
  testUsers: {
    local: {
      username: 'testuser',
      password: 'password123'
    },
    remote: {
      username: 'remoteuser',
      domain: 'remote-instance.example'
    }
  },
  
  // Standardized test parameters for all tests
  testParams: {
    // Common executor configuration
    executor: 'ramping-arrival-rate',
    startRate: 5,
    timeUnit: '1s',
    preAllocatedVUs: 10,
    maxVUs: 10,
    
    // Common stages configuration
    stages: [
      { duration: '30s', target: 10 },  // Ramp up to 10 requests per second
      { duration: '1m', target: 10 },   // Stay at 10 rps
      { duration: '30s', target: 20 },  // Ramp up to 20 rps (peak)
      { duration: '1m', target: 5 },    // Ramp down to normal
    ],
    
    // Common threshold values
    thresholds: {
      httpReqDuration: 500,    // 95% of requests should be below 500ms
      latency: 500,            // 95% of processing under 500ms
      successRate: 0.95        // 95% success rate
    }
  }
};

// Helper function to generate random test data
export function generateRandomCheckin() {
  return {
    content: `Checking in at location #${Math.floor(Math.random() * 1000)}`,
    latitude: (Math.random() * 180) - 90,
    longitude: (Math.random() * 360) - 180,
    location_name: `Place ${Math.floor(Math.random() * 100)}`
  };
}

// Helper function to generate random test follow activity
export function generateFollowActivity(follower, followee) {
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    "id": `${config.baseUrl}/activities/${Math.random().toString(36).substring(2, 15)}`,
    "type": "Follow",
    "actor": `${config.baseUrl}/users/${follower}`,
    "object": `${config.baseUrl}/users/${followee}`
  };
}

// Helper function to generate random test create activity
export function generateCreateActivity(username) {
  const noteId = Math.random().toString(36).substring(2, 15);
  const note = {
    "@context": "https://www.w3.org/ns/activitystreams",
    "id": `${config.baseUrl}/notes/${noteId}`,
    "type": "Note",
    "attributedTo": `${config.baseUrl}/users/${username}`,
    "content": `This is a test note #${Math.floor(Math.random() * 1000)}`,
    "published": new Date().toISOString()
  };
  
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    "id": `${config.baseUrl}/activities/${Math.random().toString(36).substring(2, 15)}`,
    "type": "Create",
    "actor": `${config.baseUrl}/users/${username}`,
    "object": note
  };
}
