import express from 'express';
import { DOMAIN } from '../config.js';
import { getOutboxItems, addOutboxItem, getFollowers } from '../store.js';
import { sendActivity } from '../utils/activityPub.js';

const router = express.Router();

// GET Outbox - Returns collection of activities
router.get('/', (req, res) => {
  const outboxItems = getOutboxItems();
  
  if (req.query.page === "1") {
    console.log("Outbox requested page 1", outboxItems);
    // Return the first page of posts
    res.setHeader("Content-Type", "application/activity+json");
    return res.json({
      "@context": "https://www.w3.org/ns/activitystreams",
      "id": `https://${DOMAIN}/outbox?page=1`,
      "type": "OrderedCollectionPage",
      "partOf": `https://${DOMAIN}/outbox`,
      "orderedItems": outboxItems
    });
  }

  // Return the outbox collection metadata
  console.log("Outbox collection requested");
  res.setHeader("Content-Type", "application/activity+json");
  res.json({
    "@context": "https://www.w3.org/ns/activitystreams",
    "id": `https://${DOMAIN}/outbox`,
    "type": "OrderedCollection",
    "totalItems": outboxItems.length,
    "first": {
      "id": `https://${DOMAIN}/outbox?page=1`,
      "type": "OrderedCollectionPage"
    }
  });
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