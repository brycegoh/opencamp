import { pool } from './client';
import { Actor, Activity, Note } from '../types/activitypub';

// User methods
export const createUser = async (
  username: string,
  displayName: string,
  summary: string,
  domain: string,
  publicKey: string,
  privateKey: string
) => {
  const userId = crypto.randomUUID();
  const actorUrl = `${domain}/users/${username}`;
  
  const result = await pool.query(
    `INSERT INTO users (
      id, username, display_name, summary, 
      inbox_url, outbox_url, followers_url, following_url,
      public_key, private_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      userId,
      username,
      displayName,
      summary,
      `${actorUrl}/inbox`,
      `${actorUrl}/outbox`,
      `${actorUrl}/followers`,
      `${actorUrl}/following`,
      publicKey,
      privateKey
    ]
  );
  
  return result.rows[0];
};

export const getUserByUsername = async (username: string) => {
  const result = await pool.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  
  return result.rows[0] || null;
};

export const getUserById = async (id: string) => {
  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  
  return result.rows[0] || null;
};

// Check-in methods
export const createCheckin = async (
  userId: string,
  content: string,
  latitude: number,
  longitude: number,
  locationName: string,
  imageUrl: string,
  apId: string
) => {
  const result = await pool.query(
    `INSERT INTO checkins (
      user_id, content, latitude, longitude, 
      location_name, image_url, ap_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      userId,
      content,
      latitude,
      longitude,
      locationName,
      imageUrl,
      apId
    ]
  );
  
  return result.rows[0];
};

export const getCheckinById = async (id: string) => {
  const result = await pool.query(
    'SELECT * FROM checkins WHERE id = $1',
    [id]
  );
  
  return result.rows[0] || null;
};

export const getCheckinByApId = async (apId: string) => {
  const result = await pool.query(
    'SELECT * FROM checkins WHERE ap_id = $1',
    [apId]
  );
  
  return result.rows[0] || null;
};

export const getGlobalFeed = async (limit = 20, offset = 0) => {
  const result = await pool.query(
    `SELECT c.*, u.username, u.display_name 
     FROM checkins c
     JOIN users u ON c.user_id = u.id
     ORDER BY c.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  
  return result.rows;
};

export const getUserFeed = async (userId: string, limit = 20, offset = 0) => {
  const result = await pool.query(
    `SELECT c.*, u.username, u.display_name 
     FROM checkins c
     JOIN users u ON c.user_id = u.id
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  
  return result.rows;
};

// ActivityPub inbox/outbox methods
export const addInboxItem = async (userId: string, activity: Activity) => {
  const result = await pool.query(
    'INSERT INTO inbox_items (user_id, activity) VALUES ($1, $2) RETURNING *',
    [userId, JSON.stringify(activity)]
  );
  
  return result.rows[0];
};

export const addOutboxItem = async (userId: string, activity: Activity) => {
  const result = await pool.query(
    'INSERT INTO outbox_items (user_id, activity) VALUES ($1, $2) RETURNING *',
    [userId, JSON.stringify(activity)]
  );
  
  return result.rows[0];
};

export const getUnprocessedInboxItems = async (limit = 50) => {
  const result = await pool.query(
    'SELECT * FROM inbox_items WHERE processed = false ORDER BY created_at ASC LIMIT $1',
    [limit]
  );
  
  return result.rows;
};

export const getUnprocessedOutboxItems = async (limit = 50) => {
  const result = await pool.query(
    'SELECT * FROM outbox_items WHERE processed = false ORDER BY created_at ASC LIMIT $1',
    [limit]
  );
  
  return result.rows;
};

export const markInboxItemProcessed = async (id: string) => {
  await pool.query(
    'UPDATE inbox_items SET processed = true WHERE id = $1',
    [id]
  );
};

export const markOutboxItemProcessed = async (id: string) => {
  await pool.query(
    'UPDATE outbox_items SET processed = true WHERE id = $1',
    [id]
  );
};

// Get inbox item by ID
export const getInboxItemById = async (id: string) => {
  const result = await pool.query(
    'SELECT * FROM inbox_items WHERE id = $1',
    [id]
  );
  
  return result.rows[0] || null;
};

// Get outbox item by ID
export const getOutboxItemById = async (id: string) => {
  const result = await pool.query(
    'SELECT * FROM outbox_items WHERE id = $1',
    [id]
  );
  
  return result.rows[0] || null;
};

// Followers/Following methods
export const addFollower = async (userId: string, followerActorId: string, accepted = true) => {
  try {
    const result = await pool.query(
      'INSERT INTO followers (user_id, follower_actor_id, accepted) VALUES ($1, $2, $3) RETURNING *',
      [userId, followerActorId, accepted]
    );
    return result.rows[0];
  } catch (error) {
    // Handle potential duplicate
    if ((error as any).constraint === 'followers_user_id_follower_actor_id_key') {
      const result = await pool.query(
        'UPDATE followers SET accepted = $3 WHERE user_id = $1 AND follower_actor_id = $2 RETURNING *',
        [userId, followerActorId, accepted]
      );
      return result.rows[0];
    }
    throw error;
  }
};

export const addFollowing = async (userId: string, followingActorId: string, accepted = true) => {
  try {
    const result = await pool.query(
      'INSERT INTO following (user_id, following_actor_id, accepted) VALUES ($1, $2, $3) RETURNING *',
      [userId, followingActorId, accepted]
    );
    return result.rows[0];
  } catch (error) {
    // Handle potential duplicate
    if ((error as any).constraint === 'following_user_id_following_actor_id_key') {
      const result = await pool.query(
        'UPDATE following SET accepted = $3 WHERE user_id = $1 AND following_actor_id = $2 RETURNING *',
        [userId, followingActorId, accepted]
      );
      return result.rows[0];
    }
    throw error;
  }
};

export const getFollowers = async (userId: string) => {
  const result = await pool.query(
    'SELECT * FROM followers WHERE user_id = $1 AND accepted = true',
    [userId]
  );
  
  return result.rows;
};

export const getFollowing = async (userId: string) => {
  const result = await pool.query(
    'SELECT * FROM following WHERE user_id = $1 AND accepted = true',
    [userId]
  );
  
  return result.rows;
};

// Remove a follower relationship (when someone unfollows a user)
export const removeFollower = async (userId: string, followerActorId: string) => {
  const result = await pool.query(
    'DELETE FROM followers WHERE user_id = $1 AND follower_actor_id = $2 RETURNING *',
    [userId, followerActorId]
  );
  
  return result.rowCount !== null && result.rowCount > 0;
};

// Remove a following relationship (when a user unfollows someone)
export const removeFollowing = async (userId: string, followingActorId: string) => {
  const result = await pool.query(
    'DELETE FROM following WHERE user_id = $1 AND following_actor_id = $2 RETURNING *',
    [userId, followingActorId]
  );
  
  return result.rowCount !== null && result.rowCount > 0;
};
