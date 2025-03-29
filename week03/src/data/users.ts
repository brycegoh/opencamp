import pool from '../db/client';
import { User, NewUser, Actor } from './dataSchema';

/**
 * Find a user by username
 */
export async function findUserByUsername(username: string): Promise<User | null> {
  const result = await pool.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  return result.rows[0] || null;
}

/**
 * Create a new user
 */
export async function createUser(newUser: NewUser): Promise<User> {
  const result = await pool.query(
    `INSERT INTO users (username, password_hash, email)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [newUser.username, newUser.password_hash, newUser.email]
  );
  return result.rows[0];
}

/**
 * Find a user and their actor information
 */
export async function findUserWithActor(username: string): Promise<{ user: User; actor: Actor } | null> {
  const result = await pool.query(
    `SELECT u.*, a.*
     FROM users u
     JOIN actors a ON u.id = a.user_id
     WHERE u.username = $1`,
    [username]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  
  // Split the row into user and actor parts
  const user: User = {
    id: row.id,
    username: row.username,
    password_hash: row.password_hash,
    email: row.email,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
  
  const actor: Actor = {
    id: row.id,
    user_id: row.user_id,
    actor_id: row.actor_id,
    type: row.type,
    display_name: row.display_name,
    summary: row.summary,
    icon_url: row.icon_url,
    inbox_url: row.inbox_url,
    outbox_url: row.outbox_url,
    followers_url: row.followers_url,
    following_url: row.following_url,
    public_key: row.public_key,
    private_key: row.private_key,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
  
  return { user, actor };
} 