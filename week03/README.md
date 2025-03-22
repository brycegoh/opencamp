# ActivityPub Check-ins

A location-based check-in service built on the ActivityPub protocol, similar to Foursquare/Swarm.

## Features

- User accounts with ActivityPub actor profiles
- Location check-ins with GPS coordinates
- Photo uploads for check-ins
- Global timeline of check-ins
- ActivityPub federation (follow users on other servers)

## Database Schema

The database consists of 8 core tables:

1. **users** - Basic user account information
2. **actors** - ActivityPub actor data linked to users
3. **places** - Location/venue data
4. **check_ins** - User check-ins at places
5. **media** - Photos attached to check-ins
6. **followers** - User follow relationships
7. **inbox** - Incoming ActivityPub activities
8. **outbox** - Outgoing ActivityPub activities

## Setup

### Prerequisites

- Node.js 16+
- PostgreSQL 12+

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with database credentials:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=activitypub_checkins
   DB_USER=postgres
   DB_PASSWORD=yourpassword
   ```

### Database Migration

Run the migration to create all required tables:

```bash
npm run migrate
```

To drop all tables and recreate them:

```bash
npm run migrate -- --drop
```

## Running the Application

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

## ActivityPub Implementation

This application implements the ActivityPub protocol as defined in the [W3C Recommendation](https://www.w3.org/TR/activitypub/), including:

- Actor objects with inbox/outbox endpoints
- Check-ins as ActivityPub "Create" + "Note" activities
- Media attachments
- Following/followers collections
- Server-to-server federation