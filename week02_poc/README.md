# ActivityPub Bot

Minimal ActivityPub Server that has:
- `webfinger` endpoint for discoverability
- GET and POST `outbox`

## Setup
1. Install dependencies: `npm install`
2. Set your domain in `src/config/index.js`
3. Generate RSA keys if needed via `generate_keys.sh`

## Running the Server
```bash
npm run dev
```

## Endpoints

- `GET /` - Heartbeat
- `GET /.well-known/webfinger` - WebFinger for discovery
- `GET /actor` - ActivityPub actor profile
- `GET /outbox` - List of activities
- `POST /outbox` - Create new activities