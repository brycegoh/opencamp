import request from 'supertest';
import express from 'express';
import webfingerRouter from '../routes/webfinger';
import pool from '../db/client';
import { v4 as uuid } from 'uuid';

// Setup test app
const app = express();
app.use('/', webfingerRouter);

describe('WebFinger Integration Tests with Real Database', () => {
  // Generate unique test data to avoid conflicts
  const testUserId = uuid();
  const testUsername = `testuser_${uuid().substring(0, 8)}`; // Generate unique username
  const testDomain = 'example.com';
  const testActorId = `https://${testDomain}/users/${testUsername}`;

  // Setup test data and domain mock
  beforeAll(async () => {
    // Mock the host header for domain checking
    app.use((req, res, next) => {
      req.headers.host = `${testDomain}:3000`;
      next();
    });

    // Create a test user in the database
    await pool.query(
      'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)',
      [testUserId, testUsername, 'password-hash-not-important-for-test']
    );

    // Create a test actor in the database
    await pool.query(
      `INSERT INTO actors 
       (user_id, actor_id, type, display_name, inbox_url, outbox_url, followers_url, following_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        testUserId,
        testActorId,
        'Person',
        'Test User',
        `${testActorId}/inbox`,
        `${testActorId}/outbox`,
        `${testActorId}/followers`,
        `${testActorId}/following`
      ]
    );
  });

  // Clean up test data
  afterAll(async () => {
    // Delete test actor and user
    await pool.query('DELETE FROM actors WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);

    // Close database connection
    await pool.end();
  });

  it('should handle missing resource parameter', async () => {
    const response = await request(app)
      .get('/.well-known/webfinger')
      .expect('Content-Type', /json/)
      .expect(400);
    
    expect(response.body).toHaveProperty('error', 'Resource parameter is required');
  });

  it('should handle invalid resource format', async () => {
    const response = await request(app)
      .get('/.well-known/webfinger?resource=invalid-format')
      .expect('Content-Type', /json/)
      .expect(400);
    
    expect(response.body).toHaveProperty('error', 'Invalid resource format. Expected acct:username@domain');
  });

  it('should handle domain mismatch', async () => {
    const response = await request(app)
      .get(`/.well-known/webfinger?resource=acct:${testUsername}@wrong-domain.com`)
      .expect('Content-Type', /json/)
      .expect(404);
    
    expect(response.body).toHaveProperty('error', 'Resource not found on this server');
  });

  it('should handle non-existent user', async () => {
    const response = await request(app)
      .get(`/.well-known/webfinger?resource=acct:nonexistentuser@${testDomain}`)
      .expect('Content-Type', /json/)
      .expect(404);
    
    expect(response.body).toHaveProperty('error', 'User not found');
  });

  it('should return correct WebFinger response for existing user', async () => {
    const resource = `acct:${testUsername}@${testDomain}`;
    
    const response = await request(app)
      .get(`/.well-known/webfinger?resource=${resource}`)
      .expect('Content-Type', 'application/jrd+json; charset=utf-8')
      .expect(200);
    
    // Check response structure
    expect(response.body).toHaveProperty('subject', resource);
    expect(response.body).toHaveProperty('links');
    expect(response.body.links).toHaveLength(1);
    expect(response.body.links[0]).toHaveProperty('rel', 'self');
    expect(response.body.links[0]).toHaveProperty('type', 'application/activity+json');
    expect(response.body.links[0]).toHaveProperty('href', testActorId);
  });
}); 