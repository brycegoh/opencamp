#!/usr/bin/env node

// This script is used to start the worker processes
// Usage: NODE_ENV=production node scripts/worker.js

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Import and start all workers
require('../dist/workers/index.js').startWorkers();

console.log('Worker processes started');

// Handle graceful shutdown
const shutdown = () => {
  console.log('Shutting down worker processes...');
  // Perform any cleanup here
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown); 