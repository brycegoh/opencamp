# Transactional Queue Architecture for ActivityPub

This document outlines the queue architecture used for processing ActivityPub activities in our application.

## Overview

Instead of processing ActivityPub activities synchronously when they arrive, we use a transactional queue-based approach with CockroachDB. This architecture provides several benefits:

1. **Reliability**: Activities are never lost, even if a worker crashes during processing
2. **Concurrency**: Multiple workers can safely process queue items in parallel
3. **Scalability**: Processing can be distributed across many machines
4. **Performance**: API requests return quickly, with processing happening asynchronously

## Transactional Queue Pattern

We implement the queue using CockroachDB's transactional capabilities, specifically the `FOR UPDATE SKIP LOCKED` pattern. This pattern is ideal for reliable queue processing:

1. **Select FOR UPDATE**: Locks rows to prevent other workers from processing them
2. **SKIP LOCKED**: Prevents workers from waiting on rows being processed by others
3. **Transactional processing**: Ensures atomicity - either the processing completes successfully or gets retried

## Components

Our architecture consists of these key components:

1. **API Handlers**: Validate and queue incoming ActivityPub activities
2. **Queue Functions**: Set of stateless functions that implement the transactional queue pattern
3. **Worker Process**: Processes activities from the queue
4. **Helper Functions**: Perform the actual business logic for each activity type

## Flow Diagram

```
Client ---> API Handlers ---> Store in outbox (processed=false)
                              |
                              v
                            CockroachDB Queue
                              |
                              v
Workers --> fetchQueueBatch() --> Process items --> Mark as processed
             (SELECT FOR UPDATE SKIP LOCKED)
```

## Implementation Details

### Queue Operations

1. **Queue Item Insertion**:
   - API handlers validate activities and store them in the outbox table with `processed = false`
   - Return 202 Accepted with "queued" status

2. **Queue Item Retrieval**:
   - Workers use `fetchQueueBatch()` which performs a transactional `SELECT FOR UPDATE SKIP LOCKED` to fetch and lock items
   - Items are marked as `processed = true` within the same transaction

3. **Processing**:
   - Each activity is processed within its own transaction
   - Failed processing results in transaction rollback and the item is marked for retry

4. **Retries**:
   - Failed items are marked as `processed = false` using `markQueueItemForRetry()` function

## Core Queue Functions

Our queue implementation uses pure functions instead of classes:

1. `fetchQueueBatch()`: Retrieves a batch of items using FOR UPDATE SKIP LOCKED pattern
2. `markQueueItemForRetry()`: Marks a failed item for retry
3. `beginTransaction()`: Starts a database transaction
4. `commitTransaction()`: Commits a transaction
5. `rollbackTransaction()`: Rolls back a transaction

## Error Handling

The system handles errors gracefully:

1. **Transaction Rollback**: If processing fails, changes are rolled back
2. **Automatic Retries**: Failed items remain in the queue for retry
3. **Logging**: Error details are logged for troubleshooting

## Running the Worker

The worker can be started using:

```bash
# In development
npm run worker

# In production
NODE_ENV=production node scripts/worker.js
```

## Distributed Deployment

For high-throughput scenarios:

1. The outbox queue can be distributed across CockroachDB nodes
2. Multiple worker instances can be deployed across different machines
3. Each worker will only process items that aren't being processed by others

## Future Improvements

1. **Dead-Letter Queue**: Move repeatedly failing items to a separate queue
2. **Priority Queues**: Implement priority levels for different activity types
3. **Monitoring Dashboard**: Create a dashboard for queue statistics
4. **Rate Limiting**: Add rate limiting to prevent overwhelming the system 