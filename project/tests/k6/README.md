# ActivityPub Load Testing with k6

This directory contains k6 load testing scripts for testing the performance and scalability of your ActivityPub implementation.

## Overview

The test suite focuses on the following critical components of ActivityPub federation:

1. **Inbox Processing** - Tests handling of incoming federation activities
2. **Outbox Processing** - Tests creation and delivery of outgoing federation activities

## Prerequisites

- Install k6: https://k6.io/docs/getting-started/installation/
- Running instance of your OpenCamp server
- PostgreSQL database with initialized schema
- RabbitMQ server running

## Configuration

Before running the tests, edit the `config.js` file to match your environment:

- Set the `baseUrl` to your server's URL
- Configure test users that exist in your database
- Adjust the load scenarios based on your system's capacity

### Load Test Configuration
To simulate times of peak activity followed by a cooldown, the tests use a ramping arrival rate executor with the following stages:

```javascript
// Common test configuration for both inbox and outbox
export const options = {
  scenarios: {
    traffic: {
      executor: 'ramping-arrival-rate',  // Uses arrival rate rather than VUs for more predictable load
      startRate: 5,                       // Start with 5 requests per second
      timeUnit: '1s',
      preAllocatedVUs: 10,                // Pre-allocate this many VUs
      maxVUs: 10,                         // Maximum number of VUs to use
      stages: [
        { duration: '30s', target: 10 },  // Ramp up to 10 requests per second
        { duration: '1m', target: 10 },   // Stay at 10 rps
        { duration: '30s', target: 20 },  // Ramp up to 20 rps (peak)
        { duration: '1m', target: 5 },    // Ramp down to normal
      ],
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<500'],   // 95% of requests should be below 500ms
    'latency': ['p(95)<500'],             // 95% of processing under 500ms
    'success_rate': ['rate>0.95'],        // 95% success rate
  },
};
```

We selected this configuration for the following reasons:

1. **Ramping Arrival Rate**: This executor type ensures a consistent request rate rather than focusing on virtual users, which better simulates real federation traffic from multiple instances.

2. **Staged Load Profile**: The four-stage approach lets us test:
   - Initial ramp-up (30s)
   - Sustained load (1m)
   - Peak load simulation (30s at 20 rps)
   - Cooldown period (1m)

3. **Consistent Thresholds**: Both tests enforce the same performance requirements:
   - 500ms maximum p95 latency for HTTP requests
   - 500ms maximum p95 latency for ActivityPub processing
   - 95% minimum success rate

These values align with practical ActivityPub federation requirements for acceptable performance.

## Running the Tests

### Basic Usage

```bash
# Run inbox load test
k6 run inbox-load-test.js

# Run outbox load test
k6 run outbox-load-test.js
```

### Using npm Scripts

We've added npm scripts to simplify running the tests:

```bash
# Run inbox test
npm run k6-inbox

# Run outbox test
npm run k6-outbox
```

## Automated Test Comparison

We've created a script that runs both tests and automatically compares the results. This helps identify performance differences between inbox and outbox processing, which is crucial for balanced federation performance.

### How the Comparison Script Works

The `run-and-compare.js` script:

1. Runs both the inbox and outbox tests sequentially
2. Captures detailed metrics from each test
3. Validates results against defined thresholds
4. Compares inbox vs outbox performance across key metrics:
   - Success rate
   - Latency (p95, median, average)
   - Throughput (requests per second)
5. Performs ActivityPub-specific analysis to ensure federation requirements are met
6. Generates a detailed report with pass/fail status

### Running the Comparison

```bash
# Run both tests and compare results
npm run k6-compare
```

The script will output:
- Individual test metrics and threshold validations
- Direct comparison between inbox and outbox performance
- Federation-specific analysis
- A summary of whether all tests pass the requirements

The comparison focuses on three key metrics for ActivityPub federation:

1. **Success Rate**: Both endpoints should achieve at least 95% success
2. **Latency**: 95th percentile response times should be under 500ms
3. **Throughput**: Measures the sustainable request rate for each endpoint

A JSON report is also saved to the `results` directory for historical tracking.

## Key ActivityPub Test Considerations

When testing ActivityPub federation, remember that:

1. Activities must include proper structure with `@context`, `id`, `actor`, and `object` fields
2. Follow/Unfollow activities should be sent directly to the recipient's inbox
3. Both inbox and outbox processing use RabbitMQ for asynchronous handling

The tests are designed to simulate realistic federation scenarios while maintaining reproducible results for consistent performance monitoring.