import express from 'express';
import { actor } from '../store.js';

const router = express.Router();

// Serve the Actor JSON
router.get('/', (req, res) => {
  console.log("Actor requested", actor);
  res.setHeader("Content-Type", "application/activity+json");
  res.json(actor);
});

export default router; 