-- Create users table (basic user accounts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create actors table (ActivityPub actors)
CREATE TABLE IF NOT EXISTS actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  actor_id VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'Person',
  display_name VARCHAR(255),
  summary TEXT,
  icon_url VARCHAR(255),
  inbox_url VARCHAR(255) NOT NULL,
  outbox_url VARCHAR(255) NOT NULL,
  followers_url VARCHAR(255) NOT NULL,
  following_url VARCHAR(255) NOT NULL,
  public_key TEXT,
  private_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create places table (locations)
CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  street_address VARCHAR(255),
  locality VARCHAR(255),
  region VARCHAR(255),
  country VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create check_ins table (location check-ins)
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES actors(id) ON DELETE CASCADE,
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  content TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  altitude DECIMAL(10, 2),
  visibility VARCHAR(50) DEFAULT 'public',
  ap_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create media table (photos)
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_id UUID REFERENCES check_ins(id) ON DELETE CASCADE,
  url VARCHAR(255) NOT NULL,
  media_type VARCHAR(100) NOT NULL,
  width INTEGER,
  height INTEGER,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create followers table
CREATE TABLE IF NOT EXISTS followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES actors(id) ON DELETE CASCADE,
  follower_actor_id UUID REFERENCES actors(id) ON DELETE CASCADE,
  state VARCHAR(50) DEFAULT 'accepted',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(actor_id, follower_actor_id)
);

-- Create inbox table
CREATE TABLE IF NOT EXISTS inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES actors(id) ON DELETE CASCADE,
  activity_id VARCHAR(255) NOT NULL,
  activity_type VARCHAR(50) NOT NULL,
  actor VARCHAR(255) NOT NULL,
  object VARCHAR(255),
  target VARCHAR(255),
  raw_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create outbox table
CREATE TABLE IF NOT EXISTS outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES actors(id) ON DELETE CASCADE,
  activity_id VARCHAR(255) NOT NULL,
  activity_type VARCHAR(50) NOT NULL,
  object VARCHAR(255),
  target VARCHAR(255),
  to_recipients TEXT[],
  cc_recipients TEXT[],
  raw_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE
);

-- Create indexes for performance - optimized for CockroachDB
CREATE INDEX IF NOT EXISTS idx_actors_user_id ON actors(user_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_actor_id ON check_ins(actor_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_place_id ON check_ins(place_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_created_at ON check_ins(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_check_in_id ON media(check_in_id);
CREATE INDEX IF NOT EXISTS idx_followers_actor_id ON followers(actor_id);
CREATE INDEX IF NOT EXISTS idx_followers_follower_actor_id ON followers(follower_actor_id);
CREATE INDEX IF NOT EXISTS idx_inbox_actor_id ON inbox(actor_id);
CREATE INDEX IF NOT EXISTS idx_inbox_activity_type ON inbox(activity_type);
CREATE INDEX IF NOT EXISTS idx_outbox_actor_id ON outbox(actor_id);
CREATE INDEX IF NOT EXISTS idx_outbox_activity_type ON outbox(activity_type);
CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON outbox(created_at DESC);

-- Create spatial index for location-based queries
CREATE INDEX IF NOT EXISTS idx_check_ins_location ON check_ins(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_places_location ON places(latitude, longitude);
