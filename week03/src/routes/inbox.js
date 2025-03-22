import express from 'express';
import { signRequest } from '../utils/sign.js';
import { verifySignature } from '../utils/verify-signature.js';

const router = express.Router();

/**
 * ActivityPub server-to-server inbox endpoint
 * Receives activities from other servers
 * 
 * This should be properly secured with HTTP signature verification
 * according to the ActivityPub specification
 */

// Add signature verification middleware
router.post('/', verifySignature, (req, res) => {
  try {
    const activity = req.body;
    
    // Log the incoming activity
    console.log('Received activity:', JSON.stringify(activity, null, 2));
    
    // In a real implementation, we would:
    // 1. Validate the activity
    // 2. Store it in the database
    // 3. Process it based on the activity type
    
    res.status(202).json({
      status: 'accepted',
      message: 'Activity received and will be processed'
    });
  } catch (error) {
    console.error('Error processing inbox activity:', error);
    res.status(500).json({ error: 'Failed to process activity' });
  }
});

export default router; 