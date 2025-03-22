// ActivityPub related interfaces for incoming data
export interface ActivityObject {
  id?: string;
  type: string;
  content?: string;
  name?: string;
  location?: LocationObject;
  attachment?: Attachment[];
  to?: string[];
  cc?: string[];
}

export interface LocationObject {
  type: string;
  name?: string;
  description?: string;
  longitude: number;
  latitude: number;
  altitude?: number;
  streetAddress?: string;
  locality?: string;
  region?: string;
  country?: string;
}

export interface Attachment {
  type: string;
  url: string;
  mediaType?: string;
  width?: number;
  height?: number;
  name?: string;
}

export interface Activity {
  id?: string;
  type: string;
  actor: string;
  object: ActivityObject | string;
  to?: string[];
  cc?: string[];
}

// Local interfaces for data transformations
export interface MediaItem {
  url: string;
  media_type: string;
  width?: number;
  height?: number;
  description?: string;
}

export interface PlaceData {
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  street_address?: string;
  locality?: string;
  region?: string;
  country?: string;
}