import { Request, Response } from 'express';
import * as db from '../db';
import * as activitypub from '../utils/activitypub';

const DOMAIN = process.env.DOMAIN || 'http://localhost:3000';

// Create a new user
export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, displayName, summary } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Check if user already exists
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    // Generate key pair for ActivityPub
    const { publicKey, privateKey } = activitypub.generateKeyPair();
    
    // Create user in database
    const user = await db.createUser(
      username,
      displayName || username,
      summary || '',
      DOMAIN,
      publicKey,
      privateKey
    );
    
    // Return user without private key
    const { private_key, ...safeUser } = user;
    
    res.status(201).json(safeUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// Get user profile
export const getUser = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if client is requesting ActivityPub format
    const acceptHeader = req.get('Accept');
    
    if (acceptHeader?.includes('application/activity+json')) {
      // Return ActivityPub actor
      const actor = activitypub.createActorObject(user);
      return res.json(actor);
    }
    
    // Return user profile for API/HTML
    const { private_key, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

// Get user followers
export const getFollowers = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const followers = await db.getFollowers(user.id);
    
    // Check if client is requesting ActivityPub format
    const acceptHeader = req.get('Accept');
    
    if (acceptHeader?.includes('application/activity+json')) {
      // Return ActivityPub collection
      const collection = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Collection',
        id: `${DOMAIN}/users/${username}/followers`,
        totalItems: followers.length,
        items: followers.map((f: { follower_actor_id: string }) => f.follower_actor_id)
      };
      return res.json(collection);
    }
    
    // Return followers for API
    res.json(followers);
  } catch (error) {
    console.error('Error getting followers:', error);
    res.status(500).json({ error: 'Failed to get followers' });
  }
};

// Get user following
export const getFollowing = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const following = await db.getFollowing(user.id);
    
    // Check if client is requesting ActivityPub format
    const acceptHeader = req.get('Accept');
    
    if (acceptHeader?.includes('application/activity+json')) {
      // Return ActivityPub collection
      const collection = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Collection',
        id: `${DOMAIN}/users/${username}/following`,
        totalItems: following.length,
        items: following.map((f: { following_actor_id: string }) => f.following_actor_id)
      };
      return res.json(collection);
    }
    
    // Return following for API
    res.json(following);
  } catch (error) {
    console.error('Error getting following:', error);
    res.status(500).json({ error: 'Failed to get following' });
  }
};

// Handle local unfollow action
export const unfollowUser = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { targetUsername } = req.body;
    
    if (!targetUsername) {
      return res.status(400).json({ error: 'Target username is required' });
    }
    
    // Get user info
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get target user info to construct their actor ID
    const targetUser = await db.getUserByUsername(targetUsername);
    if (!targetUser) {
      // If target user isn't local, construct the actor ID using the provided username
      // This handles remote users
      const targetActorId = req.body.targetActorId || `${DOMAIN}/users/${targetUsername}`;
      await db.removeFollowing(user.id, targetActorId);
      return res.json({ success: true, message: `Unfollowed ${targetUsername}` });
    }
    
    // For local users, use their actual actor ID
    const targetActorId = `${DOMAIN}/users/${targetUsername}`;
    
    // Remove from following list
    await db.removeFollowing(user.id, targetActorId);
    
    res.json({ success: true, message: `Unfollowed ${targetUsername}` });
  } catch (error) {
    console.error('Error handling unfollow:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
};
