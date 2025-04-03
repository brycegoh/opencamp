import express from 'express';
import * as checkinController from '../controllers/checkin';

const router = express.Router();

// Create check-in
router.post('/', (req, res) => checkinController.createCheckin(req, res));

// Get a check-in by ID
router.get('/:id', (req, res) => checkinController.getCheckin(req, res));

// Get global feed
router.get('/feed/global', (req, res) => checkinController.getGlobalFeed(req, res));

// Get user feed
router.get('/feed/user/:username', (req, res) => checkinController.getUserFeed(req, res));

export default router;
