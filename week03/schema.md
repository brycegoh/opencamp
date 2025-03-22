# Database Schema Documentation

This document outlines the database schema for our ActivityPub-based location check-in service. The application follows the [W3C ActivityPub protocol](https://www.w3.org/TR/activitypub/) to enable federated social interactions around location check-ins, similar to Foursquare/Swarm.

## Core Tables

### users

Stores basic user account information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, automatically generated UUID |
| `username` | VARCHAR(100) | Unique username for login |
| `password_hash` | VARCHAR(255) | Hashed user password |
| `email` | VARCHAR(255) | Optional email address (unique) |
| `created_at` | TIMESTAMP WITH TIME ZONE | Account creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last update timestamp |

### actors

Represents ActivityPub actors (profiles) associated with user accounts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to users.id |
| `actor_id` | VARCHAR(255) | Globally unique ActivityPub ID (URL) |
| `type` | VARCHAR(50) | ActivityPub actor type (default: "Person") |
| `display_name` | VARCHAR(255) | User's display name |
| `summary` | TEXT | Profile bio/description |
| `icon_url` | VARCHAR(255) | Profile picture URL |
| `inbox_url` | VARCHAR(255) | URL to actor's ActivityPub inbox |
| `outbox_url` | VARCHAR(255) | URL to actor's ActivityPub outbox |
| `followers_url` | VARCHAR(255) | URL to actor's followers collection |
| `following_url` | VARCHAR(255) | URL to actor's following collection |
| `public_key` | TEXT | Public key for ActivityPub signatures |
| `private_key` | TEXT | Private key for ActivityPub signatures |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last update timestamp |

### places

Stores location/venue information for check-ins.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | VARCHAR(255) | Name of the location |
| `description` | TEXT | Optional description of the place |
| `latitude` | DECIMAL(10, 8) | Geographic latitude |
| `longitude` | DECIMAL(11, 8) | Geographic longitude |
| `street_address` | VARCHAR(255) | Street address |
| `locality` | VARCHAR(255) | City or locality |
| `region` | VARCHAR(255) | State, province or region |
| `country` | VARCHAR(100) | Country |
| `created_at` | TIMESTAMP WITH TIME ZONE | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last update timestamp |

### check_ins

Records user check-ins at specific locations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `actor_id` | UUID | Foreign key to actors.id |
| `place_id` | UUID | Foreign key to places.id |
| `content` | TEXT | Text content/caption for the check-in |
| `latitude` | DECIMAL(10, 8) | Precise check-in latitude |
| `longitude` | DECIMAL(11, 8) | Precise check-in longitude |
| `altitude` | DECIMAL(10, 2) | Optional altitude information |
| `visibility` | VARCHAR(50) | Privacy setting: "public", "followers", or "private" |
| `ap_id` | VARCHAR(255) | ActivityPub ID for the check-in |
| `created_at` | TIMESTAMP WITH TIME ZONE | Check-in timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last update timestamp |

### media

Stores photos attached to check-ins.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `check_in_id` | UUID | Foreign key to check_ins.id |
| `url` | VARCHAR(255) | URL to the media file |
| `media_type` | VARCHAR(100) | MIME type of the file |
| `width` | INTEGER | Image width in pixels |
| `height` | INTEGER | Image height in pixels |
| `description` | TEXT | Alt text or description of the image |
| `created_at` | TIMESTAMP WITH TIME ZONE | Upload timestamp |

### followers

Tracks follower relationships between actors.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `actor_id` | UUID | Actor being followed (target) |
| `follower_actor_id` | UUID | Actor doing the following |
| `state` | VARCHAR(50) | Relationship state: "pending", "accepted", or "rejected" |
| `created_at` | TIMESTAMP WITH TIME ZONE | Follow request timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last status update timestamp |

## ActivityPub Protocol Tables

### inbox

Stores incoming ActivityPub activities for each actor.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `actor_id` | UUID | Foreign key to the recipient actor |
| `activity_id` | VARCHAR(255) | ActivityPub ID of the activity |
| `activity_type` | VARCHAR(50) | Type of ActivityPub activity (Create, Follow, Like, etc.) |
| `actor` | VARCHAR(255) | ID of the actor who sent the activity |
| `object` | VARCHAR(255) | ID of the object the activity refers to |
| `target` | VARCHAR(255) | Optional target of the activity |
| `raw_data` | JSONB | Complete JSON of the activity |
| `processed` | BOOLEAN | Whether the activity has been processed |
| `created_at` | TIMESTAMP WITH TIME ZONE | Received timestamp |

### outbox

Stores outgoing ActivityPub activities for each actor.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `actor_id` | UUID | Foreign key to the sending actor |
| `activity_id` | VARCHAR(255) | ActivityPub ID of the activity |
| `activity_type` | VARCHAR(50) | Type of ActivityPub activity |
| `object` | VARCHAR(255) | ID of the object the activity refers to |
| `target` | VARCHAR(255) | Optional target of the activity |
| `to_recipients` | JSONB | Primary recipients of the activity |
| `cc_recipients` | JSONB | Secondary recipients (CC) |
| `raw_data` | JSONB | Complete JSON of the activity |
| `created_at` | TIMESTAMP WITH TIME ZONE | Created timestamp |

## Database Indexes

The following indexes are created to optimize query performance:

- `idx_actors_user_id`: Index on actors.user_id
- `idx_check_ins_actor_id`: Index on check_ins.actor_id
- `idx_check_ins_place_id`: Index on check_ins.place_id
- `idx_check_ins_created_at`: Descending index on check_ins.created_at
- `idx_media_check_in_id`: Index on media.check_in_id
- `idx_followers_actor_id`: Index on followers.actor_id
- `idx_followers_follower_actor_id`: Index on followers.follower_actor_id
- `idx_inbox_actor_id`: Index on inbox.actor_id
- `idx_inbox_activity_type`: Index on inbox.activity_type
- `idx_outbox_actor_id`: Index on outbox.actor_id
- `idx_outbox_activity_type`: Index on outbox.activity_type
- `idx_outbox_created_at`: Descending index on outbox.created_at
- `idx_check_ins_location`: Spatial index on check_ins(latitude, longitude)
- `idx_places_location`: Spatial index on places(latitude, longitude)

## ActivityPub Data Flow

1. When a user creates a check-in, a record is added to the `check_ins` table and an ActivityPub "Create" activity is added to that user's `outbox`.
2. The server delivers this activity to all the user's followers by adding entries to their `inbox` tables.
3. When another user follows someone, a "Follow" activity is created in their `outbox` and delivered to the target user's `inbox`.
4. The target user can respond with an "Accept" activity from their `outbox` to the follower's `inbox`, and a record is added to the `followers` table.

This schema supports the core ActivityPub client-to-server and server-to-server protocols while providing the specialized features needed for a location check-in service. 