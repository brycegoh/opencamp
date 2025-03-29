import { startWorker as startOutboxProcessor } from './outboxProcessor';

/**
 * Start all worker processes
 */
export function startWorkers() {
  // Start the outbox processor worker
  startOutboxProcessor();
  
  // Add more workers here as needed
  console.log('All worker processes started');
}

// If this file is run directly, start all workers
if (require.main === module) {
  startWorkers();
} 