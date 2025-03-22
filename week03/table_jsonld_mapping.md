# ActivityPub Database to JSON-LD Mapping

This document maps our database schema to the JSON-LD structures required by the ActivityPub protocol.

## Actor Mapping

The `actors` table represents ActivityPub Actors and maps to JSON-LD as follows:

| Database Field | JSON-LD Property | Notes |
|----------------|-----------------|-------|
| `actor_id` | `id` | The globally unique URI for this actor |
| `type` | `type` | Usually "Person" in our system |
| `display_name` | `name` | The display name shown to users |
| `summary` | `summary` | HTML-formatted user bio |
| `icon_url` | `icon.url` | URI to profile picture |
| `inbox_url` | `inbox` | URI to actor's inbox collection |
| `outbox_url` | `outbox` | URI to actor's outbox collection |
| `followers_url` | `followers` | URI to actor's followers collection |
| `following_url` | `following` | URI to actor's following collection |
| `public_key` | `publicKey.publicKeyPem` | Public key in PEM format |

**Example JSON-LD:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://example.com/users/alice",
  "type": "Person",
  "name": "Alice Smith",
  "summary": "Location enthusiast and coffee lover",
  "icon": {
    "type": "Image",
    "url": "https://example.com/users/alice/avatar.jpg"
  },
  "inbox": "https://example.com/users/alice/inbox",
  "outbox": "https://example.com/users/alice/outbox",
  "followers": "https://example.com/users/alice/followers",
  "following": "https://example.com/users/alice/following",
  "publicKey": {
    "id": "https://example.com/users/alice#main-key",
    "owner": "https://example.com/users/alice",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  }
}
```

## Check-in Mapping

Check-ins are mapped to ActivityPub Note objects with location extensions:

| Database Field | JSON-LD Property | Notes |
|----------------|-----------------|-------|
| `ap_id` | `id` | The globally unique URI for this check-in |
| `content` | `content` | HTML-formatted caption text |
| `actor_id` (via join) | `attributedTo` | Link to the actor who created the check-in |
| `latitude` | `location.latitude` | Geographic latitude |
| `longitude` | `location.longitude` | Geographic longitude |
| `altitude` | `location.altitude` | Optional altitude information |
| `place_id` (via join) | `location` | Full place details nested as a Place object |
| `created_at` | `published` | ISO 8601 timestamp |
| `visibility` | Used for audience targeting | Maps to `to` and `cc` fields |

The `media` table entries related to a check-in become attachments:

| Database Field | JSON-LD Property | Notes |
|----------------|-----------------|-------|
| `url` | `url` | URI to the media resource |
| `media_type` | `mediaType` | MIME type |
| `width` | `width` | Image width in pixels |
| `height` | `height` | Image height in pixels |
| `description` | `name` | Alt text/description |

**Example Check-in JSON-LD:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://example.com/checkins/1234",
  "type": "Note",
  "attributedTo": "https://example.com/users/alice",
  "content": "Great coffee at this new place!",
  "published": "2023-07-15T15:30:45Z",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["https://example.com/users/alice/followers"],
  "location": {
    "type": "Place",
    "name": "Caffeine Corner",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude": 10.0,
    "address": {
      "type": "PostalAddress",
      "streetAddress": "123 Main St",
      "addressLocality": "San Francisco",
      "addressRegion": "CA",
      "addressCountry": "USA"
    }
  },
  "attachment": [
    {
      "type": "Image",
      "url": "https://example.com/media/coffee1.jpg",
      "mediaType": "image/jpeg",
      "width": 1200,
      "height": 800,
      "name": "A delicious latte with heart-shaped foam art"
    }
  ]
}
```

## Collection Mappings

### Outbox Collection

The `outbox` table maps to an OrderedCollection of Activities:

| Database Field | JSON-LD Property | Notes |
|----------------|-----------------|-------|
| `activity_id` | `id` | Unique activity URI |
| `activity_type` | `type` | Activity type (Create, Like, Follow, etc.) |
| `object` | `object` | URI or nested object |
| `to_recipients` | `to` | Array of recipient URIs |
| `cc_recipients` | `cc` | Array of CC recipient URIs |
| `created_at` | `published` | Timestamp |

