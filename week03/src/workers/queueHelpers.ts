import { Pool, PoolClient } from 'pg';

/**
 * Fetch a batch of unprocessed items from the queue using FOR UPDATE SKIP LOCKED pattern
 * 
 * @param pool Database connection pool
 * @param tableName Table to use as queue
 * @param batchSize Number of items to fetch
 * @param idColumn Primary key column name
 * @param processedColumn Column that tracks processed state
 * @param orderColumn Column to order results by
 * @returns Array of queue items
 */
export async function fetchQueueBatch<T>(
  pool: Pool,
  tableName: string,
  batchSize: number,
  idColumn = 'id',
  processedColumn = 'processed',
  orderColumn = 'created_at'
): Promise<T[]> {
  const client = await pool.connect();
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    // Select and lock rows for processing using FOR UPDATE SKIP LOCKED
    // This ensures reliable queue processing in a distributed environment
    const result = await client.query(
      `SELECT * FROM ${tableName} 
       WHERE ${processedColumn} = false 
       ORDER BY ${orderColumn} ASC 
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [batchSize]
    );
    
    if (result.rows.length > 0) {
      // Mark these rows as processing
      const ids = result.rows.map(row => row[idColumn]);
      await client.query(
        `UPDATE ${tableName} 
         SET ${processedColumn} = true
         WHERE ${idColumn} = ANY($1)`,
        [ids]
      );
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    return result.rows;
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error fetching queue entries:', error);
    return [];
  } finally {
    client.release();
  }
}

/**
 * Mark an item as unprocessed (for retrying failed items)
 * 
 * @param pool Database connection pool
 * @param tableName Table to use as queue
 * @param id ID of the item to mark as unprocessed
 * @param idColumn Primary key column name
 * @param processedColumn Column that tracks processed state
 */
export async function markQueueItemForRetry(
  pool: Pool,
  tableName: string,
  id: string,
  idColumn = 'id',
  processedColumn = 'processed'
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE ${tableName} 
       SET ${processedColumn} = false 
       WHERE ${idColumn} = $1`,
      [id]
    );
  } finally {
    client.release();
  }
}

/**
 * Begin a transaction for processing
 * 
 * @param pool Database connection pool
 * @returns Client with active transaction
 */
export async function beginTransaction(pool: Pool): Promise<PoolClient> {
  const client = await pool.connect();
  await client.query('BEGIN');
  return client;
}

/**
 * Commit a transaction
 * 
 * @param client Client with active transaction
 */
export async function commitTransaction(client: PoolClient): Promise<void> {
  try {
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

/**
 * Rollback a transaction
 * 
 * @param client Client with active transaction
 */
export async function rollbackTransaction(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
} 