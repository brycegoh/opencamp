import pool from '../db/client';
import { Place, NewPlace } from './dataSchema';

/**
 * Find or create a place
 */
export async function findOrCreatePlace(placeData: NewPlace): Promise<Place> {
  // Try to find an existing place with the same name and coordinates
  const existingResult = await pool.query(
    `SELECT * FROM places 
     WHERE name = $1 
     AND latitude = $2 
     AND longitude = $3`,
    [placeData.name, placeData.latitude, placeData.longitude]
  );
  console.log(existingResult.rows);
  if (existingResult.rows.length > 0) {
    return existingResult.rows[0];
  }
  
  // Create a new place if none exists
  const result = await pool.query(
    `INSERT INTO places
     (name, description, latitude, longitude, street_address, locality, region, country)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      placeData.name,
      placeData.description,
      placeData.latitude,
      placeData.longitude,
      placeData.street_address,
      placeData.locality,
      placeData.region,
      placeData.country
    ]
  );
  console.log(result.rows);
  
  return result.rows[0];
}

/**
 * Find a place by ID
 */
export async function findPlaceById(placeId: string): Promise<Place | null> {
  const result = await pool.query(
    'SELECT * FROM places WHERE id = $1',
    [placeId]
  );
  return result.rows[0] || null;
}

/**
 * Convert a Place to ActivityPub Place object
 */
export function placeToJsonLd(place: Place): any {
  return {
    'type': 'Place',
    'name': place.name,
    'latitude': place.latitude,
    'longitude': place.longitude,
    'description': place.description,
    'address': {
      'type': 'PostalAddress',
      'streetAddress': place.street_address,
      'addressLocality': place.locality,
      'addressRegion': place.region,
      'addressCountry': place.country
    }
  };
} 