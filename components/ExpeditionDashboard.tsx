import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Trip, MapLocation, User } from '../types';
import { Plus, Map as MapIcon, Camera, Route, MapPin } from 'lucide-react';

// Fix Leaflet marker icon
if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
}

// Vibrant route colors cycling through trips
const ROUTE_PALETTE = [
    '#3b82f6', // blue
    '#ec4899', // pink
    '#22c55e', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#f97316', // orange
    '#e11d48', // rose
];

interface ExpeditionDashboardProps {
    currentUser: User;
    trips: Trip[];
    locations: MapLocation[];
    onViewTrip: (tripId: string) => void;
    onCreateTrip: () => void;
}

// Fly map to given bounds
const MapFlyTo: React.FC<{ bounds: L.LatLngBoundsExpression | null }> = ({ bounds }) => {
    const map = useMap();
    React.useEffect(() => {
        if (bounds) {
            map.flyToBounds(bounds, { padding: [60, 60], duration: 1.2, maxZoom: 12 });
        }
    }, [bounds, map]);
    return null;
};

// Cache to avoid redundant API calls
const geocodeCache: Record<string, string> = {};

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    if (geocodeCache[key]) return geocodeCache[key];
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=5`,
            { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const country = data.address?.country || data.address?.state || '';
        geocodeCache[key] = country;
        return country;
    } catch {
        return '';
    }
};

const ExpeditionDashboard: React.FC<ExpeditionDashboardProps> = ({
    currentUser,
    trips,
    locations,
    onViewTrip,
    onCreateTrip,
}) => {
    const [hoveredTripId, setHoveredTripId] = useState<string | null>(null);
    const [flyBounds, setFlyBounds] = useState<L.LatLngBoundsExpression | null>(null);
    const [countries, setCountries] = useState<Record<string, string>>({}); // tripId -> country name

    const myTrips = useMemo(
        () => trips.filter(t => t.userId === currentUser.id),
        [trips, currentUser.id]
    );

    const myLocations = useMemo(
        () => locations.filter(l => l.userId === currentUser.id),
        [locations, currentUser.id]
    );

    // Build trip data with color, routes, cover photo
    const tripData = useMemo(() =>
        myTrips.map((trip, i) => {
            const tripLocs = myLocations
                .filter(l => l.tripId === trip.id)
                .sort((a, b) => a.timestamp - b.timestamp);
            const positions: [number, number][] = tripLocs.map(l => [l.coords.lat, l.coords.lng]);
            const color = ROUTE_PALETTE[i % ROUTE_PALETTE.length];
            const coverPhoto = trip.coverPhotoUrl || (tripLocs[0]?.photoUrl) || null;
            return { trip, positions, color, coverPhoto, tripLocs };
        }),
        [myTrips, myLocations]
    );

    // Fetch countries for all trips (using first location coordinate)
    useEffect(() => {
        const fetchAll = async () => {
            const results: Record<string, string> = {};
            for (const td of tripData) {
                if (td.positions.length > 0) {
                    const [lat, lng] = td.positions[0];
                    const country = await reverseGeocode(lat, lng);
                    if (country) results[td.trip.id] = country;
                }
            }
            setCountries(prev => ({ ...prev, ...results }));
        };
        fetchAll();
    }, [tripData]);

    // Lifetime stats
    const totalKm = useMemo(() => {
        let km = 0;
        myTrips.forEach(t => {
            if (t.gpxStats?.distanceKm) km += t.gpxStats.distanceKm;
        });
        return Math.round(km);
    }, [myTrips]);

    // Unique countries count
    const uniqueCountries = useMemo(() => {
        const set = new Set(Object.values(countries).filter(Boolean));
        return set.size;
    }, [countries]);

    // Default map center — average of all location points, or world center
    const defaultCenter: [number, number] = useMemo(() => {
        const pts = myLocations.filter(l => l.coords?.lat && l.coords?.lng);
        if (pts.length === 0) return [20, 10];
        const lat = pts.reduce((s, l) => s + l.coords.lat, 0) / pts.length;
        const lng = pts.reduce((s, l) => s + l.coords.lng, 0) / pts.length;
        return [lat, lng];
    }, [myLocations]);

    const handleTripHover = (td: typeof tripData[0] | null) => {
        if (!td) {
            setHoveredTripId(null);
            setFlyBounds(null);
            return;
        }
        setHoveredTripId(td.trip.id);
        if (td.positions.length >= 2) {
            setFlyBounds(td.positions as L.LatLngBoundsExpression);
        } else if (td.positions.length === 1) {
            // For single-point trips, just set a center + zoom
            setFlyBounds([[td.positions[0][0] - 0.5, td.positions[0][1] - 0.5], [td.positions[0][0] + 0.5, td.positions[0][1] + 0.5]]);
        }
    };

    const apiKey = (import.meta as any).env.VITE_MAPY_API_KEY || '';
    const tileUrl = `https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=${apiKey}`;

    const hasData = myLocations.length > 0 && myTrips.length > 0;

    return (
        <div className="relative w-full h-full bg-[#080808] overflow-hidden font-sans">

            {/* ── FULL-SCREEN MAP ─────────────────────────────────────── */}
            <div className="absolute inset-0 z-0">
                <MapContainer
                    center={defaultCenter}
                    zoom={hasData ? 5 : 2}
                    scrollWheelZoom={true}
                    dragging={true}
                    zoomControl={false}
                    attributionControl={false}
                    className="h-full w-full"
                    style={{ background: '#080808' }}
                >
                    <TileLayer url={tileUrl} opacity={0.7} />
                    <MapFlyTo bounds={flyBounds} />

                    {/* Draw all trip routes */}
                    {tripData.map(td => {
                        if (td.positions.length < 2) {
                            if (td.positions.length === 1) {
                                return (
                                    <Marker
                                        key={td.trip.id}
                                        position={td.positions[0]}
                                        icon={L.divIcon({
                                            className: 'custom-div-icon',
                                            html: `<div style="background-color: ${td.color}; border: 3px solid white; border-radius: 50%; width: 14px; height: 14px; box-shadow: 0 0 12px ${td.color}80; opacity: ${hoveredTripId && hoveredTripId !== td.trip.id ? 0.25 : 1}; transition: opacity 0.3s;"></div>`,
                                            iconSize: [14, 14],
                                            iconAnchor: [7, 7],
                                        })}
                                    />
                                );
                            }
                            return null;
                        }
                        const isHovered = hoveredTripId === td.trip.id;
                        const isDimmed = hoveredTripId !== null && !isHovered;
                        return (
                            <Polyline
                                key={td.trip.id}
                                positions={td.positions}
                                pathOptions={{
                                    color: td.color,
                                    weight: isHovered ? 6 : 3,
                                    opacity: isDimmed ? 0.15 : isHovered ? 1 : 0.75,
                                }}
                            />
                        );
                    })}

                    {/* End-point markers */}
                    {tripData.map(td => {
                        if (td.positions.length < 1) return null;
                        const last = td.positions[td.positions.length - 1];
                        const isHovered = hoveredTripId === td.trip.id;
                        const isDimmed = hoveredTripId !== null && !isHovered;
                        return (
                            <Marker
                                key={`ep-${td.trip.id}`}
                                position={last}
                                icon={L.divIcon({
                                    className: 'custom-div-icon',
                                    html: `<div style="background-color: ${td.color}; border: 2px solid white; border-radius: 50%; width: ${isHovered ? 16 : 10}px; height: ${isHovered ? 16 : 10}px; box-shadow: 0 0 ${isHovered ? 20 : 8}px ${td.color}; opacity: ${isDimmed ? 0.2 : 1}; transition: all 0.3s;"></div>`,
                                    iconSize: [16, 16],
                                    iconAnchor: [8, 8],
                                })}
                            />
                        );
                    })}
                </MapContainer>
            </div>

            {/* Gradient edge overlays */}
            <div className="absolute inset-y-0 left-0 w-72 z-10 bg-gradient-to-r from-[#080808] via-[#080808]/70 to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-[#080808]/30 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-72 z-10 bg-gradient-to-t from-[#080808] to-transparent pointer-events-none" />

            {/* ── LEFT SIDEBAR ─────────────────────────────────────────── */}
            <div className="absolute left-0 top-0 bottom-0 w-72 z-20 flex flex-col">

                {/* Logo / Title + New Journey button */}
                <div className="px-6 pt-8 pb-4 flex items-center justify-between">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 mb-1">My World</p>
                        <h1 className="text-2xl font-black text-white tracking-tighter leading-none">Expedition<br />Dashboard</h1>
                    </div>
                    <button
                        onClick={onCreateTrip}
                        className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
                        title="New Journey"
                    >
                        <Plus size={18} strokeWidth={3} />
                    </button>
                </div>

                {/* Lifetime Stats */}
                <div className="mx-4 mb-4 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
                    <div className="grid grid-cols-3 gap-2 text-center divide-x divide-white/10">
                        <div>
                            <p className="text-lg font-black text-white leading-none">{myTrips.length}</p>
                            <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-0.5">Trips</p>
                        </div>
                        <div>
                            <p className="text-lg font-black text-white leading-none">{uniqueCountries > 0 ? uniqueCountries : myLocations.length}</p>
                            <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-0.5">{uniqueCountries > 0 ? 'Countries' : 'Memories'}</p>
                        </div>
                        <div>
                            <p className="text-lg font-black text-white leading-none">{totalKm > 0 ? totalKm : myLocations.length}</p>
                            <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-0.5">{totalKm > 0 ? 'km' : 'Pins'}</p>
                        </div>
                    </div>
                </div>

                {/* Trip List */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 scrollbar-hide">
                    {tripData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center">
                            <MapIcon size={32} className="text-white/20 mb-3" />
                            <p className="text-white/40 text-xs font-medium leading-relaxed">
                                No expeditions yet.<br />
                                <button onClick={onCreateTrip} className="text-white/70 underline underline-offset-2 mt-1 hover:text-white transition">
                                    Create your first journey
                                </button>
                            </p>
                        </div>
                    ) : (
                        tripData.slice().reverse().map(td => {
                            const isHovered = hoveredTripId === td.trip.id;
                            const country = countries[td.trip.id];
                            return (
                                <div
                                    key={td.trip.id}
                                    onMouseEnter={() => handleTripHover(td)}
                                    onMouseLeave={() => handleTripHover(null)}
                                    onClick={() => onViewTrip(td.trip.id)}
                                    className={`group flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all duration-300 ${isHovered
                                        ? 'bg-white/10 border-white/30 shadow-lg scale-[1.02]'
                                        : 'bg-white/5 border-white/5 hover:bg-white/8 hover:border-white/15'
                                        }`}
                                >
                                    {/* Cover photo */}
                                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/10 relative">
                                        {td.coverPhoto ? (
                                            <img
                                                src={td.coverPhoto}
                                                alt={td.trip.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${td.color}30` }}>
                                                <Camera size={16} style={{ color: td.color }} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-bold text-sm truncate leading-tight">{td.trip.title}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {country && (
                                                <span className="flex items-center gap-0.5 text-white/60 text-[10px] font-medium">
                                                    <MapPin size={8} className="flex-shrink-0" />
                                                    {country}
                                                </span>
                                            )}
                                            {country && td.tripLocs.length > 0 && (
                                                <span className="text-white/25 text-[10px]">·</span>
                                            )}
                                            <span className="text-white/40 text-[10px] font-medium">
                                                {new Date(td.trip.startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Color dot */}
                                    <div
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-300"
                                        style={{
                                            backgroundColor: td.color,
                                            boxShadow: isHovered ? `0 0 12px ${td.color}` : 'none',
                                        }}
                                    />
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── BOTTOM HIGHLIGHTS STRIP ──────────────────────────────── */}
            {tripData.length > 0 && (
                <div className="absolute bottom-0 left-72 right-0 z-20 px-8 pb-28">
                    <div className="flex items-center gap-3 mb-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Highlights</p>
                        <div className="h-px flex-1 bg-white/10" />
                        <p className="text-[9px] font-medium text-white/25">{tripData.length} expeditions</p>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                        {tripData.slice().reverse().map(td => {
                            const country = countries[td.trip.id];
                            return (
                                <div
                                    key={`hl-${td.trip.id}`}
                                    onClick={() => onViewTrip(td.trip.id)}
                                    onMouseEnter={() => handleTripHover(td)}
                                    onMouseLeave={() => handleTripHover(null)}
                                    className="group flex-shrink-0 w-44 cursor-pointer"
                                >
                                    <div className="w-44 h-28 rounded-2xl overflow-hidden bg-white/5 border border-white/10 relative mb-2.5 group-hover:border-white/40 transition-all duration-300 group-hover:shadow-2xl">
                                        {td.coverPhoto ? (
                                            <img
                                                src={td.coverPhoto}
                                                alt={td.trip.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${td.color}15` }}>
                                                <MapIcon size={28} style={{ color: `${td.color}60` }} />
                                            </div>
                                        )}
                                        {/* Gradient overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                        {/* Country badge bottom-left */}
                                        {country && (
                                            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                                                <MapPin size={8} className="text-white/70" />
                                                <span className="text-white text-[8px] font-bold">{country}</span>
                                            </div>
                                        )}
                                        {/* Top color accent dot */}
                                        <div
                                            className="absolute top-2 right-2 w-2 h-2 rounded-full"
                                            style={{ backgroundColor: td.color, boxShadow: `0 0 8px ${td.color}` }}
                                        />
                                    </div>
                                    <p className="text-white text-xs font-bold truncate leading-tight">{td.trip.title}</p>
                                    <p className="text-white/35 text-[9px] uppercase tracking-widest font-bold mt-0.5">
                                        {new Date(td.trip.startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── EMPTY STATE ───────────────────── */}
            {myTrips.length === 0 && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center px-8 bg-[#080808]/80 pointer-events-none">
                    <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                        <Route size={32} className="text-white/30" />
                    </div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-3">Your world awaits</h2>
                    <p className="text-white/40 text-base font-light max-w-sm leading-relaxed mb-8">
                        Start logging your adventures to see all your routes mapped across the globe.
                    </p>
                    <button
                        onClick={onCreateTrip}
                        className="flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full font-black uppercase tracking-widest text-sm hover:scale-105 transition-all shadow-2xl pointer-events-auto"
                    >
                        <Plus size={18} strokeWidth={3} /> Create First Journey
                    </button>
                </div>
            )}
        </div>
    );
};

export default ExpeditionDashboard;
