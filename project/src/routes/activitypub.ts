import express from 'express';
import * as activitypubController from '../controllers/activitypub';

const router = express.Router();

// WebFinger endpoint
router.get('/.well-known/webfinger', activitypubController.handleWebFinger);

// ActivityPub actor endpoint
router.get('/users/:username', activitypubController.getActor);

// ActivityPub inbox endpoint
router.post('/users/:username/inbox', activitypubController.handleInbox);

// ActivityPub outbox endpoints
router.get('/users/:username/outbox',  activitypubController.getOutbox);
router.post('/users/:username/outbox', activitypubController.postToOutbox);

export default router;
