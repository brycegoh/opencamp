import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Get the connection string from the environment variables
const connectionString = process.env.DB_URL;

if (!connectionString) {
  console.error('Database connection string not found in environment variables');
  process.exit(1);
}

// Create a new pool instance
export const pool = new pg.Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test the connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Database connection successful');
  }
});

export default pool;