# ActivityPub Integration Plan for Location Check-in Service

This document outlines the implementation plan for integrating our location check-in service with the ActivityPub protocol, focusing on check-in creation and timeline functionality.

## 1. Required Endpoints

### Client-to-Server Endpoints

We'll implement the standard ActivityPub client-to-server protocol for all interactions:

1. **Activity Creation** (Standard ActivityPub)
   - `POST /{username}/outbox` - Standard ActivityPub endpoint for creating activities
   - Used for creating check-ins with location data and media
   - Accepts `application/activity+json` or `application/ld+json`
   - Request body should contain a properly formatted ActivityPub Create activity with:
     - A Note object containing:
       - Content/caption text
       - Location property with coordinates and place details
       - Attachment array for media files (with proper URLs)
       - Audience targeting (to/cc) for visibility control
   - For multi-part uploads with media:
     - Client should first upload media to a media endpoint
     - Then reference those media URLs in the Create activity
   - This endpoint will handle:
     - Validating the ActivityPub structure
     - Extracting location and media data
     - Creating the check-in record in our database
     - Adding to user's outbox
     - Federating to followers

### ActivityPub Protocol Endpoints

These endpoints implement the required functionality for ActivityPub. The actual URL paths are implementation choices, not protocol requirements. Based on the W3C recommendation examples:

1. **Actor Endpoint**
   - `GET /{username}` - Retrieve ActivityPub actor profile
     - Example from spec: `https://social.example/alyssa/`
     - Used by both clients (profile display) and servers (federation discovery)

2. **Core Collection Endpoints** (Required by ActivityPub spec)
   - `GET /{username}/outbox` - Get user's outbox collection
     - Example from spec: `https://social.example/alyssa/outbox/`
     - Contains activities (including check-ins) created by the user
     - Can be paginated for large collections
   
   - `POST /{username}/outbox` - Client-to-server endpoint for creating new activities
     - Standard ActivityPub approach for all content creation
     - Processes check-ins, likes, follows, and all other activities
     - Clients must follow ActivityPub format guidelines
   
   - `GET /{username}/inbox` - Get user's inbox collection
     - Example from spec: `https://social.example/alyssa/inbox/`
     - Contains activities received from other actors
   
   - `POST /{username}/inbox` - Receive activities from other servers
     - Primary server-to-server communication channel
     - How remote servers deliver activities to our users
   
   - `GET /{username}/followers` - Collection of actors following this user
     - Example from spec: `https://social.example/alyssa/followers/`
     - Required property in actor object
     - May be private depending on user settings
   
   - `GET /{username}/following` - Collection of actors this user follows
     - Example from spec: `https://social.example/alyssa/following/`
     - Required property in actor object
   
   - `GET /{username}/liked` - Collection of objects this user has liked
     - Example from spec: `https://social.example/alyssa/liked/`
     - Required property in actor object

3. **Media Upload Endpoint** (Supporting ActivityPub)
   - `POST /media` - Upload media files separately
     - Returns media URLs that can be referenced in ActivityPub objects
     - Not part of the ActivityPub spec but necessary for practical implementation
     - Accepts `multipart/form-data` for efficient file uploads

4. **Object Retrieval**
   - `GET /objects/{id}` - Get a specific object (e.g., check-in) as an ActivityPub object
     - Serves check-in content to both clients and remote servers

5. **WebFinger Discovery (Required Standard Endpoint)**
   - `GET /.well-known/webfinger` - For actor discovery
     - Only endpoint with a standardized URL path in the federation ecosystem
     - Used by remote servers to locate users on our service

## 2. Implementation Logic

This section outlines the steps for implementing each key ActivityPub operation using our helper functions and database schema.

### User Registration and Actor Creation

**Sequence:**

1. Create user record:
   ```typescript
   const user = await createUser(newUser);
   ```

