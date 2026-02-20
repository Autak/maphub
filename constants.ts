import { Coordinates } from "./types";

export const DEFAULT_CENTER: Coordinates = {
  lat: 46.5775,
  lng: 7.9052
};

export const DEFAULT_ZOOM = 13;

export const MAPY_ATTRIBUTION = '&copy; <a href="https://www.seznam.cz/" target="_blank">Seznam.cz, a.s.</a>, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

export const TILE_LAYERS = {
  mapy_outdoor: {
    name: 'Mapy.cz Outdoor',
    url: "https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey={apikey}",
    attribution: MAPY_ATTRIBUTION,
  },
  mapy_aerial: {
    name: 'Mapy.cz Aerial',
    url: "https://api.mapy.com/v1/maptiles/aerial/256/{z}/{x}/{y}?apikey={apikey}",
    attribution: MAPY_ATTRIBUTION,
  },
} as const;

export type TileLayerKey = keyof typeof TILE_LAYERS;

export const LOCATION_TYPES = [
  { id: 'adventure', label: 'Adventure', color: 'bg-slate-900', icon: '' },
  { id: 'viewpoint', label: 'Viewpoint', color: 'bg-blue-600', icon: '' },
  { id: 'camp', label: 'Camp', color: 'bg-slate-700', icon: '' },
  { id: 'chill', label: 'Chill Spot', color: 'bg-blue-500', icon: '' },
  { id: 'summit', label: 'Summit', color: 'bg-slate-800', icon: '' },
  { id: 'waterfall', label: 'Waterfall', color: 'bg-indigo-600', icon: '' },
  { id: 'lake', label: 'Lake', color: 'bg-blue-700', icon: '' },
  { id: 'shelter', label: 'Shelter', color: 'bg-slate-600', icon: '' },
  { id: 'trailhead', label: 'Trailhead', color: 'bg-slate-500', icon: '' },
  { id: 'sleeping', label: 'Sleeping Spot', color: 'bg-indigo-900', icon: '' },
  { id: 'water', label: 'Water source', color: 'bg-cyan-600', icon: '' },
] as const;

export const TRIP_TAGS = [
  'hiking', 'trekking', 'coastal', 'mountain', 'forest',
  'beach', 'desert', 'snow', 'cycling', 'road-trip',
  'camping', 'backpacking', 'island', 'urban', 'wildlife'
] as const;

export const DIFFICULTY_LEVELS = [
  { id: 'easy', label: 'Easy', color: 'bg-blue-600', textColor: 'text-blue-600', icon: '•', desc: 'Flat terrain, well-marked trails' },
  { id: 'moderate', label: 'Moderate', color: 'bg-indigo-600', textColor: 'text-indigo-600', icon: '•', desc: 'Some elevation, decent fitness needed' },
  { id: 'hard', label: 'Hard', color: 'bg-slate-800', textColor: 'text-slate-800', icon: '•', desc: 'Steep climbs, long distances' },
  { id: 'expert', label: 'Expert', color: 'bg-slate-950', textColor: 'text-slate-950', icon: '•', desc: 'Technical, high altitude, experienced only' },
] as const;
