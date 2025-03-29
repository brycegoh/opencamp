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
import authenticate from '../../middleware/auth';
import { AuthenticatedRequest } from '../../middleware/auth';
import { handleCreateActivity, handleFollowActivity, handleLikeActivity } from './helpers';

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



export default router; 