2. Generate ActivityPub URLs for the new actor:
   ```typescript
   const domain = "example.com";
   const actorId = `https://${domain}/users/${user.username}`;
   const inboxUrl = `${actorId}/inbox`;
   const outboxUrl = `${actorId}/outbox`;
   const followersUrl = `${actorId}/followers`;
   const followingUrl = `${actorId}/following`;
   ```

3. Generate key pair for ActivityPub signatures:
   ```typescript
   const { publicKey, privateKey } = generateKeyPair();
   ```

4. Create actor record:
   ```typescript
   const newActor = {
     actor_id: actorId,
     type: "Person",
     display_name: user.username,
     inbox_url: inboxUrl,
     outbox_url: outboxUrl,
     followers_url: followersUrl,
     following_url: followingUrl,
     public_key: publicKey,
     private_key: privateKey
   };
   const actor = await createActor(user.id, newActor);
   ```

### Actor Profile Retrieval

**Sequence:**

1. Find actor by username:
   ```typescript
   const actor = await findActorByUsername(username);
   ```

2. Convert actor to ActivityPub JSON-LD format:
   ```typescript
   const actorJson = actorToJsonLd(actor);
   ```

3. Return with proper content type:
   ```typescript
   res.setHeader('Content-Type', 'application/activity+json');
   res.json(actorJson);
   ```

### WebFinger Discovery

**Sequence:**

1. Parse the resource parameter (e.g., `acct:username@domain`):
   ```typescript
   const resource = req.query.resource;
   const match = resource.match(/acct:([^@]+)@(.+)/);
   const username = match[1];
   ```

2. Find the user:
   ```typescript
   const actor = await findActorByUsername(username);
   ```

3. Generate WebFinger response:
   ```typescript
   const webfinger = createWebFingerResponse(resource, actor.actor_id);
   ```

4. Return response:
   ```typescript
   res.json(webfinger);
   ```

### Check-in Creation (via Outbox)

**Sequence:**

1. Parse and validate the incoming ActivityPub Create activity:
   ```typescript
   const activity = req.body;
   
   // Validate it's a proper Create activity with a Note object
   if (activity.type !== 'Create' || !activity.object || activity.object.type !== 'Note') {
     return res.status(400).json({ error: 'Invalid activity format' });
   }
   
   // Extract the Note object
   const note = activity.object;
   ```

2. Extract location data from the Note:
   ```typescript
   // Location should be formatted according to ActivityStreams spec
   const location = note.location;
   if (!location || !location.type || !location.longitude || !location.latitude) {
     return res.status(400).json({ error: 'Invalid location data' });
   }
   
   // Extract place details
   const placeData = {
     name: location.name || 'Unnamed location',
     description: location.description || '',
     latitude: location.latitude,
     longitude: location.longitude,
     // Additional address fields if available
     street_address: location.streetAddress,
     locality: location.locality,
     region: location.region,
     country: location.country
   };
   ```

3. Find or create place:
   ```typescript
   const place = await findOrCreatePlace(placeData);
   ```

4. Process media attachments:
   ```typescript
   const mediaItems = [];
   
   if (note.attachment && Array.isArray(note.attachment)) {
     for (const attachment of note.attachment) {
       if (attachment.type === 'Image' || attachment.type === 'Document') {
         // Each attachment should have a URL that points to already-uploaded media
         mediaItems.push({
           url: attachment.url,
           media_type: attachment.mediaType,
           width: attachment.width,
           height: attachment.height,
           description: attachment.name || ''
         });
       }
     }
   }
   ```

5. Create check-in record with ActivityPub ID:
   ```typescript
   // Use client-provided ID if available, or generate one
   const apId = note.id || `https://example.com/objects/${uuid.v4()}`;
   
   // Determine visibility from to/cc fields
   const visibility = determineVisibilityFromAudience(note.to, note.cc);
   
   const newCheckIn = {
     actor_id: actor.id,
     place_id: place.id,
     content: note.content || '',
     latitude: location.latitude,
     longitude: location.longitude,
     altitude: location.altitude,
     visibility: visibility,
     ap_id: apId
   };
   
   const checkIn = await createCheckIn(newCheckIn);
   ```

6. Add media to check-in:
   ```typescript
   for (const mediaItem of mediaItems) {
     await addMediaToCheckIn(checkIn.id, mediaItem);
   }
   ```

7. Update the activity and note with server-assigned IDs:
   ```typescript
   // Ensure the note has our canonical ID
   if (!note.id) {
     note.id = apId;
     activity.object.id = apId;
   }
   
   // Assign ID to the activity itself if not provided
   if (!activity.id) {
     activity.id = `${apId}/activity`;
   }
   ```

8. Add to outbox:
   ```typescript
   await addToOutbox({
     actor_id: actor.id,
     activity_id: activity.id,
     activity_type: 'Create',
     object: note.id,
     to_recipients: activity.to,
     cc_recipients: activity.cc,
     raw_data: activity
   });
   ```

9. Process for federation to followers:
   ```typescript
   // This will be handled by the outbox processing logic
   processOutboxItem(actor, activity);
   ```

10. Return successful response:
    ```typescript
    res.status(201).json({
      id: activity.id,
      object: note.id
    });
    ```

### Following Another Actor

**Sequence:**

1. Identify the target actor:
   ```typescript
   const targetActor = await findActorById(targetActorId);
   ```

2. Create a Follow activity:
   ```typescript
   const followActivity = createFollowActivity(sourceActor, targetActorId);
   ```

3. Add to outbox:
   ```typescript
   await addToOutbox({
     actor_id: sourceActor.id,
     activity_id: followActivity.id,
     activity_type: 'Follow',
     object: targetActorId,
     raw_data: followActivity
   });
   ```

4. Create pending follower relationship:
   ```typescript
   await createFollower(targetActor.id, sourceActor.id, 'pending');
   ```

5. Deliver Follow activity to target actor's inbox (federation)

### Accepting a Follow Request

**Sequence:**

1. Find the Follow activity in inbox:
   ```typescript
   const inboxItem = await getInboxItem(inboxItemId);
   const followActivity = inboxItem.raw_data;
   ```

2. Create Accept activity:
   ```typescript
   const acceptActivity = createAcceptActivity(targetActor, followActivity);
   ```

3. Update follower state:
   ```typescript
   await updateFollowerState(targetActor.id, followerActorId, 'accepted');
   ```

4. Add Accept activity to outbox:
   ```typescript
   await addToOutbox({
     actor_id: targetActor.id,
     activity_id: acceptActivity.id,
     activity_type: 'Accept',
     object: followActivity.id,
     raw_data: acceptActivity
   });
   ```

5. Deliver Accept activity to follower's inbox (federation)

6. Mark original inbox item as processed:
   ```typescript
   await markInboxItemProcessed(inboxItemId);
   ```

### Retrieving Outbox Collection

**Sequence:**

1. Find actor and count items:
   ```typescript
   const actor = await findActorByUsername(username);
   const totalItems = await countOutboxItems(actor.id);
   ```

2. Generate collection response:
   ```typescript
   // For collection (first request)
   const collection = createOutboxCollection(actor.actor_id, totalItems);
   
   // For collection page (with items)
   const page = parseInt(req.query.page) || 1;
   const pageSize = 20;
   const totalPages = Math.ceil(totalItems / pageSize);
   const offset = (page - 1) * pageSize;
   
   const outboxItems = await getOutbox(actor.id, pageSize, offset);
   const items = outboxItems.map(item => item.raw_data);
   
   const collectionPage = createOutboxPage(actor.actor_id, page, totalPages, items);
   ```

3. Return with proper content type:
   ```typescript
   res.setHeader('Content-Type', 'application/activity+json');
   res.json(collection); // or collectionPage
   ```

### Retrieving Followers Collection

**Sequence:**

1. Find actor and count followers:
   ```typescript
   const actor = await findActorByUsername(username);
   const totalItems = await countFollowers(actor.id, 'accepted');
   ```

2. Get follower IDs:
   ```typescript
   const followers = await getFollowers(actor.id, 'accepted');
   const followerIds = await Promise.all(followers.map(async (follower) => {
     const followerActor = await findActorById(follower.follower_actor_id);
     return followerActor.actor_id;
   }));
   ```

3. Generate collection response:
   ```typescript
   const collection = createFollowersCollection(actor.actor_id, followerIds);
   ```

4. Return with proper content type:
   ```typescript
   res.setHeader('Content-Type', 'application/activity+json');
   res.json(collection);
   ```

### Processing Incoming Activities

**Sequence:**

1. Validate signature and request:
   ```typescript
   const activity = req.body;
   const isValid = validateSignature(req);
   if (!isValid) {
     return res.status(401).json({ error: 'Invalid signature' });
   }
   ```

2. Find target actor:
   ```typescript
   const targetActor = await findActorByUsername(username);
   ```

3. Add to inbox:
   ```typescript
   await addToInbox({
     actor_id: targetActor.id,
     activity_id: activity.id,
     activity_type: activity.type,
     actor: activity.actor,
     object: activity.object.id || activity.object,
     raw_data: activity,
     processed: false
   });
   ```

4. Process based on activity type:
   ```typescript
   switch (activity.type) {
     case 'Follow':
       // Handle follow request
       break;
     case 'Accept':
       // Handle accept (of follow)
       break;
     case 'Create':
       // Handle new content
       break;
     // etc.
   }
   ```

### Liking a Check-in

**Sequence:**

1. Create Like activity:
   ```typescript
   const likeActivity = createLikeActivity(actor, checkInId);
   ```

2. Add to outbox:
   ```typescript
   await addToOutbox({
     actor_id: actor.id,
     activity_id: likeActivity.id,
     activity_type: 'Like',
     object: checkInId,
     raw_data: likeActivity
   });
   ```

3. Deliver to the check-in owner's inbox (federation)

## 3. Processing Logic

This section separates and details the specific logic for processing items in outbox and inbox queues.

### Outbox Processing Logic

Outbox processing is triggered whenever a new activity is added to an actor's outbox. The primary purpose is to deliver activities to followers' inboxes.

#### 1. Processing New Outbox Items

```typescript
async function processOutboxItem(outboxItemId: string): Promise<void> {
  // Retrieve the outbox item
  const outboxItem = await getOutboxItemById(outboxItemId);
  if (!outboxItem) {
    throw new Error(`Outbox item not found: ${outboxItemId}`);
  }
  
  // Get the actor who created the activity
  const actor = await findActorById(outboxItem.actor_id);
  
  // Determine recipients based on to/cc fields
  const recipients = await determineRecipients(outboxItem);
  
  // Deliver to each recipient
  for (const recipientUrl of recipients) {
    await deliverActivity(actor, recipientUrl, outboxItem.raw_data);
  }
}
```

#### 2. Determining Recipients

```typescript
async function determineRecipients(outboxItem: Outbox): Promise<string[]> {
  const recipients = new Set<string>();
  
  // Add explicit recipients from to/cc fields
  if (outboxItem.to_recipients) {
    for (const recipient of outboxItem.to_recipients) {
      if (recipient !== 'https://www.w3.org/ns/activitystreams#Public') {
        recipients.add(recipient);
      }
    }
  }
  
  if (outboxItem.cc_recipients) {
    for (const recipient of outboxItem.cc_recipients) {
      if (recipient !== 'https://www.w3.org/ns/activitystreams#Public') {
        recipients.add(recipient);
      }
    }
  }
  
  // If public, add all followers
  if (outboxItem.to_recipients?.includes('https://www.w3.org/ns/activitystreams#Public') ||
      outboxItem.cc_recipients?.includes('https://www.w3.org/ns/activitystreams#Public')) {
    const actor = await findActorById(outboxItem.actor_id);
    if (actor.followers_url.endsWith('/followers')) {
      // Get all followers
      const followers = await getFollowers(actor.id, 'accepted');
      for (const follower of followers) {
        const followerActor = await findActorById(follower.follower_actor_id);
        recipients.add(followerActor.inbox_url);
      }
    }
  }
  
  return Array.from(recipients);
}
```

#### 3. Delivering Activities to Remote Servers

```typescript
async function deliverActivity(
  sourceActor: Actor, 
  targetInbox: string, 
  activity: any
): Promise<void> {
  try {
    // Convert activity to JSON string
    const body = JSON.stringify(activity);
    
    // Use the sign utility from src/utils/sign.js
    const headers = signRequest(targetInbox, body);
    
    // Send activity to remote inbox
    const response = await fetch(targetInbox, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/activity+json'
      },
      body
    });
    
    console.log(`Delivered activity to ${targetInbox}, status: ${response.status}`);
    
    if (!response.ok) {
      // Log failure but continue (don't throw) to process other recipients
      console.error(`Delivery to ${targetInbox} failed with status ${response.status}`);
    }
  } catch (error) {
    // Log failure and retry later
    console.error(`Failed to deliver activity to ${targetInbox}:`, error);
    // Add to retry queue
  }
}
```

### Inbox Processing Logic

Inbox processing handles incoming activities from other servers. Each activity type requires specific handling.

#### 1. Processing New Inbox Items

```typescript
async function processInboxItem(inboxItemId: string): Promise<void> {
  // Retrieve the inbox item
  const inboxItem = await getInboxItemById(inboxItemId);
  if (!inboxItem || inboxItem.processed) {
    return;
  }
  
  // Process based on activity type
  const activity = inboxItem.raw_data;
  const actor = await findActorById(inboxItem.actor_id);
  
  try {
    switch (inboxItem.activity_type) {
      case 'Create':
        await processCreateActivity(actor, activity);
        break;
      case 'Follow':
        await processFollowActivity(actor, activity, inboxItem);
        break;
      case 'Accept':
        await processAcceptActivity(actor, activity);
        break;
      case 'Like':
        await processLikeActivity(actor, activity);
        break;
      // Add other activity types as needed
      default:
        console.log(`Unhandled activity type: ${inboxItem.activity_type}`);
    }
    
    // Mark as processed
    await markInboxItemProcessed(inboxItemId);
  } catch (error) {
    console.error(`Error processing inbox item ${inboxItemId}:`, error);
    // Add retry logic if needed
  }
}
```

#### 2. Processing Follow Activities

```typescript
async function processFollowActivity(
  targetActor: Actor,
  activity: any,
  inboxItem: Inbox
): Promise<void> {
  // Find or fetch the follower actor
  let followerActor = await findActorById(activity.actor);
  if (!followerActor) {
    // Fetch from remote server if not in our database
    followerActor = await fetchRemoteActor(activity.actor);
    // Store in database (simplified)
    // followerActor = await storeRemoteActor(actorData);
  }
  
  // Create follower relationship (pending)
  await createFollower(targetActor.id, followerActor.id, 'pending');
  
  // If auto-accept follows is enabled for this user
  if (await shouldAutoAcceptFollow(targetActor)) {
    // Generate Accept activity
    const acceptActivity = createAcceptActivity(targetActor, activity);
    
    // Add to outbox
    await addToOutbox({
      actor_id: targetActor.id,
      activity_id: acceptActivity.id,
      activity_type: 'Accept',
      object: activity.id,
      raw_data: acceptActivity
    });
    
    // Update follower relationship to accepted
    await updateFollowerState(targetActor.id, followerActor.id, 'accepted');
    
    // Deliver Accept activity to follower's inbox
    await deliverActivity(targetActor, followerActor.inbox_url, acceptActivity);
  } else {
    // Notify user of pending follow request
    await notifyUserOfFollowRequest(targetActor, followerActor, inboxItem.id);
  }
}
```

#### 3. Processing Create Activities

```typescript
async function processCreateActivity(targetActor: Actor, activity: any): Promise<void> {
  const object = activity.object;
  
  // Only process Notes (check-ins) for now
  if (object && object.type === 'Note') {
    // Fetch creator actor if needed
    let creatorActor = await findActorById(activity.actor);
    if (!creatorActor) {
      creatorActor = await fetchRemoteActor(activity.actor);
    }
    
    // Check if we're following this actor
    const isFollowing = await isActorFollowing(targetActor.id, creatorActor.id);
    if (!isFollowing) {
      // We might choose to ignore content from users we don't follow
      return;
    }
    
    // Process the Note object
    // For check-ins, extract location data
    if (object.location) {
      // Process as a federated check-in
      // We might want to store a local copy for our timeline
      await storeRemoteCheckIn(targetActor, creatorActor, object);
    }
    
    // Notify the user of new content in their timeline
    await notifyUserOfNewContent(targetActor, creatorActor, object);
  }
}
```

#### 4. Processing Accept Activities

```typescript
async function processAcceptActivity(targetActor: Actor, activity: any): Promise<void> {
  // Check if this is accepting a Follow
  if (activity.object && activity.object.type === 'Follow') {
    // Find the original Follow activity
    const followActivity = activity.object;
    
    // Verify we sent this Follow request
    if (followActivity.actor === targetActor.actor_id) {
      // Find or fetch the actor we're now following
      let followedActor = await findActorById(activity.actor);
      if (!followedActor) {
        followedActor = await fetchRemoteActor(activity.actor);
      }
      
      // Update our following status to 'accepted'
      await updateFollowingState(followedActor.id, targetActor.id, 'accepted');
      
      // Notify user that their follow request was accepted
      await notifyUserOfAcceptedFollow(targetActor, followedActor);
    }
  }
}
```

## 4. HTTP Signatures for ActivityPub

ActivityPub security relies heavily on HTTP Signatures to authenticate server-to-server communications. This section details how to implement HTTP Signatures in our application.

### Security Requirements

According to the [W3C ActivityPub Recommendation](https://www.w3.org/TR/activitypub/#security-considerations):

> Implementations SHOULD verify HTTP signatures on incoming POST requests

This means:

1. All outgoing POSTs to other servers' inboxes MUST be signed
2. All incoming POSTs to our inboxes SHOULD have their signatures verified

### Implementation Plan for HTTP Signatures

#### 1. Signing Outgoing Requests

We already have a `signRequest` function in `src/utils/sign.js` that we should use for all outgoing server-to-server communications:

```typescript
// Example usage from the existing sign.js
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

