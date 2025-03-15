import express from 'express';
import { PORT } from './config.js';

// Import routes
import { actor, inbox, outbox, webfinger } from './routes/index.js';

const app = express();
app.use(express.json());

// heartbeat
app.get('/', (req, res) => {
  res.send('Hello World! ActivityPub server is running.');
});

// Register routes
app.use('/actor', actor);
app.use('/inbox', inbox);
app.use('/outbox', outbox);
app.use('/.well-known/webfinger', webfinger);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 