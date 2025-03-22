import crypto from 'crypto';
import fetch from 'node-fetch';
import { ACTOR_URL, PRIVATE_KEY } from '../config.js';

// Sign an HTTP request for ActivityPub
function signRequest(url, body) {
  const date = new Date().toUTCString();
  const digest = crypto.createHash("sha256").update(body).digest("base64");
  const keyId = `${ACTOR_URL}#main-key`;

  const signingString = `(request-target): post ${new URL(url).pathname}\ndate: ${date}\ndigest: SHA-256=${digest}`;
  const signature = crypto.createSign("sha256").update(signingString).sign(PRIVATE_KEY, "base64");

  return {
    Date: date,
    Digest: `SHA-256=${digest}`,
    Signature: `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) date digest",signature="${signature}"`
  };
}

// Send an ActivityPub activity to a remote inbox
async function sendActivity(inbox, activity) {
  const body = activity;
  const headers = signRequest(inbox, body);

  try {
    const response = await fetch(inbox, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/activity+json" },
      body
    });
    console.log(`Sent to ${inbox}:`, await response.text());
    return response;
  } catch (error) {
    console.error("Failed to send activity:", error);
    throw error;
  }
}

export {
  signRequest,
  sendActivity
}; 