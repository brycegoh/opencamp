import { Request, Response } from 'express';
import * as db from '../db';
import * as activitypub from '../utils/activitypub';
import * as rabbitmq from '../rabbitmq/handlers';

// Handle actor profile requests
export const getActor = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    // Find user
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate ActivityPub actor object
    const actor = activitypub.createActorObject(user);
    
    res.json(actor);
  } catch (error) {
    console.error('Error handling actor request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Handle WebFinger requests
export const handleWebFinger = async (req: Request, res: Response) => {
  try {
    const resource = req.query.resource as string;
    if (!resource) {
      return res.status(400).json({ error: 'Resource parameter is required' });
    }
    
    const parsed = activitypub.parseWebfingerResource(resource);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid resource format' });
    }
    
    const { username, domain } = parsed;
    
    // Check if this is our domain
    const ourDomain = process.env.DOMAIN || 'localhost:3000';
    if (domain !== ourDomain) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Find user
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    // Generate WebFinger response
    const webfinger = activitypub.generateWebfinger(username);
    
    res.json(webfinger);
  } catch (error) {
    console.error('Error handling WebFinger request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Handle inbox requests
export const handleInbox = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    // Find user
    let user = await db.getUserByUsername(username);
    if (!user) {
      const DOMAIN = process.env.DOMAIN || 'localhost:3000';
      const { publicKey, privateKey } = activitypub.generateKeyPair();
      
      user = await db.createUser(
        username,
        username,
        'Remote ActivityPub user',
        DOMAIN,
        publicKey,
        privateKey
      );
      
      console.log(`Created local representation for remote user ${username}`);
    }
    
    // Store activity in database
    const activity = req.body;
    
    const inboxItem = await db.addInboxItem(user.id, activity);
    console.log(`Created inbox item with ID: ${inboxItem.id}`);
    
    // Process via RabbitMQ - only pass the database row ID
    await rabbitmq.publishToInbox(user.id, inboxItem.id);
    
    res.status(202).json({ status: 'Accepted' });
  } catch (error) {
    console.error('Error handling inbox request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Handle outbox requests (GET)
export const getOutbox = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    // Find user
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user's checkins
    const checkins = await db.getUserFeed(user.id, 20, 0);
    
    // Convert to ActivityPub collection
    const items = await Promise.all(
      checkins.map(async (checkin: any) => {
        const note = activitypub.createNoteObject(checkin, user);
        return activitypub.createCreateActivity(
          note,
          `${process.env.DOMAIN || 'http://localhost:3000'}/users/${user.username}`
        );
      })
    );
    
    const collection = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'OrderedCollection',
      id: `${process.env.DOMAIN || 'http://localhost:3000'}/users/${username}/outbox`,
      totalItems: items.length,
      orderedItems: items
    };
    
    res.json(collection);
  } catch (error) {
    console.error('Error handling outbox request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Handle outbox requests (POST)
export const postToOutbox = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    console.log(`Processing outbox request for user ${username}`);
    
    // Find user
    const user = await db.getUserByUsername(username);
    console.log(`Found user: ${user}`);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Store activity in database
    const activity = req.body;

    console.log(`Activity: ${activity}`);
    
    // Validate the activity has the required fields
    if (!activity || !activity.type || !activity.actor || !activity.object) {
      console.error('Invalid activity format:', activity);
      return res.status(400).json({ error: 'Invalid activity format. Required fields: type, actor, object' });
    }
    
    // Ensure activity is properly stringified when saved
    const outboxItem = await db.addOutboxItem(user.id, activity);
    console.log(`Created outbox item with ID: ${outboxItem.id}`);
    
    // Process via RabbitMQ - only pass the database row ID
    await rabbitmq.publishToOutbox(user.id, outboxItem.id);
    
    res.status(202).json({ status: 'Accepted' });
  } catch (error) {
    console.error('Error handling outbox request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
