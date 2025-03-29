import { Router, Request, Response } from 'express';
import { findActorByUsername } from '../../data/actors';
import { findOrCreatePlace } from '../../data/places';
import { createCheckIn, addMediaToCheckIn as addMediaToCheckInDb } from '../../data/check-ins';
import { v4 as uuid } from 'uuid';
import { 
  Actor, 
  CheckIn,
  Place,
  Media,
  NewCheckIn,
  NewMedia,
  User
} from '../../data/dataSchema';
import { addToOutbox as addToOutboxDb, createFollower as createFollowerDb } from '../../data/collections';
import { MediaItem, ActivityObject, PlaceData, Activity } from './types';
import { AuthenticatedRequest } from '../../middleware/auth';

type Visibility = 'public' | 'followers' | 'private';

// Mock function implementations (replace with actual implementations)
const addMediaToCheckIn = async (checkInId: string, mediaItem: MediaItem): Promise<void> => {
  // Implementation would insert media record to database
  const newMedia: NewMedia = {
    check_in_id: checkInId,
    url: mediaItem.url,
    media_type: mediaItem.media_type,
    width: mediaItem.width,
    height: mediaItem.height,
    description: mediaItem.description
  };
  await addMediaToCheckInDb(checkInId, newMedia);
};

const createFollower = async (targetActorId: string, followerActorId: string, state: string): Promise<void> => {
  // Implementation would create a follower relationship
  await createFollowerDb(targetActorId, followerActorId, state as 'pending' | 'accepted' | 'rejected');
};

// Function to determine visibility from to/cc fields
const determineVisibilityFromAudience = (to?: string[], cc?: string[]): Visibility => {
  const publicUrl = 'https://www.w3.org/ns/activitystreams#Public';
  
  // If explicitly public, mark as public
  if ((to && to.includes(publicUrl)) || (cc && cc.includes(publicUrl))) {
    return 'public';
  }
  
  // If to/cc contains followers collection URLs, mark as followers-only
  if ((to && to.some(url => url.includes('/followers'))) || 
      (cc && cc.some(url => url.includes('/followers')))) {
    return 'followers';
  }
  
  // Default to private if only specific recipients
  return 'private';
};

/**
 * Handle Create activities (primarily for check-ins)
 */
async function handleCreateActivity(
  req: AuthenticatedRequest, 
  res: Response, 
  actor: Actor, 
  activity: Activity
): Promise<void> {
  // Validate it's a proper Create activity with an object
  if (!activity.object || typeof activity.object === 'string') {
    res.status(400).json({ error: 'Invalid Create activity: missing object data' });
    return;
  }

  const object = activity.object as ActivityObject;

  // If ID wasn't specified for the object
  if (!object.id) {
    object.id = `${actor.actor_id}/objects/${uuid()}`;
    activity.object.id = object.id;
  }

  // Check object type - for us, the main type is Note (for check-ins)
  if (object.type !== 'Note') {
    res.status(400).json({ 
      error: 'Only Note objects are supported for Create activities' 
    });
    return;
  }

  // Validate location data is present
  if (!object.location || !object.location.type || 
      !object.location.longitude || !object.location.latitude) {
    res.status(400).json({ 
      error: 'Invalid location data. Check-ins require location with longitude and latitude'
    });
    return;
  }

  try {
    // Store activity in outbox without processing
    await addToOutboxDb({
      actor_id: actor.id,
      activity_id: activity.id,
      activity_type: 'Create',
      object: object.id,
      to_recipients: Array.isArray(activity.to || object.to) ? activity.to || object.to : [],
      cc_recipients: Array.isArray(activity.cc || object.cc) ? activity.cc || object.cc : [],
      raw_data: activity,
      processed: false
    });

    // Return 202 Accepted (will be processed asynchronously)
    res.status(202).json({
      id: activity.id,
      object: object.id,
      status: 'queued'
    });
  } catch (error) {
    console.error('Error queueing Create activity:', error);
    res.status(500).json({ error: 'Failed to queue Create activity' });
  }
}

/**
 * Handle Follow activities
 */
async function handleFollowActivity(
  req: AuthenticatedRequest, 
  res: Response, 
  actor: Actor, 
  activity: Activity
): Promise<void> {
  // Validate required fields
  if (!activity.object) {
    res.status(400).json({ error: 'Invalid Follow activity: missing object' });
    return;
  }

  // The object of a Follow activity should be an actor's URL
  const targetActorUrl = typeof activity.object === 'string' 
    ? activity.object 
    : activity.object.id;

  if (!targetActorUrl) {
    res.status(400).json({ error: 'Invalid Follow activity: missing target actor URL' });
    return;
  }

  try {
    // Store in outbox for async processing
    await addToOutboxDb({
      actor_id: actor.id,
      activity_id: activity.id,
      activity_type: 'Follow',
      object: targetActorUrl,
      to_recipients: Array.isArray(activity.to) ? activity.to : [targetActorUrl],
      cc_recipients: Array.isArray(activity.cc) ? activity.cc : [],
      raw_data: activity,
      processed: false
    });

    // Return 202 Accepted (will be processed asynchronously)
    res.status(202).json({
      id: activity.id,
      status: 'queued'
    });
  } catch (error) {
    console.error('Error queueing Follow activity:', error);
    res.status(500).json({ error: 'Failed to queue Follow activity' });
  }
}

/**
 * Handle Like activities
 */
async function handleLikeActivity(
  req: AuthenticatedRequest, 
  res: Response, 
  actor: Actor, 
  activity: Activity
): Promise<void> {
  // Validate required fields
  if (!activity.object) {
    res.status(400).json({ error: 'Invalid Like activity: missing object' });
    return;
  }

  // The object of a Like activity should be the ID of the liked object
  const likedObjectUrl = typeof activity.object === 'string' 
    ? activity.object 
    : activity.object.id;

  if (!likedObjectUrl) {
    res.status(400).json({ error: 'Invalid Like activity: missing liked object URL' });
    return;
  }

  try {
    // Store in outbox for async processing
    await addToOutboxDb({
      actor_id: actor.id,
      activity_id: activity.id,
      activity_type: 'Like',
      object: likedObjectUrl,
      to_recipients: Array.isArray(activity.to) ? activity.to : [],
      cc_recipients: Array.isArray(activity.cc) ? activity.cc : [],
      raw_data: activity,
      processed: false
    });

    // Return 202 Accepted (will be processed asynchronously)
    res.status(202).json({
      id: activity.id,
      status: 'queued'
    });
  } catch (error) {
    console.error('Error queueing Like activity:', error);
    res.status(500).json({ error: 'Failed to queue Like activity' });
  }
}

export {
  handleCreateActivity,
  handleFollowActivity,
  handleLikeActivity
};