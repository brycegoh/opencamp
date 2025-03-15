import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Domain and URLs
const DOMAIN = "b0d3-2406-3003-2000-76e4-b8a2-ff0d-a2ee-3e30.ngrok-free.app";
const ACTOR_URL = `https://${DOMAIN}/actor`;

// Load keys
const PRIVATE_KEY_PATH = path.join(__dirname, '../private.pem');
const PUBLIC_KEY_PATH = path.join(__dirname, '../public.pem');

const PRIVATE_KEY = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");
const PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, "utf8");

// Server config
const PORT = process.env.PORT || 3000;

export {
  DOMAIN,
  ACTOR_URL,
  PRIVATE_KEY,
  PUBLIC_KEY,
  PORT
}; 