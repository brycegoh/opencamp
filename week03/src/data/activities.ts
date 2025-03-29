import { Actor } from './dataSchema';
import { ActivityPubNote } from './check-ins';

/**
 * Create a Create Activity for a Check-in
 */
export function createActivityForCheckIn(
  actor: Actor,
  checkInObject: ActivityPubNote
): any {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `${actor.actor_id}/activities/${Date.now()}`,
    'type': 'Create',
    'actor': actor.actor_id,
    'object': checkInObject,
    'published': new Date().toISOString(),
    'to': checkInObject.to,
    'cc': checkInObject.cc
  };
}

/**
 * Create a Follow Activity
 */
export function createFollowActivity(actor: Actor, targetActorId: string): any {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `${actor.actor_id}/activities/follow/${Date.now()}`,
    'type': 'Follow',
    'actor': actor.actor_id,
    'object': targetActorId,
    'published': new Date().toISOString()
  };
}

/**
 * Create an Accept Activity (for Follow requests)
 */
export function createAcceptActivity(actor: Actor, followActivity: any): any {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `${actor.actor_id}/activities/accept/${Date.now()}`,
    'type': 'Accept',
    'actor': actor.actor_id,
    'object': followActivity,
    'published': new Date().toISOString()
  };
}

/**
 * Create a Like Activity
 */
export function createLikeActivity(actor: Actor, objectId: string): any {
  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `${actor.actor_id}/activities/like/${Date.now()}`,
    'type': 'Like',
    'actor': actor.actor_id,
    'object': objectId,
    'published': new Date().toISOString()
  };
} 