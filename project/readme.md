# Requirements
1. Run `npm install`
2. Create a cockroach db cluster on https://cockroachlabs.cloud/
4. Create a RabbitMQ cluster here https://www.cloudamqp.com/
5. Set env vars as follows:
```
DB_URL="postgresql://bryce:super_secure_password@lead-hoatzin-9811.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full"
RABBITMQ_URL="amqps://xshnjfaj:super_secure_password@armadillo.rmq.cloudamqp.com/xshnjfaj"
```

# Running the app
```
npm run dev
```

Then head to `localhost:3000`

# File structure
```
project/
├── src/                      # Backend TypeScript source code
│   ├── index.ts              # Main application entry point
│   ├── controllers/          # Request handlers for routes
│   │   ├── activitypub.ts    # ActivityPub protocol handlers
│   │   ├── checkin.ts        # Check-in functionality 
│   │   └── user.ts           # User management
│   ├── db/                   # Database related code
│   │   ├── client.ts         # DB client setup
│   │   ├── index.ts          # DB operations
│   │   └── schema.sql        # SQL schema definitions
│   ├── rabbitmq/             # Message queue implementation
│   │   ├── client.ts         # RabbitMQ client
│   │   └── handlers.ts       # Message handlers
│   ├── routes/               # API route definitions
│   │   ├── activitypub.ts    # ActivityPub routes
│   │   ├── checkin.ts        # Check-in routes
│   │   └── user.ts           # User routes
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── public/                   # Frontend assets
│   ├── index.html            # Main HTML page
│   ├── app.js                # Frontend JavaScript
│   └── styles.css            # CSS styles
├── package.json              # Project dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── .env                      # Environment variables
```

# RabbitMQ Architecture
The application uses RabbitMQ for reliable asynchronous processing of ActivityPub messages. Here's how it works:

## Queues
- **activitypub-inbox**: Processes incoming activities from remote servers
- **activitypub-outbox**: Delivers outgoing activities to followers' inboxes

## Message Properties
- **Persistence**: Messages are set with `{ persistent: true }` to survive broker restarts
- **Acknowledgements**: Manual acknowledgement mode (`{ noAck: false }`) for reliable processing
- Messages are acknowledged (`channel.ack()`) after successful processing
- Failed messages are negatively acknowledged (`channel.nack()`) and requeued for retry

## Message Flow
1. **Inbox Processing**: 
   - Remote ActivityPub servers send activities to our API
   - Activities are stored in the database and queued to `activitypub-inbox`
   - A consumer processes received activities (Follow, Create, Accept, Undo)
   - For Follow activities, an Accept response is automatically generated

2. **Outbox Processing**:
   - User actions generate activities stored in the database and queued to `activitypub-outbox` 
   - The outbox consumer delivers activities to all follower inboxes
   - Followers' inboxes are discovered via their ActivityPub actor objects