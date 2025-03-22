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
  NewMedia
} from '../../data/types';
import { addToOutbox as addToOutboxDb, createFollower as createFollowerDb } from '../../data/collections';
import { MediaItem, ActivityObject, PlaceData, Activity } from './types';

// User interface for authentication 
interface User {
  username: string;
  id: string;
}

// Extend the Express Request type with our user property
interface AuthenticatedRequest extends Request {
  user: User;
}

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

const addToOutbox = async (outboxItem: any): Promise<void> => {
  // Implementation would insert activity to outbox table
  await addToOutboxDb(outboxItem);
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

// Mock authentication middleware (replace with actual implementation)
const authenticate = (req: Request, res: Response, next: Function): void => {
  // This would normally validate JWT or session
  (req as AuthenticatedRequest).user = { username: 'testuser', id: '123' };
  next();
};

const router = Router();

/**
 * POST /{username}/outbox
 * 
 * Standard ActivityPub client-to-server endpoint for creating activities.
 * This endpoint is compliant with the ActivityPub specification for handling activities like:
 * - Create (for check-ins with location and media)
 * - Follow (to follow other actors)
 * - Like (to like check-ins and other objects)
 */
router.post('/:username/outbox', authenticate, async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  try {
    // Ensure authenticated user matches the username in the URL
    if (authReq.user.username !== authReq.params.username) {
      res.status(403).json({ error: 'Unauthorized to post to this outbox' });
      return;
    }

    // Verify content type is valid for ActivityPub
    const contentType = req.get('Content-Type');
    if (!contentType || 
        !(contentType.includes('application/activity+json') || 
          contentType.includes('application/ld+json'))) {
      res.status(415).json({ 
        error: 'Unsupported Media Type. Expected application/activity+json or application/ld+json'
      });
      return;
    }

    // Get the actor for this user
    const actor = await findActorByUsername(authReq.params.username);
    if (!actor) {
      res.status(404).json({ error: 'Actor not found' });
      return;
    }

    // Parse and validate the activity
    const activity = authReq.body as Activity;
    
    // Basic activity validation
    if (!activity.type) {
      res.status(400).json({ error: 'Invalid activity: missing type' });
      return;
    }

    if (!activity.id) {
      // Generate ID if not provided
      activity.id = `${actor.actor_id}/activities/${uuid()}`;
    }

    // Process based on activity type
    switch (activity.type) {
      case 'Create':
        await handleCreateActivity(authReq, res, actor, activity);
        break;
      
      case 'Follow':
        await handleFollowActivity(authReq, res, actor, activity);
        break;
      
      case 'Like':
        await handleLikeActivity(authReq, res, actor, activity);
        break;
            
      default:
        res.status(400).json({ 
          error: `Unsupported activity type: ${activity.type}` 
        });
    }
  } catch (error) {
    console.error('Error processing outbox activity:', error);
    res.status(500).json({ 
      error: 'Internal server error processing activity'
    });
  }
});

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

  // Process Note as a check-in
  // Extract location data
  if (!object.location || !object.location.type || 
      !object.location.longitude || !object.location.latitude) {
    res.status(400).json({ 
      error: 'Invalid location data. Check-ins require location with longitude and latitude'
    });
    return;
  }

  const location = object.location;

  // Extract place details
  const placeData: PlaceData = {
    name: location.name || 'Unnamed location',
    description: location.description || '',
    latitude: location.latitude,
    longitude: location.longitude,
    street_address: location.streetAddress,
    locality: location.locality,
    region: location.region,
    country: location.country
  };

  // Find or create place in our database
  const place = await findOrCreatePlace(placeData);

  // Process media attachments if any
  const mediaItems: MediaItem[] = [];
  if (object.attachment && Array.isArray(object.attachment)) {
    for (const attachment of object.attachment) {
      if (attachment.type === 'Image' || attachment.type === 'Document') {
        // Each attachment should have a URL that points to already-uploaded media
        mediaItems.push({
          url: attachment.url,
          media_type: attachment.mediaType || 'application/octet-stream',
          width: attachment.width,
          height: attachment.height,
          description: attachment.name || ''
        });
      }
    }
  }

  // Determine visibility from to/cc fields
  const visibility = determineVisibilityFromAudience(object.to, object.cc);

  // Create check-in record
  const checkInData: NewCheckIn = {
    actor_id: actor.id,
    place_id: place.id,
    content: object.content || '',
    latitude: location.latitude,
    longitude: location.longitude,
    altitude: location.altitude,
    visibility: visibility,
    ap_id: object.id
  };
  
  const checkIn = await createCheckIn(checkInData);

  // Add media to check-in
  for (const mediaItem of mediaItems) {
    await addMediaToCheckIn(checkIn.id, mediaItem);
  }

  // Store activity in outbox
  await addToOutbox({
    actor_id: actor.id,
    activity_id: activity.id,
    activity_type: 'Create',
    object: object.id,
    to_recipients: Array.isArray(activity.to || object.to) ? activity.to || object.to : [],
    cc_recipients: Array.isArray(activity.cc || object.cc) ? activity.cc || object.cc : [],
    raw_data: activity
  });

  // Note: Processing of outbox will be handled by a queue in the database
  // processOutboxItem(actor, activity);  <- This is now commented out

  // Return successful response
  res.status(201).json({
    id: activity.id,
    object: object.id
  });
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
    // In a real implementation, you would:
    // 1. Fetch the remote actor profile
    // 2. Store it in your local database if not already there
    // 3. Then create the follower relationship

    // For demo, we'll skip directly to creating the relationship:
    // This would be replaced with actual code in production
    await createFollower(
      'target_actor_id_from_lookup', // This would be obtained by looking up the actor
      actor.id,
      'pending'
    );

    // Store in outbox
    await addToOutbox({
      actor_id: actor.id,
      activity_id: activity.id,
      activity_type: 'Follow',
      object: targetActorUrl,
      to_recipients: Array.isArray(activity.to) ? activity.to : [targetActorUrl],
      cc_recipients: Array.isArray(activity.cc) ? activity.cc : [],
      raw_data: activity
    });

    // Note: Processing of outbox will be handled by a queue in the database
    // processOutboxItem(actor, activity);  <- This is now commented out

    // Return successful response
    res.status(201).json({
      id: activity.id
    });
  } catch (error) {
    console.error('Error processing Follow activity:', error);
    res.status(500).json({ error: 'Failed to process Follow activity' });
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
    // In a complete implementation, we would:
    // 1. Verify the liked object exists (either locally or on a remote server)
    // 2. Store the like in a likes table (not shown in your schema)

    // Store in outbox
    await addToOutbox({
      actor_id: actor.id,
      activity_id: activity.id,
      activity_type: 'Like',
      object: likedObjectUrl,
      to_recipients: Array.isArray(activity.to) ? activity.to : [],
      cc_recipients: Array.isArray(activity.cc) ? activity.cc : [],
      raw_data: activity
    });

    // Note: Processing of outbox will be handled by a queue in the database
    // processOutboxItem(actor, activity);  <- This is now commented out

    // Return successful response
    res.status(201).json({
      id: activity.id
    });
  } catch (error) {
    console.error('Error processing Like activity:', error);
    res.status(500).json({ error: 'Failed to process Like activity' });
  }
}

export default router; 