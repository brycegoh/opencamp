import express from 'express';

const PORT = 3000;

// Import routes
import activitypubRoutes from './routes/activitypub/routeHandlers';
import { webfingerRouter } from './routes/activitypub';

const app = express();

// Configure middleware
app.use(express.json({
  type: ['application/json', 'application/activity+json', 'application/ld+json']
}));

// Heartbeat route
app.get('/', (req, res) => {
  res.send('Hello World! ActivityPub server is running.');
});

app.use('/', webfingerRouter); 
app.use('/', activitypubRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 