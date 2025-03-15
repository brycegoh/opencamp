import express from 'express';
import { DOMAIN, ACTOR_URL } from '../config.js';

const router = express.Router();

// WebFinger for discovery
router.get('/', (req, res) => {
  const resource = req.query.resource;
  console.log("WebFinger resource:", resource);
  
  if (resource !== `acct:opencamp@${DOMAIN}`) {
    return res.status(404).json({ error: "User not found" });
  }
  
  const response = {
    subject: `acct:opencamp@${DOMAIN}`,
    links: [
      { 
        rel: "self", 
        type: "application/activity+json", 
        href: ACTOR_URL 
      }
    ]
  };
  
  console.log("WebFinger response:", response);
  res.json(response);
});

export default router; 