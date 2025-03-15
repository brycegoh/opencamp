import express from 'express';
import { ACTOR_URL } from '../config.js';
import { addFollower } from '../store.js';
import { sendActivity } from '../utils/activityPub.js';

const router = express.Router();

// Handle incoming ActivityPub messages
router.post('/', (req, res) => {
  const activity = req.body;
  console.log("Inbox received:", JSON.stringify(activity, null, 2));

  if (activity.type === "Follow") {
    // Add follower and send Accept response
    addFollower(activity.actor);
    console.log(`New follower: ${activity.actor}`);

    // Send an Accept response
    sendActivity(activity.actor, {
      "@context": "https://www.w3.org/ns/activitystreams",
      "id": `${ACTOR_URL}/accept/${Date.now()}`,
      "type": "Accept",
      "actor": ACTOR_URL,
      "object": activity
    });

    return res.status(202).json({ success: true });
  }

  // For other activity types, just acknowledge
  res.status(200).end();
});

export default router; 