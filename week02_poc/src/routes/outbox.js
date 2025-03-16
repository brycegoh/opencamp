import express from 'express';
import { DOMAIN } from '../config.js';
import { getOutboxItems, addOutboxItem, getFollowers } from '../store.js';
import { sendActivity } from '../utils/activityPub.js';

const router = express.Router();

// GET Outbox - Returns collection of activities
router.get('/', (req, res) => {
  console.log("Outbox GET request:", {
    headers: req.headers,
    query: req.query
  });
  
  const outboxItems = getOutboxItems();
  
  if (req.query.page === "true") {
    console.log("Outbox requested page, returning", outboxItems.length, "items");
    // Return the page of posts
    res.setHeader("Content-Type", "application/activity+json");
    
    const response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      "id": `https://${DOMAIN}/outbox?page=true`,
      "type": "OrderedCollectionPage",
      "partOf": `https://${DOMAIN}/outbox`,
      "orderedItems": outboxItems
    };
    
    console.log("Sending response for page:", JSON.stringify(response, null, 2));
    return res.json(response);
  }

  // Return the outbox collection metadata
  console.log("Outbox collection requested, total items:", outboxItems.length);
  
  const response = {
    "@context": "https://www.w3.org/ns/activitystreams",
    "id": `https://${DOMAIN}/outbox`,
    "type": "OrderedCollection",
    "totalItems": outboxItems.length,
    "first": `https://${DOMAIN}/outbox?page=true`,
    "last": `https://${DOMAIN}/outbox?min_id=0&page=true`
  };
  
  console.log("Sending outbox collection response:", JSON.stringify(response, null, 2));
  
  res.setHeader("Content-Type", "application/activity+json");
  res.json(response);
});

// POST to Outbox - Creates and stores a new activity
router.post('/', (req, res) => {
  const activity = req.body;
  console.log("Outbox received:", JSON.stringify(activity, null, 2));

  if (activity.type !== "Create" || !activity.object || activity.object.type !== "Note") {
    return res.status(400).json({ error: "Invalid activity" });
  }

  // Add activity to outbox collection
  addOutboxItem(activity);

  // Send to all followers
  const followers = getFollowers();
  followers.forEach(inbox => sendActivity(inbox, activity));

  res.status(201).json({ success: true });
});

export default router; 