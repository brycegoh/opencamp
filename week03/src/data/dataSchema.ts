/**
 * TypeScript type definitions for database tables
 */

/**
 * User account
 */
export interface User {
  id: string; // UUID
  username: string;
  password_hash: string;
  email?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * ActivityPub actor (profile)
 */
export interface Actor {
  id: string; // UUID
  user_id: string; // UUID reference to users.id
  actor_id: string; // ActivityPub ID (URL)
  type: string; // Usually 'Person'
  display_name?: string;
  summary?: string;
  icon_url?: string;
  inbox_url: string;
  outbox_url: string;
  followers_url: string;
  following_url: string;
  public_key?: string;
  private_key?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Location/venue information
 */
export interface Place {
  id: string; // UUID
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  street_address?: string;
  locality?: string;
  region?: string;
  country?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * User check-in at a location
 */
export interface CheckIn {
  id: string; // UUID
  actor_id: string; // UUID reference to actors.id
  place_id: string; // UUID reference to places.id
  content?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  visibility: 'public' | 'followers' | 'private';
  ap_id: string; // ActivityPub ID (URL)
  created_at: Date;
  updated_at: Date;
}

/**
 * Media attachment (photo)
 */
export interface Media {
  id: string; // UUID
  check_in_id: string; // UUID reference to check_ins.id
  url: string;
  media_type: string;
  width?: number;
  height?: number;
  description?: string;
  created_at: Date;
}

/**
 * Follower relationship
 */
export interface Follower {
  id: string; // UUID
  actor_id: string; // UUID reference to actors.id (followed person)
  follower_actor_id: string; // UUID reference to actors.id (follower)
  state: 'pending' | 'accepted' | 'rejected';
  created_at: Date;
  updated_at: Date;
}

/**
 * ActivityPub inbox (incoming activities)
 */
export interface Inbox {
  id: string; // UUID
  actor_id: string; // UUID reference to actors.id
  activity_id: string; // ActivityPub ID
  activity_type: string; // Create, Follow, Like, etc.
  actor: string; // ActivityPub ID of sender
  object?: string; // ActivityPub ID of object
  target?: string; // ActivityPub ID of target
  raw_data: Record<string, any>; // JSONB
  processed: boolean;
  created_at: Date;
}

/**
 * ActivityPub outbox (outgoing activities)
 */
export interface Outbox {
  id: string; // UUID
  actor_id: string; // UUID reference to actors.id
  activity_id: string; // ActivityPub ID
  activity_type: string; // Create, Follow, Like, etc.
  object?: string; // ActivityPub ID of object
  target?: string; // ActivityPub ID of target
  to_recipients?: string[]; // JSONB array of recipient URLs
  cc_recipients?: string[]; // JSONB array of CC recipient URLs
  raw_data: Record<string, any>; // JSONB
  created_at: Date;
  processed: boolean;
}

/**
 * Type for creating a new user
 */
export type NewUser = Omit<User, 'id' | 'created_at' | 'updated_at'>;

/**
 * Type for creating a new actor
 */
export type NewActor = Omit<Actor, 'id' | 'created_at' | 'updated_at'>;

/**
 * Type for creating a new place
 */
export type NewPlace = Omit<Place, 'id' | 'created_at' | 'updated_at'>;

/**
 * Type for creating a new check-in
 */
export type NewCheckIn = Omit<CheckIn, 'id' | 'created_at' | 'updated_at'>;

/**
 * Type for creating new media
 */
export type NewMedia = Omit<Media, 'id' | 'created_at'>;

/**
 * Type for creating a new follower relationship
 */
export type NewFollower = Omit<Follower, 'id' | 'created_at' | 'updated_at'>;

/**
 * Type for creating a new inbox entry
 */
export type NewInbox = Omit<Inbox, 'id' | 'created_at'>;

/**
 * Type for creating a new outbox entry
 */
export type NewOutbox = Omit<Outbox, 'id' | 'created_at'>; 