# ActivityPub Implementation

This application implements the ActivityPub protocol for decentralized social networking. It allows users to create check-ins at places, share media, and interact with other ActivityPub-compatible servers.

## Endpoints

### WebFinger

The WebFinger endpoint is used for account discovery by remote servers. It allows other servers to find a user's ActivityPub actor URL based on their username.

**Endpoint:** `/.well-known/webfinger`

**Method:** GET

**Parameters:**
- `resource`: The resource to look up, in the format `acct:username@domain`

**Example Request:**
```
GET /.well-known/webfinger?resource=acct:username@example.com
```

**Example Response:**
```json
{
  "subject": "acct:username@example.com",
  "links": [
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://example.com/users/username"
    }
  ]
}
```

### Actor Profile

Each user has an ActivityPub actor profile that describes their identity and capabilities.

**Endpoint:** `/actor` or `/{username}`

**Method:** GET

**Example Response:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://example.com/users/username",
  "type": "Person",
  "name": "Display Name",
  "summary": "Bio or description",
  "inbox": "https://example.com/users/username/inbox",
  "outbox": "https://example.com/users/username/outbox",
  "followers": "https://example.com/users/username/followers",
  "following": "https://example.com/users/username/following",
  "publicKey": {
    "id": "https://example.com/users/username#main-key",
    "owner": "https://example.com/users/username",
    "publicKeyPem": "..."
  }
}
```

### Outbox

The outbox endpoint allows the client to create new activities (check-ins, follows, likes, etc.) and lists a user's public activities.

**Endpoint:** `/{username}/outbox`

**Methods:** GET, POST

### Inbox

The inbox endpoint receives activities from other servers, such as follows, likes, and responses to the user's activities.

**Endpoint:** `/{username}/inbox`

**Method:** POST

## ActivityPub Types

### Check-in

A check-in is represented as a Note with location data:

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Note",
  "content": "Having coffee at this nice place!",
  "location": {
    "type": "Place",
    "name": "Coffee Shop",
    "longitude": -122.419416,
    "latitude": 37.774929
  },
  "attachment": [
    {
      "type": "Image",
      "url": "https://example.com/media/image.jpg",
      "mediaType": "image/jpeg",
      "width": 1200,
      "height": 800
    }
  ]
}
```

## Migration Status

We are currently in the process of migrating the codebase from JavaScript to TypeScript. The following components have been migrated:

- WebFinger endpoint
- ActivityPub types
- Check-in data model

Future work will include migrating the remaining components to TypeScript.

## Testing

The codebase includes comprehensive tests for ensuring functionality works as expected.

### Running Tests

To run the unit tests:

```bash
npm test
```

To run integration tests that use the real database:

```bash
npm run test:real-db
```

### Test Coverage

The following components have test coverage:

1. **WebFinger Endpoint**
   - Unit tests with mocked dependencies to test all response paths
   - Integration tests with real database connections
   - Tests for error handling and edge cases

2. **ActivityPub Outbox**
   - Tests for creating check-ins
   - Tests for following actors
   - Tests for liking objects

3. **HTTP Signatures**
   - Tests for signature verification middleware
   - Tests for different error cases and successful verification

## HTTP Signatures

ActivityPub security relies on HTTP Signatures to authenticate server-to-server communications. This project implements the HTTP Signatures specification as described in [draft-cavage-http-signatures](https://tools.ietf.org/html/draft-cavage-http-signatures).

### Signing Outgoing Requests

When delivering activities to other servers, we sign the request using the actor's private key:

```javascript
import { signRequest } from '../utils/sign';

// When sending to a remote inbox
const headers = signRequest(targetInbox, JSON.stringify(activity));
await fetch(targetInbox, {
  method: 'POST',
  headers: {
    ...headers,
    'Content-Type': 'application/activity+json'
  },
  body: JSON.stringify(activity)
});
```

### Verifying Incoming Requests

All incoming POST requests to our inbox are verified using the sender's public key:

```javascript
import { verifySignature } from '../utils/verify-signature';

// Add signature verification middleware
router.post('/', verifySignature, (req, res) => {
  // Process the verified request
});
```

The verification process:

1. Extracts the keyId from the Signature header
2. Fetches the actor's public key from their profile
3. Verifies the signature using the public key
4. Rejects requests with invalid signatures

This ensures that only legitimate servers can send activities to our instances, preventing spoofing and unauthorized access. 