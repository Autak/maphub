export interface Coordinates {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password?: string;
  bio?: string;
  avatarUrl?: string;
  color: string;
  joinedAt: number;
  bookmarks?: string[]; // saved trip IDs
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
}

export interface Trip {
  id: string;
  userId: string;
  title: string;
  description: string;
  startDate: number;
  endDate?: number;
  visibility: 'public' | 'private' | 'friends';
  difficulty?: 'easy' | 'moderate' | 'hard' | 'expert';
  coverPhotoUrl?: string;
  tags?: string[];
  likes?: string[]; // array of user IDs
  gpxData?: { lat: number; lng: number; ele?: number }[];
  gpxStats?: { distanceKm: number; estimatedDays: number };
  packingItems?: string[]; // custom user-added packing items (Legacy)
  packingList?: string[]; // Full list of items (if customized)
  dayComments?: Record<string, string>; // Comments for specific days
  externalLinks?: { label: string; url: string }[];
}

export interface MapLocation {
  id: string;
  tripId: string;
  userId: string;
  coords: Coordinates;
  title: string;
  comment: string;
  photoUrl: string;
  timestamp: number;
  type: 'adventure' | 'chill' | 'viewpoint' | 'camp' | 'summit' | 'waterfall' | 'lake' | 'shelter' | 'trailhead' | 'sleeping' | 'water';
  comments?: Comment[];
}

export interface NewLocationDraft {
  coords: Coordinates;
  photoFile: File | null;
  photoPreview: string | null;
}
