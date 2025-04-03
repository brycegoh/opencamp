export interface Actor {
  '@context': string | string[];
  type: string;
  id: string;
  inbox: string;
  outbox: string;
  followers: string;
  following: string;
  preferredUsername: string;
  name?: string;
  summary?: string;
  publicKey: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
}

export interface Activity {
  '@context': string | string[];
  type: string;
  id: string;
  actor: string;
  object: any;
  published?: string;
  to?: string | string[];
  cc?: string | string[];
}

export interface Note {
  '@context': string | string[];
  type: 'Note';
  id: string;
  attributedTo: string;
  content: string;
  published: string;
  to: string | string[];
  cc?: string | string[];
  location?: {
    type: 'Place';
    name: string;
    latitude: number;
    longitude: number;
  };
  attachment?: {
    type: 'Image';
    url: string;
    mediaType: string;
  }[];
}

export interface CreateActivity extends Activity {
  type: 'Create';
  object: Note;
}

export interface FollowActivity extends Activity {
  type: 'Follow';
  object: string;
}

export interface AcceptActivity extends Activity {
  type: 'Accept';
  object: Activity;
}

export interface WebFinger {
  subject: string;
  links: {
    rel: string;
    type?: string;
    href?: string;
    template?: string;
  }[];
}
