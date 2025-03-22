import pool from '../db/client';
import { 
  Inbox, 
  NewInbox, 
  Outbox, 
  NewOutbox, 
  Follower 
} from './types';

//
// Outbox operations
//

/**
 * Add an activity to an actor's outbox
 */
export async function addToOutbox(newOutboxItem: NewOutbox): Promise<Outbox> {
  console.log(`Adding to outbox 222`, newOutboxItem.to_recipients);
  const result = await pool.query(
    `INSERT INTO outbox
     (actor_id, activity_id, activity_type, object, target, 
      to_recipients, cc_recipients, raw_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      newOutboxItem.actor_id,
      newOutboxItem.activity_id,
      newOutboxItem.activity_type,
      newOutboxItem.object,
      newOutboxItem.target,
      newOutboxItem.to_recipients,
      newOutboxItem.cc_recipients,
      newOutboxItem.raw_data
    ]
  );
  return result.rows[0];
}

/**
 * Get actor's outbox activities
 */
export async function getOutbox(
  actorId: string,
  limit: number = 20,
  offset: number = 0
): Promise<Outbox[]> {
  const result = await pool.query(
    `SELECT * FROM outbox 
     WHERE actor_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [actorId, limit, offset]
  );
  return result.rows;
}

/**
 * Count total items in actor's outbox
 */
export async function countOutboxItems(actorId: string): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) FROM outbox WHERE actor_id = $1',
    [actorId]
  );
  return parseInt(result.rows[0].count, 10);
}

//
// Inbox operations
//

/**
 * Add an activity to an actor's inbox
 */
export async function addToInbox(newInboxItem: NewInbox): Promise<Inbox> {
  const result = await pool.query(
    `INSERT INTO inbox
     (actor_id, activity_id, activity_type, actor, object, target, raw_data, processed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      newInboxItem.actor_id,
      newInboxItem.activity_id,
      newInboxItem.activity_type,
      newInboxItem.actor,
      newInboxItem.object,
      newInboxItem.target,
      newInboxItem.raw_data,
      newInboxItem.processed || false
    ]
  );
  return result.rows[0];
}

/**
 * Get actor's inbox activities
 */
export async function getInbox(
  actorId: string,
  limit: number = 20,
  offset: number = 0
): Promise<Inbox[]> {
  const result = await pool.query(
    `SELECT * FROM inbox 
     WHERE actor_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [actorId, limit, offset]
  );
  return result.rows;
}

/**
 * Count total items in actor's inbox
 */
export async function countInboxItems(actorId: string): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) FROM inbox WHERE actor_id = $1',
    [actorId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Mark inbox item as processed
 */
export async function markInboxItemProcessed(inboxItemId: string): Promise<void> {
  await pool.query(
    'UPDATE inbox SET processed = true WHERE id = $1',
    [inboxItemId]
  );
}

//
// Follower operations
//

/**
 * Create a new follower relationship
 */
export async function createFollower(
  actorId: string,
  followerActorId: string,
  state: 'pending' | 'accepted' | 'rejected' = 'pending'
): Promise<Follower> {
  const result = await pool.query(
    `INSERT INTO followers
     (actor_id, follower_actor_id, state)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [actorId, followerActorId, state]
  );
  return result.rows[0];
}

/**
 * Update follower relationship state
 */
export async function updateFollowerState(
  actorId: string,
  followerActorId: string,
  state: 'pending' | 'accepted' | 'rejected'
): Promise<Follower | null> {
  const result = await pool.query(
    `UPDATE followers
     SET state = $3, updated_at = CURRENT_TIMESTAMP
     WHERE actor_id = $1 AND follower_actor_id = $2
     RETURNING *`,
    [actorId, followerActorId, state]
  );
  return result.rows[0] || null;
}

/**
 * Get actor's followers
 */
export async function getFollowers(
  actorId: string,
  state: 'pending' | 'accepted' | 'rejected' = 'accepted',
  limit: number = 20,
  offset: number = 0
): Promise<Follower[]> {
  const result = await pool.query(
    `SELECT * FROM followers
     WHERE actor_id = $1 AND state = $2
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [actorId, state, limit, offset]
  );
  return result.rows;
}

/**
 * Get actors that a user is following
 */
export async function getFollowing(
  followerActorId: string,
  state: 'pending' | 'accepted' | 'rejected' = 'accepted',
  limit: number = 20,
  offset: number = 0
): Promise<Follower[]> {
  const result = await pool.query(
    `SELECT * FROM followers
     WHERE follower_actor_id = $1 AND state = $2
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [followerActorId, state, limit, offset]
  );
  return result.rows;
}

/**
 * Count follower relationships
 */
export async function countFollowers(actorId: string, state: string = 'accepted'): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) FROM followers WHERE actor_id = $1 AND state = $2',
    [actorId, state]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Count following relationships
 */
export async function countFollowing(followerActorId: string, state: string = 'accepted'): Promise<number> {
  const result = await pool.query(
    'SELECT COUNT(*) FROM followers WHERE follower_actor_id = $1 AND state = $2',
    [followerActorId, state]
  );
  return parseInt(result.rows[0].count, 10);
}

//
// Collection JSON-LD conversions
//

/**
 * Create an outbox collection (OrderedCollection)
 */
export function createOutboxCollection(
  actorId: string,
  totalItems: number,
  pageSize: number = 20
): any {
  const lastPage = Math.ceil(totalItems / pageSize);
  
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `${actorId}/outbox`,
    'type': 'OrderedCollection',
    'totalItems': totalItems,
    'first': `${actorId}/outbox?page=1`,
    'last': `${actorId}/outbox?page=${lastPage > 0 ? lastPage : 1}`
  };
}

/**
 * Create an outbox page (OrderedCollectionPage)
 */
export function createOutboxPage(
  actorId: string,
  page: number,
  totalPages: number,
  items: any[]
): any {
  const result: any = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `${actorId}/outbox?page=${page}`,
    'type': 'OrderedCollectionPage',
    'partOf': `${actorId}/outbox`,
    'orderedItems': items
  };
  
  if (page < totalPages) {
    result.next = `${actorId}/outbox?page=${page + 1}`;
  }
  
  if (page > 1) {
    result.prev = `${actorId}/outbox?page=${page - 1}`;
  }
  
  return result;
}

/**
 * Create a followers collection
 */
export function createFollowersCollection(
  actorId: string,
  followers: string[]
): any {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `${actorId}/followers`,
    'type': 'Collection',
    'totalItems': followers.length,
    'items': followers
  };
}

/**
 * Create a following collection
 */
export function createFollowingCollection(
  actorId: string,
  following: string[]
): any {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `${actorId}/following`,
    'type': 'Collection',
    'totalItems': following.length,
    'items': following
  };
} 