#### 2. Signature Verification for Incoming Requests

We need to implement signature verification for incoming requests to our inbox endpoints:

```typescript
// Middleware to verify HTTP signatures
function verifySignature(req, res, next) {
  // Skip verification for GET requests
  if (req.method === 'GET') {
    return next();
  }
  
  try {
    // Extract signature header
    const signature = req.headers.signature;
    if (!signature) {
      return res.status(401).json({ error: 'Missing HTTP Signature' });
    }
    
    // Extract key ID from signature
    const keyIdMatch = signature.match(/keyId="([^"]+)"/);
    if (!keyIdMatch) {
      return res.status(401).json({ error: 'Invalid signature format' });
    }
    
    const keyId = keyIdMatch[1];
    
    // Fetch the actor's public key using the keyId
    fetchActorPublicKey(keyId)
      .then(publicKey => {
        if (!publicKey) {
          return res.status(401).json({ error: 'Unable to retrieve public key' });
        }
        
        // Verify the HTTP signature using the public key
        const isValid = verifyHttpSignature(req, publicKey);
        
        if (!isValid) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
        
        // Signature verified, continue processing
        next();
      })
      .catch(error => {
        console.error('Error verifying signature:', error);
        res.status(500).json({ error: 'Error verifying signature' });
      });
  } catch (error) {
    console.error('Signature verification error:', error);
    res.status(500).json({ error: 'Signature verification error' });
  }
}

async function fetchActorPublicKey(keyId) {
  try {
    // keyId is usually in the format https://example.com/users/username#main-key
    // The actor URL is everything before the fragment
    const actorUrl = keyId.split('#')[0];
    
    // Fetch the actor
    const response = await fetch(actorUrl, {
      headers: {
        'Accept': 'application/activity+json'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch actor at ${actorUrl}, status: ${response.status}`);
      return null;
    }
    
    const actor = await response.json();
    
    // Extract the public key
    if (actor.publicKey && actor.publicKey.publicKeyPem) {
      return actor.publicKey.publicKeyPem;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching actor public key:', error);
    return null;
  }
}

