import express from "express";
import dotenv from "dotenv";
import { pool } from "./db/client";
import * as rabbitmqHandlers from "./rabbitmq/handlers";
import cors from "cors";
import path from 'path';

// Import routes
import activityPubRoutes from "./routes/activitypub";
import userRoutes from "./routes/user";
import checkinRoutes from "./routes/checkin";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files from public directory

// Add JSON-LD content type support
app.use((req, res, next) => {
  if (req.headers['content-type'] === 'application/activity+json' ||
      req.headers['content-type'] === 'application/ld+json') {
    req.headers['content-type'] = 'application/json';
  }
  next();
});

// Set up response headers for ActivityPub
app.use((req, res, next) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Digest, Signature');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // Handle ActivityPub Accept header
  const acceptHeader = req.get('Accept');
  if (acceptHeader?.includes('application/activity+json')) {
    res.type('application/activity+json');
  }
  
  next();
});

// Basic route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// API Routes
app.use('/', activityPubRoutes); // For WebFinger discovery
app.use('/api/users', userRoutes);
app.use('/api/checkins', checkinRoutes);

// ActivityPub Routes (duplicated for proper content negotiation)
app.use('/', activityPubRoutes);

// Initialize RabbitMQ handlers
const initializeRabbitMQ = async () => {
  try {
    // Connect to RabbitMQ
    await rabbitmqHandlers.connectRabbitMQ();
    
    // Start consumers
    await rabbitmqHandlers.startInboxConsumer();
    await rabbitmqHandlers.startOutboxConsumer();
    
    console.log('RabbitMQ handlers initialized');
  } catch (error) {
    console.error('Failed to initialize RabbitMQ handlers:', error);
  }
};

// Start the server
const startServer = async () => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');
    
    // Initialize RabbitMQ
    await initializeRabbitMQ();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Server initialization error:', error);
    process.exit(1);
  }
};

startServer();
