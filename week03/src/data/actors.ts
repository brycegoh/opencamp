import pool from '../db/client';
import { Actor, NewActor } from './types';

//
// Database operations
//

/**
 * Find an actor by username
 */
export async function findActorByUsername(username: string): Promise<Actor | null> {
  const result = await pool.query(
    `SELECT a.* FROM actors a
     JOIN users u ON a.user_id = u.id
     WHERE u.username = $1`,
    [username]
  );
  return result.rows[0] || null;
}

/**
 * Find an actor by ActivityPub ID (actor_id)
 */
export async function findActorById(actorId: string): Promise<Actor | null> {
  const result = await pool.query(
    'SELECT * FROM actors WHERE actor_id = $1',
    [actorId]
  );
  return result.rows[0] || null;
}

/**
 * Create a new actor
 */
export async function createActor(userId: string, newActor: NewActor): Promise<Actor> {
  const result = await pool.query(
    `INSERT INTO actors 
     (user_id, actor_id, type, display_name, summary, icon_url, 
      inbox_url, outbox_url, followers_url, following_url, 
      public_key, private_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      userId,
      newActor.actor_id,
      newActor.type,
      newActor.display_name,
      newActor.summary,
      newActor.icon_url,
      newActor.inbox_url,
      newActor.outbox_url,
      newActor.followers_url,
      newActor.following_url,
      newActor.public_key,
      newActor.private_key
    ]
  );
  return result.rows[0];
}

//
// JSON-LD conversions
//

/**
 * Convert an Actor to ActivityPub JSON-LD format
 */
export function actorToJsonLd(actor: Actor): any {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': actor.actor_id,
    'type': actor.type,
    'name': actor.display_name,
    'summary': actor.summary,
    'icon': actor.icon_url ? {
      'type': 'Image',
      'url': actor.icon_url
    } : undefined,
    'inbox': actor.inbox_url,
    'outbox': actor.outbox_url,
    'followers': actor.followers_url,
    'following': actor.following_url,
    'publicKey': {
      'id': `${actor.actor_id}#main-key`,
      'owner': actor.actor_id,
      'publicKeyPem': actor.public_key
    }
  };
}

/**
 * Create a WebFinger response
 */
export function createWebFingerResponse(
  resource: string, 
  actorId: string
): any {
  return {
    'subject': resource,
    'links': [
      {
        'rel': 'self',
        'type': 'application/activity+json',
        'href': actorId
      }
    ]
  };
} 