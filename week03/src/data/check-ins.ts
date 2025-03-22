import pool from '../db/client';
import { 
  CheckIn, 
  NewCheckIn,
  Media,
  NewMedia,
  Actor,
  Place 
} from './types';
import { placeToJsonLd } from './places';

// Type definition for ActivityPub Note object
export type ActivityPubNote = {
  '@context': string;
  id: string;
  type: string;
  attributedTo?: string;
  content?: string;
  published: string;
  location: any;
  attachment?: any[];
  to?: string[];
  cc?: string[];
};

/**
 * Create a new check-in
 */
export async function createCheckIn(newCheckIn: NewCheckIn): Promise<CheckIn> {
  const result = await pool.query(
    `INSERT INTO check_ins
     (actor_id, place_id, content, latitude, longitude, altitude, visibility, ap_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      newCheckIn.actor_id,
      newCheckIn.place_id,
      newCheckIn.content,
      newCheckIn.latitude,
      newCheckIn.longitude,
      newCheckIn.altitude,
      newCheckIn.visibility,
      newCheckIn.ap_id
    ]
  );
  return result.rows[0];
}

/**
 * Add media to a check-in
 */
export async function addMediaToCheckIn(checkInId: string, newMedia: NewMedia): Promise<Media> {
  const result = await pool.query(
    `INSERT INTO media
     (check_in_id, url, media_type, width, height, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      checkInId,
      newMedia.url,
      newMedia.media_type,
      newMedia.width,
      newMedia.height,
      newMedia.description
    ]
  );
  return result.rows[0];
}

/**
 * Find a check-in by its ActivityPub ID
 */
export async function findCheckInByApId(apId: string): Promise<CheckIn | null> {
  const result = await pool.query(
    'SELECT * FROM check_ins WHERE ap_id = $1',
    [apId]
  );
  return result.rows[0] || null;
}

/**
 * Get a check-in with its associated media
 */
export async function getCheckInWithMedia(checkInId: string): Promise<{ checkIn: CheckIn, media: Media[] }> {
  // Get the check-in
  const checkInResult = await pool.query(
    'SELECT * FROM check_ins WHERE id = $1',
    [checkInId]
  );
  
  if (checkInResult.rows.length === 0) {
    throw new Error(`Check-in not found: ${checkInId}`);
  }
  
  const checkIn = checkInResult.rows[0];
  
  // Get associated media
  const mediaResult = await pool.query(
    'SELECT * FROM media WHERE check_in_id = $1',
    [checkInId]
  );
  
  return {
    checkIn,
    media: mediaResult.rows
  };
}

/**
 * Get check-ins for an actor (for their outbox)
 */
export async function getCheckInsForActor(
  actorId: string,
  limit: number = 20,
  offset: number = 0
): Promise<CheckIn[]> {
  const result = await pool.query(
    `SELECT * FROM check_ins 
     WHERE actor_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [actorId, limit, offset]
  );
  return result.rows;
}

/**
 * Convert Media to ActivityPub Attachment
 */
export function mediaToJsonLd(media: Media): any {
  return {
    'type': 'Image',
    'url': media.url,
    'mediaType': media.media_type,
    'width': media.width,
    'height': media.height,
    'name': media.description
  };
}

/**
 * Convert a Check-in with associated data to ActivityPub Note
 */
export function checkInToJsonLd(
  checkIn: CheckIn, 
  place: Place, 
  media: Media[] = [], 
  actor?: Actor
): ActivityPubNote {
  const note: ActivityPubNote = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': checkIn.ap_id,
    'type': 'Note',
    'attributedTo': actor ? actor.actor_id : undefined,
    'content': checkIn.content,
    'published': checkIn.created_at.toISOString(),
    'location': {
      ...placeToJsonLd(place),
      'latitude': checkIn.latitude,
      'longitude': checkIn.longitude,
      'altitude': checkIn.altitude
    }
  };

  // Add any media attachments
  if (media.length > 0) {
    note.attachment = media.map(mediaToJsonLd);
  }

  // Add audience targeting based on visibility
  if (checkIn.visibility === 'public') {
    note.to = ['https://www.w3.org/ns/activitystreams#Public'];
    if (actor) {
      note.cc = [actor.followers_url];
    }
  } else if (checkIn.visibility === 'followers' && actor) {
    note.to = [actor.followers_url];
  }

  return note;
} 