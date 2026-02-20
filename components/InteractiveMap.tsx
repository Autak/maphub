import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapLocation, Coordinates, Trip, User } from '../types';
import { TILE_LAYERS, DEFAULT_CENTER, DEFAULT_ZOOM, TileLayerKey } from '../constants';
import { Search, Loader2, Layers } from 'lucide-react';

// Fix Leaflet marker icon issue
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

interface InteractiveMapProps {
  locations: MapLocation[];
  trips: Trip[];
  users: User[];
  onMapClick?: (coords: Coordinates) => void;
  selectedLocationId: string | null;
  onMarkerClick?: (id: string) => void;
  readonly?: boolean;
  isSidebarOpen?: boolean;
}

const MapEvents: React.FC<{ onMapClick?: (coords: Coordinates) => void; readonly: boolean }> = ({ onMapClick, readonly }) => {
  useMapEvents({
    click(e) {
      if (!readonly && onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
};

const MapController: React.FC<{
  selectedLocationId: string | null;
  locations: MapLocation[];
  isSidebarOpen: boolean;
}> = ({ selectedLocationId, locations, isSidebarOpen }) => {
  const map = useMap();

  useEffect(() => {
    if (selectedLocationId) {
      const location = locations.find(l => l.id === selectedLocationId);
      if (location) {
        map.flyTo([location.coords.lat, location.coords.lng], 14, {
          animate: true,
          duration: 1.5
        });
      }
    }
  }, [selectedLocationId, locations, map]);

  return null;
};

const MapRevalidator: React.FC<{ isSidebarOpen: boolean }> = ({ isSidebarOpen }) => {
  const map = useMap();
  useEffect(() => {
    // Invalidate size immediately
    map.invalidateSize();

    // And after a delay to account for CSS transitions
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 305); // slightly longer than typical 300ms transition

    return () => clearTimeout(timer);
  }, [map, isSidebarOpen]);
  return null;
};

const DynamicTileLayer: React.FC<{ layerKey: TileLayerKey }> = ({ layerKey }) => {
  const layer = TILE_LAYERS[layerKey];
  const apiKey = (import.meta as any).env.VITE_MAPY_API_KEY || '';
  const url = layer.url.replace('{apikey}', apiKey);
  return <TileLayer key={url} url={url} attribution={layer.attribution} />;
};

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  locations,
  trips,
  users,
  onMapClick,
  selectedLocationId,
  onMarkerClick,
  readonly = false,
  isSidebarOpen = false
}) => {
  const [activeLayer, setActiveLayer] = useState<TileLayerKey>('mapy_outdoor');
  const [isLayerSwitcherOpen, setIsLayerSwitcherOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Search logic
  const SearchController = () => {
    const map = useMap();

    // This allows us to trigger flyTo from outside the component
    useEffect(() => {
      // Find a way to expose this or just keep it simple
    }, [map]);

    return null;
  };

  const handleSearch = async (e: React.FormEvent, map: L.Map | null) => {
    e.preventDefault();
    if (!searchQuery.trim() || !map) return;

    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        map.flyTo([parseFloat(lat), parseFloat(lon)], 12, { animate: true, duration: 1.5 });
        setSearchQuery('');
      }
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setIsSearching(false);
    }
  };

  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  return (
    <div className="relative h-full w-full bg-slate-200 overflow-hidden">
      <MapContainer
        center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full outline-none z-0"
        zoomControl={false}
        attributionControl={false}
        ref={setMapInstance}
      >
        <DynamicTileLayer layerKey={activeLayer} />

        <MapEvents onMapClick={onMapClick} readonly={readonly} />
        <MapController
          selectedLocationId={selectedLocationId}
          locations={locations}
          isSidebarOpen={isSidebarOpen}
        />
        <MapRevalidator isSidebarOpen={isSidebarOpen} />

        {locations.map((loc) => {
          const user = users.find(u => u.id === loc.userId);
          const trip = trips.find(t => t.id === loc.tripId);
          const color = user?.color || '#3b82f6';

          const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: ${color}; border: 2px solid white; border-radius: 50%; width: 14px; height: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          return (
            <Marker
              key={loc.id}
              position={[loc.coords.lat, loc.coords.lng]}
              icon={customIcon}
              eventHandlers={{
                click: () => onMarkerClick?.(loc.id),
              }}
            >
              <Popup closeButton={!readonly}>
                <div className="p-2 min-w-[200px] font-sans">
                  {user && (
                    <div className="flex items-center gap-2 mb-2 border-b pb-1">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold" style={{ backgroundColor: user.color }}>
                        {user.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{user.username}</span>
                        {trip && <span className="text-[10px] text-slate-400">{trip.title}</span>}
                      </div>
                    </div>
                  )}
                  <div className="w-full h-32 bg-gray-100 rounded mb-2 overflow-hidden flex items-center justify-center">
                    <img src={loc.photoUrl} alt={loc.title} className="object-cover w-full h-full" />
                  </div>
                  <h3 className="font-bold text-base leading-tight">{loc.title}</h3>
                  <p className="text-gray-600 text-sm italic mt-1">{loc.comment}</p>
                  <span className="text-[10px] text-gray-400 mt-2 block">
                    {new Date(loc.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Layer Switcher */}
      {!readonly && (
        <div className="absolute bottom-28 right-4 z-[400] flex flex-col items-end">
          {isLayerSwitcherOpen && (
            <div className="bg-white rounded-lg shadow-xl border border-slate-200 mb-2 overflow-hidden w-40">
              {(Object.keys(TILE_LAYERS) as TileLayerKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => { setActiveLayer(key); setIsLayerSwitcherOpen(false); }}
                  className={`block w-full text-left px-4 py-2 text-sm font-medium transition ${activeLayer === key ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {TILE_LAYERS[key].name}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setIsLayerSwitcherOpen(!isLayerSwitcherOpen)}
            className="w-10 h-10 rounded-lg bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
          >
            <Layers size={20} />
          </button>
        </div>
      )}

      {/* Search Bar */}
      {!readonly && (
        <div className="absolute top-4 right-4 z-[400] flex flex-col items-end">
          <form onSubmit={(e) => handleSearch(e, mapInstance)} className="flex bg-white shadow-xl rounded-lg overflow-hidden border border-slate-300">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city or place..."
              className="px-4 py-2 w-48 md:w-64 outline-none text-slate-800 text-sm font-medium"
            />
            <button type="submit" className="px-3 border-l hover:bg-slate-50 text-slate-500">
              {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;
