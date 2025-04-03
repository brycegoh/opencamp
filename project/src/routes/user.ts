import express from 'express';
import * as userController from '../controllers/user';

const router = express.Router();

// Create user
router.post('/', (req, res) => userController.createUser(req, res));

// Get user profile
router.get('/:username', (req, res) => userController.getUser(req, res));

// Get user followers
router.get('/:username/followers', (req, res) => userController.getFollowers(req, res));

// Get user following
router.get('/:username/following', (req, res) => userController.getFollowing(req, res));

// Unfollow a user
router.post('/:username/unfollow', (req, res) => userController.unfollowUser(req, res));

export default router;