**Example Outbox JSON-LD:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://example.com/users/alice/outbox",
  "type": "OrderedCollection",
  "totalItems": 42,
  "first": "https://example.com/users/alice/outbox?page=1",
  "last": "https://example.com/users/alice/outbox?page=3"
}
```

**Example Outbox Page:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://example.com/users/alice/outbox?page=1",
  "type": "OrderedCollectionPage",
  "next": "https://example.com/users/alice/outbox?page=2",
  "partOf": "https://example.com/users/alice/outbox",
  "orderedItems": [
    {
      "id": "https://example.com/users/alice/activities/1",
      "type": "Create",
      "actor": "https://example.com/users/alice",
      "object": {
        "id": "https://example.com/checkins/1234",
        "type": "Note",
        "content": "Great coffee at this new place!",
        "attributedTo": "https://example.com/users/alice",
        "published": "2023-07-15T15:30:45Z"
        // ... other check-in properties
      },
      "published": "2023-07-15T15:30:45Z",
      "to": ["https://www.w3.org/ns/activitystreams#Public"],
      "cc": ["https://example.com/users/alice/followers"]
    }
    // ... more activities
  ]
}
```

### Inbox Collection

The `inbox` table maps similarly to an OrderedCollection of Activities:

| Database Field | JSON-LD Property | Notes |
|----------------|-----------------|-------|
| `activity_id` | `id` | Activity URI |
| `activity_type` | `type` | Activity type |
| `actor` | `actor` | URI of the actor performing the activity |
| `object` | `object` | Target object URI or nested object |
| `raw_data` | Various | Source for all activity properties |

The inbox format follows the same OrderedCollection structure as outbox.

### Followers and Following Collections

The `followers` table maps to an ActivityPub Collection:

| Database Field | JSON-LD Property | Notes |
|----------------|-----------------|-------|
| `actor_id` and `follower_actor_id` | `items` or `orderedItems` | URIs of followers/following |
| `state` | Used for filtering | Only "accepted" relationships are included |

**Example Followers Collection:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://example.com/users/alice/followers",
  "type": "Collection",
  "totalItems": 291,
  "items": [
    "https://other.example/users/bob",
    "https://another.example/users/charlie",
    // ... more follower URIs
  ]
}
```

## Activity Mappings

Common activities in our system include:

### Create Activity (New Check-in)

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://example.com/users/alice/activities/1",
  "type": "Create",
  "actor": "https://example.com/users/alice",
  "object": {
    // Check-in Note object as shown above
  },
  "published": "2023-07-15T15:30:45Z",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["https://example.com/users/alice/followers"]
}
```

### Follow Activity

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://example.com/users/alice/activities/123",
  "type": "Follow",
  "actor": "https://example.com/users/alice",
  "object": "https://other.example/users/bob",
  "published": "2023-07-14T12:34:56Z"
}
```

### Accept Activity (For Follow Requests)

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://other.example/users/bob/activities/456",
  "type": "Accept",
  "actor": "https://other.example/users/bob",
  "object": {
    "id": "https://example.com/users/alice/activities/123",
    "type": "Follow",
    "actor": "https://example.com/users/alice",
    "object": "https://other.example/users/bob"
  },
  "published": "2023-07-14T12:40:12Z"
}
```

### Like Activity (For Check-ins)

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://example.com/users/alice/activities/789",
  "type": "Like",
  "actor": "https://example.com/users/alice",
  "object": "https://other.example/checkins/5678",
  "published": "2023-07-15T16:45:12Z"
}
```

## WebFinger Response

While not stored directly in the database, WebFinger responses are generated from actor data:

```json
{
  "subject": "acct:alice@example.com",
  "links": [
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://example.com/users/alice"
    }
  ]
}
```

## Privacy Considerations

The `visibility` field in `check_ins` determines audience targeting:

| Visibility Value | ActivityPub Mapping |
|-----------------|---------------------|
| "public" | `to` includes "https://www.w3.org/ns/activitystreams#Public" |
| "followers" | `to` includes the actor's followers collection |
| "private" | `to` includes only specific recipients | 