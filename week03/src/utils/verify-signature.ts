import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';

/**
 * Middleware to verify HTTP signatures for ActivityPub server-to-server communications
 * Based on the HTTP Signatures spec (draft-cavage-http-signatures)
 */
export function verifySignature(req: Request, res: Response, next: NextFunction): void {
  // Skip verification for GET requests
  if (req.method === 'GET') {
    next();
    return;
  }
  
  try {
    // Extract signature header
    const signature = req.headers.signature as string;
    if (!signature) {
      res.status(401).json({ error: 'Missing HTTP Signature' });
      return;
    }
    
    // Extract key ID from signature
    const keyIdMatch = signature.match(/keyId="([^"]+)"/);
    if (!keyIdMatch) {
      res.status(401).json({ error: 'Invalid signature format' });
      return;
    }
    
    const keyId = keyIdMatch[1];
    
    // Fetch the actor's public key using the keyId
    fetchActorPublicKey(keyId)
      .then(publicKey => {
        if (!publicKey) {
          res.status(401).json({ error: 'Unable to retrieve public key' });
          return;
        }
        
        // Verify the HTTP signature using the public key
        const isValid = verifyHttpSignature(req, publicKey);
        
        if (!isValid) {
          res.status(401).json({ error: 'Invalid signature' });
          return;
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

/**
 * Fetch an actor's public key from their ActivityPub profile
 */
async function fetchActorPublicKey(keyId: string): Promise<string | null> {
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

/**
 * Verify an HTTP signature using the actor's public key
 */
function verifyHttpSignature(req: Request, publicKey: string): boolean {
  try {
    // Extract needed headers
    const signature = req.headers.signature as string;
    const date = req.headers.date as string;
    const digest = req.headers.digest as string;
    
    // Parse the signature header
    const params: Record<string, string> = {};
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