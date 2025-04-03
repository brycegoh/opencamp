import { Request, Response } from 'express';
import crypto from 'crypto';
import * as db from '../db';
import * as activitypub from '../utils/activitypub';
import * as rabbitmq from '../rabbitmq/handlers';

const DOMAIN = process.env.DOMAIN || 'http://localhost:3000';

// Create a new check-in
export const createCheckin = async (req: Request, res: Response) => {
  try {
    const { userId, content, latitude, longitude, locationName, imageUrl } = req.body;
    
    if (!userId || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ 
        error: 'UserId, latitude, and longitude are required and must be valid values' 
      });
    }
    
    // Get user
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create check-in with ActivityPub ID
    const apId = `${DOMAIN}/checkins/${crypto.randomUUID()}`;
    
    const checkin = await db.createCheckin(
      userId,
      content || '',
      latitude,
      longitude,
      locationName || '',
      imageUrl || '',
      apId
    );
    
    // Create ActivityPub Note
    const note = activitypub.createNoteObject(checkin, user);
    
    // Create ActivityPub Create activity
    const createActivity = activitypub.createCreateActivity(
      note,
      `${DOMAIN}/users/${user.username}`
    );
    
    // Add to outbox queue
    const outboxItem = await db.addOutboxItem(userId, createActivity);
    
    // Process in background via RabbitMQ
    await rabbitmq.publishToOutbox(userId, createActivity, outboxItem.id);
    
    res.status(201).json(checkin);
  } catch (error) {
    console.error('Error creating check-in:', error);
    res.status(500).json({ error: 'Failed to create check-in' });
  }
};

// Get a check-in by ID
export const getCheckin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const checkin = await db.getCheckinById(id);
    if (!checkin) {
      return res.status(404).json({ error: 'Check-in not found' });
    }
    
    // Get user
    const user = await db.getUserById(checkin.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if client is requesting ActivityPub format
    const acceptHeader = req.get('Accept');
    
    if (acceptHeader?.includes('application/activity+json')) {
      // Return ActivityPub Note
      const note = activitypub.createNoteObject(checkin, user);
      return res.json(note);
    }
    
    // Return check-in for API
    res.json({
      ...checkin,
      username: user.username,
      displayName: user.display_name
    });
  } catch (error) {
    console.error('Error getting check-in:', error);
    res.status(500).json({ error: 'Failed to get check-in' });
  }
};

// Get the global feed
export const getGlobalFeed = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const checkins = await db.getGlobalFeed(limit, offset);
    
    res.json(checkins);
  } catch (error) {
    console.error('Error getting global feed:', error);
    res.status(500).json({ error: 'Failed to get global feed' });
  }
};

// Get a user's feed
export const getUserFeed = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const checkins = await db.getUserFeed(user.id, limit, offset);
    
    // Check if client is requesting ActivityPub format
    const acceptHeader = req.get('Accept');
    
    if (acceptHeader?.includes('application/activity+json')) {
      // Return ActivityPub collection
      const items = await Promise.all(
        checkins.map(async (checkin: any) => {
          return activitypub.createNoteObject(checkin, user);
        })
      );
      
      const collection = {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'OrderedCollection',
        id: `${DOMAIN}/users/${username}/outbox`,
        totalItems: items.length,
        orderedItems: items
      };
      
      return res.json(collection);
    }
    
    // Return user feed for API
    res.json(checkins);
  } catch (error) {
    console.error('Error getting user feed:', error);
    res.status(500).json({ error: 'Failed to get user feed' });
  }
};
