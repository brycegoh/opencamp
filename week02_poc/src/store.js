import { ACTOR_URL, DOMAIN, PUBLIC_KEY } from './config.js';


const followers = [];

// outbox
const timestamp = new Date();
const outboxItems = [
  {
    "@context": "https://www.w3.org/ns/activitystreams",
    "id": `https://${DOMAIN}/activities/1`,
    "type": "Create",
    "actor": ACTOR_URL,
    "published": timestamp.toISOString(),
    "to": ["https://www.w3.org/ns/activitystreams#Public"],
    "cc": [],
    "object": {
      "@context": "https://www.w3.org/ns/activitystreams",
      "id": `https://${DOMAIN}/notes/1`,
      "type": "Note",
      "published": timestamp.toISOString(),
      "attributedTo": ACTOR_URL,
      "content": "<p>Hello ActivityPub world!</p>",
      "to": ["https://www.w3.org/ns/activitystreams#Public"],
      "cc": [],
      "name": "Hello post",
      "summary": "Hello ActivityPub world!",
      "url": `https://${DOMAIN}/notes/1`,
      "mediaType": "text/html"
    }
  },
  {
    "@context": "https://www.w3.org/ns/activitystreams",
    "id": `https://${DOMAIN}/activities/2`,
    "type": "Create",
    "actor": ACTOR_URL,
    "published": new Date(timestamp - 60000).toISOString(), // 1 minute earlier
    "to": ["https://www.w3.org/ns/activitystreams#Public"],
    "cc": [],
    "object": {
      "@context": "https://www.w3.org/ns/activitystreams",
      "id": `https://${DOMAIN}/notes/2`,
      "type": "Note",
      "published": new Date(timestamp - 60000).toISOString(),
      "attributedTo": ACTOR_URL,
      "content": "<p>This is my second post from OpenCamp ActivityPub server!</p>",
      "to": ["https://www.w3.org/ns/activitystreams#Public"],
      "cc": [],
      "name": "Second post",
      "summary": "This is my second post from OpenCamp ActivityPub server!",
      "url": `https://${DOMAIN}/notes/2`,
      "mediaType": "text/html"
    }
  }
];

// Me
const actor = {
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": ACTOR_URL,
  "type": "Person",
  "name": "opencamp",
  "preferredUsername": "opencamp",
  "inbox": `https://${DOMAIN}/inbox`,
  "outbox": `https://${DOMAIN}/outbox`,
  "publicKey": {
    "id": `${ACTOR_URL}#main-key`,
    "owner": ACTOR_URL,
    "publicKeyPem": PUBLIC_KEY
  }
};

// Methods to interact with the store
const addFollower = (followerUrl) => {
  if (!followers.includes(followerUrl)) {
    followers.push(followerUrl);
    return true;
  }
  return false;
};

const addOutboxItem = (item) => {
  outboxItems.push(item);
  return item;
};

const getFollowers = () => [...followers];

const getOutboxItems = () => [...outboxItems];

export {
  actor,
  getFollowers,
  addFollower,
  getOutboxItems,
  addOutboxItem
}; 