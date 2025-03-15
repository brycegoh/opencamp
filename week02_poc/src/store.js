import { ACTOR_URL, DOMAIN, PUBLIC_KEY } from './config.js';


const followers = [];

// outbox
const timestamp = new Date();
const outboxItems = [
  {
    "@context": "https://www.w3.org/ns/activitystreams",
    "id": ACTOR_URL,
    "type": "Create",
    "actor": ACTOR_URL,
    "object": {
      "id": ACTOR_URL,
      "type": "Note",
      "published": timestamp.toISOString(),
      "attributedTo": ACTOR_URL,
      "content": "<p>Hello world</p>",
      "to": "https://www.w3.org/ns/activitystreams#Public"
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