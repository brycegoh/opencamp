import crypto from 'crypto';
import { Actor, WebFinger, Activity, Note } from '../types/activitypub';
import * as db from '../db';

const DOMAIN = process.env.DOMAIN || 'http://localhost:3000';
const DEFAULT_CONTEXT = 'https://www.w3.org/ns/activitystreams';

export function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  return { privateKey, publicKey };
}

export function createActorObject(user: any, domain = DOMAIN): Actor {
  const actorUrl = `${domain}/users/${user.username}`;
  
  return {
    '@context': [
      DEFAULT_CONTEXT,
      'https://w3id.org/security/v1'
    ],
    type: 'Person',
    id: actorUrl,
    inbox: `${actorUrl}/inbox`,
    outbox: `${actorUrl}/outbox`,
    followers: `${actorUrl}/followers`,
    following: `${actorUrl}/following`,
    preferredUsername: user.username,
    name: user.display_name,
    summary: user.summary,
    publicKey: {
      id: `${actorUrl}#main-key`,
      owner: actorUrl,
      publicKeyPem: user.public_key
    }
  };
}

export function createNoteObject(checkin: any, user: any, domain = DOMAIN): Note {
  const actorUrl = `${domain}/users/${user.username}`;
  const noteUrl = checkin.ap_id || `${domain}/checkins/${checkin.id}`;
  
  const note: Note = {
    '@context': DEFAULT_CONTEXT,
    type: 'Note',
    id: noteUrl,
    attributedTo: actorUrl,
    content: checkin.content,
    published: checkin.created_at,
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    location: {
      type: 'Place',
      name: checkin.location_name,
      latitude: checkin.latitude,
      longitude: checkin.longitude
    }
  };
  
  if (checkin.image_url) {
    note.attachment = [{
      type: 'Image',
      url: checkin.image_url,
      mediaType: 'image/jpeg' // Assuming jpeg, adjust as needed
    }];
  }
  
  return note;
}

export function createCreateActivity(note: Note, actor: string): Activity {
  return {
    '@context': DEFAULT_CONTEXT,
    type: 'Create',
    id: `${note.id}/activity`,
    actor,
    object: note,
    published: note.published,
    to: note.to,
    cc: note.cc
  };
}

export function createFollowActivity(actor: string, target: string): Activity {
  return {
    '@context': DEFAULT_CONTEXT,
    type: 'Follow',
    id: `${DOMAIN}/${crypto.randomUUID()}`,
    actor,
    object: target
  };
}

export function createAcceptActivity(actor: string, activity: Activity): Activity {
  return {
    '@context': DEFAULT_CONTEXT,
    type: 'Accept',
    id: `${DOMAIN}/${crypto.randomUUID()}`,
    actor,
    object: activity
  };
}

export function generateWebfinger(username: string, domain = DOMAIN): WebFinger {
  const resource = `acct:${username}@${domain}`;
  const actorUrl = `${domain}/users/${username}`;
  
  return {
    subject: resource,
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actorUrl
      }
    ]
  };
}

export function parseWebfingerResource(resource: string): { username: string; domain: string } | null {
  const match = resource.match(/^acct:([^@]+)@(.+)$/);
  if (!match) return null;
  
  return {
    username: match[1],
    domain: match[2]
  };
}

export function signRequest(data: any, privateKey: string) {
  const signer = crypto.createSign('sha256');
  signer.update(JSON.stringify(data));
  return signer.sign(privateKey, 'base64');
}

export function verifySignature(data: any, signature: string, publicKey: string): boolean {
  try {
    const verifier = crypto.createVerify('sha256');
    verifier.update(JSON.stringify(data));
    return verifier.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export async function generateSignatureHeader(
  method: string,
  url: string,
  digest: string,
  userId: string
) {
  const user = await db.getUserById(userId);
  if (!user) throw new Error('User not found');

  const parsedUrl = new URL(url);
  const headerPath = parsedUrl.pathname;
  const date = new Date().toUTCString();
  const actorUrl = `${DOMAIN}/users/${user.username}`;
  const keyId = `${actorUrl}#main-key`;

  const stringToSign = `(request-target): ${method.toLowerCase()} ${headerPath}\nhost: ${parsedUrl.host}\ndate: ${date}\ndigest: ${digest}`;

  const signature = crypto.createSign('sha256')
    .update(stringToSign)
    .sign(user.private_key, 'base64');

  return {
    signature: `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${signature}"`,
    date,
    digest
  };
}
