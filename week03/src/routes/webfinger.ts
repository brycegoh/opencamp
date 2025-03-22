import { Router, Request, Response } from 'express';
import { findActorByUsername } from '../data/actors';
import { createWebFingerResponse } from '../data/actors';

const router = Router();

/**
 * WebFinger endpoint for ActivityPub discovery
 * RFC 7033: https://tools.ietf.org/html/rfc7033
 * 
 * This endpoint allows other ActivityPub servers to discover users on this server
 * by their username. It returns links to the user's ActivityPub actor URL.
 */
router.get('/.well-known/webfinger', async (req: Request, res: Response): Promise<void> => {
  const resource = req.query.resource as string;
  
  if (!resource) {
    res.status(400).json({ error: 'Resource parameter is required' });
    return;
  }

  // Parse the resource string to extract username and domain
  // Expected format: acct:username@domain
  const match = resource.match(/^acct:([^@]+)@(.+)$/);
  
  if (!match) {
    res.status(400).json({ error: 'Invalid resource format. Expected acct:username@domain' });
    return;
  }

  const [, username, domain] = match;
  
  // Check if the request is for our domain
  const host = req.get('host') || '';
  const requestDomain = host.split(':')[0]; // Remove port if present
  
  if (domain !== requestDomain) {
    res.status(404).json({ error: 'Resource not found on this server' });
    return;
  }

  try {
    // Find the actor by username
    const actor = await findActorByUsername(username);
    
    if (!actor) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Create WebFinger response
    const response = createWebFingerResponse(resource, actor.actor_id);
    
    // Add proper Content-Type header for WebFinger
    res.set('Content-Type', 'application/jrd+json');
    res.json(response);
  } catch (error) {
    console.error('WebFinger error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 