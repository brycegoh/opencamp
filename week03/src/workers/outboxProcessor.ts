import { Pool } from 'pg';
import { Outbox } from '../data/dataSchema';
import { findActorById } from '../data/actors';
import { processCreateActivity, processFollowActivity, processLikeActivity } from './processingHelpers';
import { Activity } from '../routes/activitypub/types';
import { 
  fetchQueueBatch, 
  markQueueItemForRetry, 
  beginTransaction, 
  commitTransaction, 
  rollbackTransaction 
} from './queueHelpers';

// Configuration
const BATCH_SIZE = 10;
const POLLING_INTERVAL_MS = 5000; // 5 seconds
const QUEUE_TABLE = 'outbox';

// Database connection (should be configured from environment variables)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Process a single outbox entry
 */
async function processOutboxEntry(entry: Outbox): Promise<void> {
  // Get the actor
  const actor = await findActorById(entry.actor_id);
  if (!actor) {
    console.error(`Actor not found for outbox entry: ${entry.id}`);
    return;
  }

  // Process based on activity type
  const activity = entry.raw_data as Activity;
  
  // Begin transaction for processing
  const client = await beginTransaction(pool);
  
  try {
    switch (entry.activity_type) {
      case 'Create':
        await processCreateActivity(actor, activity);
        break;
        
      case 'Follow':
        await processFollowActivity(actor, activity);
        break;
        
      case 'Like':
        await processLikeActivity(actor, activity);
        break;
        
      default:
        console.warn(`Unsupported activity type: ${entry.activity_type}`);
    }
    
    // Commit the transaction if processing succeeded
    await commitTransaction(client);
    console.log(`Successfully processed outbox entry: ${entry.id}`);
  } catch (error) {
    // Rollback and mark as unprocessed to retry later
    await rollbackTransaction(client);
    
    // Mark the entry as unprocessed to retry
    await markQueueItemForRetry(pool, QUEUE_TABLE, entry.id);
    
    console.error(`Error processing outbox entry ${entry.id}:`, error);
  }
}

/**
 * Process a batch of outbox entries
 */
async function processBatch(): Promise<void> {
  try {
    const entries = await fetchQueueBatch<Outbox>(pool, QUEUE_TABLE, BATCH_SIZE);
    
    if (entries.length === 0) {
      return;
    }
    
    console.log(`Processing ${entries.length} outbox entries`);
    
    // Process each entry sequentially
    for (const entry of entries) {
      await processOutboxEntry(entry);
    }
  } catch (error) {
    console.error('Error processing outbox batch:', error);
  }
}

/**
 * Start the worker
 */
function startWorker(): void {
  console.log('Starting outbox processor worker');
  
  // Flag to control worker shutdown
  let running = true;
  
  // Function to handle graceful shutdown
  const shutdown = () => {
    console.log('Shutting down outbox processor worker...');
    running = false;
  };
  
  // Register shutdown handlers
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
  // Process loop with backoff for empty queues
  const processLoop = async () => {
    while (running) {
      try {
        const startTime = Date.now();
        
        // Process a batch of entries
        await processBatch();
        
        // Calculate how long processing took
        const processingTime = Date.now() - startTime;
        
        // If processing was fast (queue might be empty), add some delay
        // to avoid hammering the database
        if (processingTime < 100) {
          await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
        } else {
          // Small delay between batches even when queue is busy
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error('Error in process loop:', error);
        // Wait a bit longer on errors to avoid tight error loops
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS * 2));
      }
    }
    
    console.log('Outbox processor worker stopped.');
  };
  
  // Start the processing loop
  processLoop().catch(error => {
    console.error('Fatal error in outbox processor:', error);
    process.exit(1);
  });
}

// If this file is run directly (not imported as a module), start the worker
if (require.main === module) {
  startWorker();
}

export { startWorker }; 