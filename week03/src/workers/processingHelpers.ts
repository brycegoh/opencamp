import { Actor } from '../data/dataSchema';
import { findOrCreatePlace } from '../data/places';
import { createCheckIn, addMediaToCheckIn as addMediaToCheckInDb } from '../data/check-ins';
import { createFollower } from '../data/collections';
import { ActivityObject, PlaceData, MediaItem, Activity } from '../routes/activitypub/types';

/**
 * Function to determine visibility from to/cc fields
 */
export function determineVisibilityFromAudience(to?: string[], cc?: string[]): 'public' | 'followers' | 'private' {
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
}

/**
 * Add media to check-in
 */
export async function addMediaToCheckIn(checkInId: string, mediaItem: MediaItem): Promise<void> {
  await addMediaToCheckInDb(checkInId, {
    check_in_id: checkInId,
    url: mediaItem.url,
    media_type: mediaItem.media_type,
    width: mediaItem.width,
    height: mediaItem.height,
    description: mediaItem.description || ''
  });
}

/**
 * Process a Create activity
 */
export async function processCreateActivity(actor: Actor, activity: Activity): Promise<void> {
  const object = activity.object as ActivityObject;
  
  if (!object.location) {
    throw new Error('Location data missing in Create activity');
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
  const visibility = determineVisibilityFromAudience(
    Array.isArray(object.to) ? object.to : undefined,
    Array.isArray(object.cc) ? object.cc : undefined
  );

  // Create check-in record
  const checkInData = {
    actor_id: actor.id,
    place_id: place.id,
    content: object.content || '',
    latitude: location.latitude,
    longitude: location.longitude,
    altitude: location.altitude,
    visibility: visibility,
    ap_id: object.id || ''  // Ensure ap_id is not undefined
  };
  
  const checkIn = await createCheckIn(checkInData);

  // Add media to check-in
  for (const mediaItem of mediaItems) {
    await addMediaToCheckIn(checkIn.id, mediaItem);
  }

  console.log(`Processed Create activity: ${activity.id}, created check-in: ${checkIn.id}`);
}

/**
 * Process a Follow activity
 */
export async function processFollowActivity(actor: Actor, activity: Activity): Promise<void> {
  const targetActorUrl = typeof activity.object === 'string' 
    ? activity.object 
    : activity.object.id;

  if (!targetActorUrl) {
    throw new Error('Target actor URL missing in Follow activity');
  }

  // In a real implementation, this would:
  // 1. Fetch the remote actor profile via HTTP if not in our database
  // 2. Store it in the local database if new
  // 3. Then create the follower relationship

  // For demo purposes, we'll create a placeholder ID
  // In a real app, you would look up or create the actor here
  const targetActorId = 'target_actor_id_from_lookup'; 

  await createFollower(targetActorId, actor.id, 'pending');
  
  console.log(`Processed Follow activity: ${activity.id}, actor: ${actor.id} following: ${targetActorId}`);
}

/**
 * Process a Like activity
 */
export async function processLikeActivity(actor: Actor, activity: Activity): Promise<void> {
  const likedObjectUrl = typeof activity.object === 'string' 
    ? activity.object 
    : activity.object.id;

  if (!likedObjectUrl) {
    throw new Error('Liked object URL missing in Like activity');
  }

  // In a complete implementation, you would:
  // 1. Verify the liked object exists (either locally or on a remote server)
  // 2. Store the like in a likes table (which is not shown in the provided schema)
  
  console.log(`Processed Like activity: ${activity.id}, actor: ${actor.id} liked: ${likedObjectUrl}`);
} 