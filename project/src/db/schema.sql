-- Schema for location check-in service with ActivityPub support

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255),
  summary TEXT,
  inbox_url TEXT NOT NULL,
  outbox_url TEXT NOT NULL,
  followers_url TEXT NOT NULL,
  following_url TEXT NOT NULL,
  public_key TEXT NOT NULL,
  private_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Check-ins table (ActivityPub Notes with location)
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_name VARCHAR(255),
  image_url TEXT,
  ap_id TEXT UNIQUE NOT NULL,
  ap_context TEXT NOT NULL DEFAULT 'https://www.w3.org/ns/activitystreams',
  ap_published TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ActivityPub inbox items
CREATE TABLE IF NOT EXISTS inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity JSON NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ActivityPub outbox items
CREATE TABLE IF NOT EXISTS outbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity JSON NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Followers tracking
CREATE TABLE IF NOT EXISTS followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  follower_actor_id TEXT NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, follower_actor_id)
);

-- Following tracking
CREATE TABLE IF NOT EXISTS following (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_actor_id TEXT NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, following_actor_id)
);

-- Index for performance optimization
CREATE INDEX IF NOT EXISTS checkins_user_id_idx ON checkins(user_id);
CREATE INDEX IF NOT EXISTS inbox_items_user_id_idx ON inbox_items(user_id);
CREATE INDEX IF NOT EXISTS outbox_items_user_id_idx ON outbox_items(user_id);
CREATE INDEX IF NOT EXISTS followers_user_id_idx ON followers(user_id);
CREATE INDEX IF NOT EXISTS following_user_id_idx ON following(user_id);