function verifyHttpSignature(req, publicKey) {
  try {
    // Extract needed headers
    const signature = req.headers.signature;
    const date = req.headers.date;
    const digest = req.headers.digest;
    
    // Parse the signature header
    const params = {};
    signature.split(',').forEach(pair => {
      const [key, value] = pair.split('=');
      params[key.trim()] = value.replace(/^"/, '').replace(/"$/, '');
    });
    
    // Get the signed headers and signature value
    const signedHeaders = params.headers.split(' ');
    const signatureValue = params.signature;
    
    // Construct the signing string
    let signingString = '';
    for (const header of signedHeaders) {
      if (header === '(request-target)') {
        signingString += `(request-target): post ${req.path}\n`;
      } else {
        signingString += `${header}: ${req.headers[header]}\n`;
      }
    }
    signingString = signingString.trim();
    
    // Verify using crypto
    const verifier = crypto.createVerify('sha256');
    verifier.update(signingString);
    return verifier.verify(publicKey, signatureValue, 'base64');
  } catch (error) {
    console.error('Error in signature verification logic:', error);
    return false;
  }
}
```

#### 3. Integration Points for HTTP Signatures

1. **Outgoing Requests (Outbox Processing)**
   - In `deliverActivity` function during outbox processing
   - In any federated activity delivery (Follow, Like, etc.)

2. **Incoming Requests (Inbox Processing)**
   - As middleware for all POST endpoints to `/inbox` or `/{username}/inbox`
   - Apply the verification middleware to protect these routes

### Retry Strategy for Failed Deliveries

For compliance with the specification regarding server overload protection:

> Servers SHOULD also take care not to overload servers with submissions, for example by using an exponential backoff strategy.

We should implement a retry queue with exponential backoff:

```typescript
// Example retry logic with exponential backoff
async function retryDelivery(delivery) {
  const { attempt, maxAttempts, targetInbox, actor, activity } = delivery;
  
  if (attempt > maxAttempts) {
    console.log(`Max retry attempts (${maxAttempts}) reached for delivery to ${targetInbox}`);
    return;
  }
  
  // Calculate backoff time - exponential with jitter
  const baseDelay = 1000; // 1 second
  const maxJitter = 1000; // 1 second of jitter
  const backoff = Math.pow(2, attempt) * baseDelay;
  const jitter = Math.floor(Math.random() * maxJitter);
  const delayMs = backoff + jitter;
  
  console.log(`Retry ${attempt}/${maxAttempts} for ${targetInbox} scheduled in ${delayMs}ms`);
  
  // Schedule retry
  setTimeout(async () => {
    try {
      await deliverActivity(actor, targetInbox, activity);
      console.log(`Retry ${attempt} to ${targetInbox} succeeded`);
    } catch (error) {
      console.error(`Retry ${attempt} to ${targetInbox} failed:`, error);
      
      // Schedule next retry with incremented attempt count
      await retryDelivery({
        ...delivery,
        attempt: attempt + 1
      });
    }
  }, delayMs);
}
```

## 5. Security Considerations

As per the [W3C ActivityPub Recommendation](https://www.w3.org/TR/activitypub/#security-considerations), we should implement the following security measures:

1. **Authentication and Authorization**
   - HTTP Signatures for server-to-server communication
   - OAuth or a similar mechanism for client-to-server
   
2. **Verification**
   - Verify HTTP signatures on incoming POST requests
   - Check that the signing key belongs to the actor making the request
   
3. **Content Safety**
   - Sanitize all content containing markup
   - Implement rate limiting for both client-to-server and server-to-server requests
   - Properly handle recursive objects to avoid denial-of-service attacks
   
4. **URI Scheme Restrictions**
   - Whitelist only safe URI schemes (`http`, `https`)
   - Avoid allowing dangerous schemes like `file://` 
   
5. **Privacy Handling**
   - Never display `bto` and `bcc` properties
   - Properly handle audience targeting for private activities

6. **Server Overload Protection**
   - Implement rate limiting
   - Use exponential backoff for retries
   - Limit collection page sizes