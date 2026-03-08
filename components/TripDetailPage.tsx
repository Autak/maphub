import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trip, MapLocation, User, Coordinates } from '../types';
import { DIFFICULTY_LEVELS, LOCATION_TYPES } from '../constants';
import { computeTripStats, getRouteCenter } from '../utils/tripStats';
import { ArrowLeft, Heart, MapPin, Calendar, Mountain, Route, Camera, Bookmark, Edit2, Check, X, Trash2, Upload, FileUp, Globe, Plus, Minus, Tag, Map as MapIcon, Loader2, Image, ChevronLeft, ChevronRight } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PhotoLightbox from './PhotoLightbox';
import WeatherWidget from './WeatherWidget';
import PackingChecklist from './PackingChecklist';
import { parseGPX } from '../utils/gpxParser';
import { ALL_TAGS } from '../utils/packingRules';
import { fetchHikingRoute } from '../services/mapyCzRouting';
import { compressImage } from '../services/imageService';
import { generateFunCaption } from '../services/geminiService';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';

const MapEvents: React.FC<{ onClick?: (lat: number, lng: number) => void }> = ({ onClick }) => {
    useMapEvents({
        click(e) {
            if (onClick) onClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
};

const AltitudeProfileWidget = ({ gpxData }: { gpxData: { lat: number; lng: number; ele?: number }[] }) => {
    const elevations = gpxData.map(p => p.ele || 0).filter(e => e > 0);
    if (elevations.length < 2) return null;
    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const range = maxEle - minEle || 1;

    let totalAscent = 0;
    let totalDescent = 0;
    for (let i = 1; i < elevations.length; i++) {
        const diff = elevations[i] - elevations[i - 1];
        if (diff > 0) totalAscent += diff;
        else totalDescent += Math.abs(diff);
    }

    // Create an SVG polygon
    const points = gpxData.map((p, i) => {
        const x = (i / (gpxData.length - 1)) * 100;
        const ele = p.ele || 0;
        const y = 100 - (((ele - minEle) / range) * 100);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    // Add bottom corners to close polygon
    const polygonPoints = `0,100 ${points.join(' ')} 100,100`;

    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 mt-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6 flex items-center gap-2">
                <Mountain size={14} /> Elevation Profile
            </h3>
            <div className="relative h-32 w-full mt-4 flex items-end">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.4)" />
                            <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                        </linearGradient>
                    </defs>
                    <polygon points={polygonPoints} fill="url(#eleGrad)" className="transition-all duration-1000" />
                    <polyline points={points.join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="absolute top-0 left-0 text-[10px] font-bold text-white/40 -mt-4">{Math.round(maxEle)}m</div>
                <div className="absolute bottom-0 left-0 text-[10px] font-bold text-white/40 mb-2">{Math.round(minEle)}m</div>
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
                <div className="text-center">
                    <span className="block text-white text-lg font-black">{Math.round(maxEle)}m</span>
                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Highest Pt</span>
                </div>
                <div className="text-center flex gap-4">
                    <div>
                        <span className="block text-emerald-400 text-lg font-black">+{Math.round(totalAscent)}m</span>
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Ascent</span>
                    </div>
                    <div>
                        <span className="block text-red-400 text-lg font-black">-{Math.round(totalDescent)}m</span>
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Descent</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Polaroid stacked photo gallery ────────────────────────────────────────────
interface PolaroidGalleryProps {
    locations: MapLocation[];
    onPhotoClick: (globalIndex: number) => void;
    isEditable?: boolean;
    onEditLocation?: (loc: MapLocation) => void;
    onDeleteLocation?: (id: string) => void;
}

const STACK_ROTATIONS = [-14, -8, 5, 11]; // degrees for photos behind the active one

const PolaroidGallery: React.FC<PolaroidGalleryProps> = ({ locations, onPhotoClick, isEditable, onEditLocation, onDeleteLocation }) => {
    const [active, setActive] = useState(0);
    const count = locations.length;
    if (count === 0) return null;

    const prev = () => setActive(i => (i - 1 + count) % count);
    const next = () => setActive(i => (i + 1) % count);

    const loc = locations[active];

    // Compute stacked cards: up to 3 "back" photos arranged as fanned polaroids
    const backCards = locations
        .filter((_, i) => i !== active)
        .slice(0, 4)
        .map((l, i) => ({ l, rot: STACK_ROTATIONS[i] ?? (i % 2 === 0 ? -12 : 10) }));

    return (
        <div className="rounded-2xl overflow-hidden bg-[#111]/80 border border-white/8 backdrop-blur">
            {/* Label */}
            <div className="px-4 pt-4 pb-1">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 flex items-center gap-1.5">
                    <Camera size={9} /> Photo Gallery
                </span>
            </div>

            {/* Photo stack area */}
            <div className="relative flex items-center justify-center" style={{ height: 260 }}>
                {/* Fanned back cards */}
                {backCards.map(({ l, rot }, i) => (
                    <div
                        key={l.id}
                        className="absolute"
                        style={{
                            transform: `rotate(${rot}deg) translateY(4px)`,
                            zIndex: i,
                            transformOrigin: 'bottom center',
                        }}
                    >
                        <div className="bg-white p-2 pb-6 shadow-2xl" style={{ width: 160, height: 180 }}>
                            <img src={l.photoUrl} alt={l.title} className="w-full h-full object-cover" />
                        </div>
                    </div>
                ))}

                {/* Active / front card — clickable to open lightbox */}
                <div
                    className="relative cursor-pointer select-none"
                    style={{ zIndex: 10, transform: 'rotate(-1deg)' }}
                    onClick={() => onPhotoClick(active)}
                >
                    <div className="bg-white p-2.5 pb-8 shadow-2xl transition-transform duration-200 hover:scale-[1.02]" style={{ width: 200, height: 230 }}>
                        <img src={loc.photoUrl} alt={loc.title} className="w-full h-full object-cover" />
                    </div>
                    {/* Edit/delete buttons on active card for editable mode */}
                    {isEditable && (
                        <div className="absolute top-4 right-4 flex gap-1 z-20">
                            {onEditLocation && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEditLocation(loc); }}
                                    className="w-6 h-6 flex items-center justify-center bg-white text-black rounded-full shadow-lg hover:scale-110 transition"
                                >
                                    <Edit2 size={10} />
                                </button>
                            )}
                            {onDeleteLocation && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteLocation(loc.id); }}
                                    className="w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-full shadow-lg hover:scale-110 transition"
                                >
                                    <Trash2 size={10} />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Prev arrow */}
                {count > 1 && (
                    <button
                        onClick={prev}
                        className="absolute left-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-white transition"
                    >
                        <ChevronLeft size={16} />
                    </button>
                )}

                {/* Next arrow */}
                {count > 1 && (
                    <button
                        onClick={next}
                        className="absolute right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-white transition"
                    >
                        <ChevronRight size={16} />
                    </button>
                )}
            </div>

            {/* Title + dots */}
            <div className="flex flex-col items-center gap-2 pb-5 pt-1">
                <span className="text-white font-bold text-sm tracking-wide">{loc.title}</span>
                {count > 1 && (
                    <div className="flex gap-1.5">
                        {locations.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setActive(i)}
                                className={`rounded-full transition-all duration-200 ${i === active ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'
                                    }`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
// ──────────────────────────────────────────────────────────────────────────────

interface MiniMapProps {
    center: { lat: number; lng: number };
    routePositions: [number, number][];
    gpxPositions: [number, number][];
    tripLocations: MapLocation[];
    authorColor: string;
    hikingRoutes?: any[];
    routePlanMode?: boolean;
    pendingWaypoints?: ({ lat: number, lng: number } | null)[];
    pendingRoute?: [number, number][];
    onPlanMapClick?: (lat: number, lng: number) => void;
    pendingMemoryPin?: { lat: number, lng: number } | null;
    onMemoryMapClick?: (lat: number, lng: number) => void;
}

const MiniMap: React.FC<MiniMapProps> = ({ center, routePositions, gpxPositions, tripLocations, authorColor, hikingRoutes = [], routePlanMode = false, pendingWaypoints = [], pendingRoute, onPlanMapClick, pendingMemoryPin, onMemoryMapClick }) => {
    const apiKey = (import.meta as any).env.VITE_MAPY_API_KEY || '';
    const tileUrl = `https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=${apiKey}`;

    return (
        <div className="w-full h-full relative z-0 bg-[#050505]">
            <MapContainer
                center={[center.lat, center.lng]}
                zoom={10}
                scrollWheelZoom={true}
                dragging={true}
                zoomControl={true}
                attributionControl={false}
                className="h-full w-full"
            >
                <TileLayer url={tileUrl} />
                <MapEvents onClick={(lat, lng) => {
                    if (onPlanMapClick) onPlanMapClick(lat, lng);
                    if (onMemoryMapClick) onMemoryMapClick(lat, lng);
                }} />

                {gpxPositions.length > 1 && (
                    <Polyline
                        positions={gpxPositions}
                        pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }}
                    />
                )}


                {/* Saved Hiking Routes */}
                {hikingRoutes.map((hr, idx) => (
                    <Polyline
                        key={idx}
                        positions={hr.points.map((p: any) => [p.lat, p.lng])}
                        pathOptions={{ color: '#22c55e', weight: 4, opacity: 0.8 }} // Green for saved routes
                    />
                ))}

                {/* Plan Mode Overlays */}
                {routePlanMode && pendingRoute && (
                    <Polyline
                        positions={pendingRoute}
                        pathOptions={{ color: '#ec4899', weight: 4, opacity: 0.8 }} // Pink for active planning
                    />
                )}
                {routePlanMode && pendingWaypoints.map((wp, i) => {
                    if (!wp) return null;
                    const isStart = i === 0;
                    const isEnd = i === pendingWaypoints.length - 1 && wp;
                    let bgColor = '#fff';
                    if (isStart) bgColor = '#22c55e';
                    else if (isEnd) bgColor = '#ef4444';

                    return (
                        <Marker
                            key={`wp-${i}`}
                            position={[wp.lat, wp.lng]}
                            icon={L.divIcon({
                                className: 'custom-div-icon',
                                html: `<div style="background-color: ${bgColor}; border: 2px solid ${authorColor}; border-radius: 50%; width: 12px; height: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.5);"></div>`,
                                iconSize: [12, 12],
                                iconAnchor: [6, 6],
                            })}
                        />
                    );
                })}
                {tripLocations.map((loc) => (
                    <Marker
                        key={loc.id}
                        position={[loc.coords.lat, loc.coords.lng]}
                        icon={L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div style="background-color: white; border: 3px solid ${authorColor}; border-radius: 50%; width: 14px; height: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></div>`,
                            iconSize: [14, 14],
                            iconAnchor: [7, 7],
                        })}
                    >
                        <Popup className="custom-popup" closeButton={false}>
                            <div className="w-48 overflow-hidden rounded-xl bg-black/90 text-white border border-white/10 shadow-2xl backdrop-blur-xl -ml-1">
                                {loc.photoUrl && (
                                    <div className="h-32 w-full">
                                        <img src={loc.photoUrl} alt={loc.title} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="p-3 font-sans">
                                    <h4 className="font-bold text-sm mb-1 truncate text-white">{loc.title}</h4>
                                    <p className="text-xs text-white/60 line-clamp-2">{loc.comment}</p>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Pending Memory Marker */}
                {pendingMemoryPin && (
                    <Marker
                        position={[pendingMemoryPin.lat, pendingMemoryPin.lng]}
                        icon={L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div style="background-color: #f59e0b; border: 3px solid white; border-radius: 50%; width: 16px; height: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); animation: pulse 2s infinite;"></div>`,
                            iconSize: [16, 16],
                            iconAnchor: [8, 8],
                        })}
                    />
                )}
            </MapContainer>
        </div>
    );
};

interface TripDetailPageProps {
    trip: Trip;
    locations: MapLocation[];
    author: User;
    currentUser: User;
    onBack: () => void;
    onLike: (tripId: string) => void;
    onBookmark: (tripId: string) => void;
    isEditable?: boolean;
    onUpdateTrip?: (tripId: string, data: any) => Promise<any>;
    onUpdateLocation?: (locationId: string, data: any) => Promise<any>;
    onDeleteLocation?: (locationId: string) => Promise<void>;
    onDeleteTrip?: (tripId: string) => Promise<void>;
    onAddLocation?: (data: Omit<MapLocation, 'id' | 'comments'>) => Promise<any>;
}

const TripDetailPage: React.FC<TripDetailPageProps> = ({
    trip, locations, author, currentUser, onBack, onLike, onBookmark,
    isEditable = false, onUpdateTrip, onUpdateLocation, onDeleteLocation, onDeleteTrip, onAddLocation
}) => {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    // Editing states
    const [editingTitle, setEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState(trip.title);
    const [editingDesc, setEditingDesc] = useState(false);
    const [editDesc, setEditDesc] = useState(trip.description);
    const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
    const [editLocTitle, setEditLocTitle] = useState('');
    const [editLocComment, setEditLocComment] = useState('');
    const [editLocType, setEditLocType] = useState('');
    const [gpxUploading, setGpxUploading] = useState(false);
    const [editingTags, setEditingTags] = useState(false);
    const [editTags, setEditTags] = useState<string[]>(trip.tags || []);
    const [editDistance, setEditDistance] = useState(trip.gpxStats?.distanceKm || 0);
    const [editDays, setEditDays] = useState(trip.gpxStats?.estimatedDays || 0);

    const [routePlanMode, setRoutePlanMode] = useState(false);
    const [pendingWaypoints, setPendingWaypoints] = useState<({ lat: number, lng: number } | null)[]>([null]);
    const [pendingRoute, setPendingRoute] = useState<[number, number][] | null>(null);
    const [routingLoading, setRoutingLoading] = useState(false);
    const [routingError, setRoutingError] = useState<string | null>(null);
    const [newRouteName, setNewRouteName] = useState('');
    const [pendingRouteKm, setPendingRouteKm] = useState(0);
    const [pendingRouteAscent, setPendingRouteAscent] = useState(0);
    const [pendingRouteDescent, setPendingRouteDescent] = useState(0);
    const [pendingRoutePoints, setPendingRoutePoints] = useState<any[]>([]);
    const [routeDay, setRouteDay] = useState<number | 'all'>('all');

    // Add Memory modal state (per-day)
    const [addMemoryDay, setAddMemoryDay] = useState<{ dayIndex: number; date: Date } | null>(null);
    const [memoryTitle, setMemoryTitle] = useState('');
    const [memoryComment, setMemoryComment] = useState('');
    const [memoryPhotoPreview, setMemoryPhotoPreview] = useState<string | null>(null);
    const [memoryPhotoFile, setMemoryPhotoFile] = useState<File | null>(null);
    const [memoryType, setMemoryType] = useState<MapLocation['type']>('adventure');
    const [memoryPinCoords, setMemoryPinCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isPlacingMemoryPin, setIsPlacingMemoryPin] = useState(false);
    const [memoryIsCompressing, setMemoryIsCompressing] = useState(false);
    const [memoryIsGenerating, setMemoryIsGenerating] = useState(false);
    const [memoryIsSaving, setMemoryIsSaving] = useState(false);
    const memoryFileInputRef = useRef<HTMLInputElement>(null);

    const handleMapClick = async (lat: number, lng: number) => {
        if (!routePlanMode) return;

        const lastEl = pendingWaypoints[pendingWaypoints.length - 1];
        if (lastEl === null) {
            const newWps = [...pendingWaypoints];
            newWps[newWps.length - 1] = { lat, lng };
            if (newWps.length < 8) newWps.push(null);
            setPendingWaypoints(newWps);

            const validWps = newWps.filter(w => w !== null) as { lat: number, lng: number }[];
            if (validWps.length >= 2) {
                setRoutingLoading(true);
                setRoutingError(null);
                try {
                    const apiKey = (import.meta as any).env.VITE_MAPY_API_KEY || '';
                    const route = await fetchHikingRoute(validWps, apiKey);
                    setPendingRoute(route.points.map((p: any) => [p.lat, p.lng] as [number, number]));
                    setPendingRouteKm(route.distanceKm);
                    setPendingRouteAscent(route.ascent || 0);
                    setPendingRouteDescent(route.descent || 0);
                    setPendingRoutePoints(route.points);
                } catch (err: any) {
                    console.error(err);
                    setRoutingError(err.message || 'Failed to calculate route');
                } finally {
                    setRoutingLoading(false);
                }
            } else {
                setPendingRoute(null);
                setPendingRouteKm(0);
                setPendingRouteAscent(0);
                setPendingRouteDescent(0);
                setPendingRoutePoints([]);
            }
        }
    };

    const handleMemoryMapClick = (lat: number, lng: number) => {
        if (!isPlacingMemoryPin) return;
        setMemoryPinCoords({ lat, lng });
        setIsPlacingMemoryPin(false); // Map clicked, exit map-pin mode to show modal
    };

    const handleSaveRoute = async () => {
        if (!onUpdateTrip || !pendingRoute || !newRouteName) return;
        const currentRoutes = trip.hikingRoutes || [];
        const newRoute = {
            name: newRouteName,
            points: pendingRoutePoints,
            distanceKm: pendingRouteKm,
            ascent: pendingRouteAscent,
            descent: pendingRouteDescent,
            day: routeDay
        };
        const updated = await onUpdateTrip(trip.id, { hikingRoutes: [...currentRoutes, newRoute] });
        if (updated) {
            setRoutePlanMode(false);
            setPendingWaypoints([null]);
            setPendingRoute(null);
            setNewRouteName('');
            setPendingRouteKm(0);
            setPendingRoutePoints([]);
            setRouteDay('all');
        }
    };

    const handleDeleteRoute = async (indexToDelete: number) => {
        if (!onUpdateTrip || !trip.hikingRoutes) return;
        const confirmDelete = window.confirm("Are you sure you want to delete this route?");
        if (!confirmDelete) return;
        const updatedRoutes = trip.hikingRoutes.filter((_, i) => i !== indexToDelete);
        await onUpdateTrip(trip.id, { hikingRoutes: updatedRoutes });
    };

    const openAddMemory = (dayIndex: number, date: Date) => {
        setAddMemoryDay({ dayIndex, date });
        setMemoryTitle('');
        setMemoryComment('');
        setMemoryPhotoPreview(null);
        setMemoryPhotoFile(null);
        setMemoryType('adventure');
        setMemoryPinCoords(null);
        setIsPlacingMemoryPin(true); // Always start by placing the pin on the map
    };

    const handleMemoryPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        const file = e.target.files[0];
        setMemoryPhotoFile(file);
        setMemoryIsCompressing(true);
        try {
            const compressed = await compressImage(file);
            setMemoryPhotoPreview(compressed);
        } catch { alert('Could not process image.'); }
        finally { setMemoryIsCompressing(false); }
    };

    const handleMemoryAiCaption = async () => {
        if (!memoryPhotoFile) return;
        setMemoryIsGenerating(true);
        try {
            const caption = await generateFunCaption(memoryPhotoFile, memoryTitle);
            setMemoryComment(caption);
        } catch { /* silent */ }
        finally { setMemoryIsGenerating(false); }
    };

    const handleSaveMemory = async () => {
        if (!onAddLocation || !addMemoryDay || !memoryTitle || !memoryPhotoPreview) return;
        setMemoryIsSaving(true);
        try {
            // Set timestamp to that day at noon, or now if today
            const targetDate = new Date(addMemoryDay.date);
            const now = new Date();
            if (targetDate.toDateString() === now.toDateString()) {
                targetDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            } else {
                targetDate.setHours(12, 0, 0, 0);
            }
            // Use pinned coords, fallback to map center
            const coords = memoryPinCoords || mapCenter || { lat: 0, lng: 0 };
            await onAddLocation({
                tripId: trip.id,
                userId: author.id,
                coords,
                title: memoryTitle,
                comment: memoryComment,
                photoUrl: memoryPhotoPreview,
                type: memoryType,
                timestamp: targetDate.getTime(),
            });
            setAddMemoryDay(null);
        } catch { /* silent */ }
        finally { setMemoryIsSaving(false); }
    };


    const [draggedLocationId, setDraggedLocationId] = useState<string | null>(null);

    const [newLinkLabel, setNewLinkLabel] = useState('');
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [externalLinks, setExternalLinks] = useState(trip.externalLinks || []);

    const gpxInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollY } = useScroll({ container: containerRef });
    const yHero = useTransform(scrollY, [0, 500], [0, 150]);
    const opacityHero = useTransform(scrollY, [0, 400], [1, 0]);

    const tripLocations = useMemo(
        () => locations.filter(l => l.tripId === trip.id).sort((a, b) => a.timestamp - b.timestamp),
        [locations, trip.id]
    );

    const locationIndexOf = (loc: MapLocation) => tripLocations.findIndex(l => l.id === loc.id);

    const stats = useMemo(() => computeTripStats(tripLocations, trip.startDate, trip.endDate), [tripLocations, trip.startDate, trip.endDate]);

    useEffect(() => {
        if (trip.gpxStats) {
            setEditDistance(trip.gpxStats.distanceKm || 0);
            setEditDays(trip.gpxStats.estimatedDays || 0);
        } else {
            setEditDistance(stats.distance || 0);
            setEditDays(stats.days || 0);
        }
    }, [trip.gpxStats, stats]);

    const center = useMemo(() => getRouteCenter(tripLocations), [tripLocations]);
    const isLiked = trip.likes?.includes(currentUser.id);
    const isBookmarked = currentUser.bookmarks?.includes(trip.id);

    const difficultyInfo = trip.difficulty ? DIFFICULTY_LEVELS.find(d => d.id === trip.difficulty) : null;
    const coverUrl = trip.coverPhotoUrl || (tripLocations.length > 0 ? tripLocations[0].photoUrl : 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b');

    const routePositions: [number, number][] = tripLocations
        .filter(l => l.coords && !isNaN(l.coords.lat) && !isNaN(l.coords.lng))
        .map(l => [l.coords.lat, l.coords.lng]);

    const gpxPositions: [number, number][] = (trip.gpxData || [])
        .filter(p => !isNaN(p.lat) && !isNaN(p.lng))
        .map(p => [p.lat, p.lng]);

    const mapCenter = useMemo(() => {
        if (gpxPositions.length > 0) {
            const latSum = gpxPositions.reduce((s, p) => s + p[0], 0);
            const lngSum = gpxPositions.reduce((s, p) => s + p[1], 0);
            return { lat: latSum / gpxPositions.length, lng: lngSum / gpxPositions.length };
        }
        return center;
    }, [gpxPositions, center]);

    const days = useMemo(() => {
        const start = new Date(trip.startDate);
        start.setHours(0, 0, 0, 0);
        const end = trip.endDate ? new Date(trip.endDate) : new Date(trip.startDate);
        end.setHours(0, 0, 0, 0);

        const dayList = [];
        const current = new Date(start);
        let index = 0;
        while (current <= end && dayList.length < 365) {
            dayList.push({ index, date: new Date(current), label: `Day ${index + 1}` });
            current.setDate(current.getDate() + 1);
            index++;
        }
        return dayList;
    }, [trip.startDate, trip.endDate]);

    const locationsByDay = useMemo(() => {
        const grouped: Record<number, MapLocation[]> = {};
        days.forEach(d => grouped[d.index] = []);

        tripLocations.forEach(loc => {
            const locDate = new Date(loc.timestamp);
            locDate.setHours(0, 0, 0, 0);
            const tripStart = new Date(trip.startDate);
            tripStart.setHours(0, 0, 0, 0);
            const dayIndex = Math.round((locDate.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24));

            if (grouped[dayIndex]) grouped[dayIndex].push(loc);
            else {
                if (dayIndex < 0 && grouped[0]) grouped[0].push(loc);
                else if (dayIndex >= days.length && grouped[days.length - 1]) grouped[days.length - 1].push(loc);
            }
        });
        return grouped;
    }, [tripLocations, days, trip.startDate]);

    const saveTitle = async () => {
        if (onUpdateTrip && editTitle.trim()) await onUpdateTrip(trip.id, { title: editTitle.trim() });
        setEditingTitle(false);
    };

    const saveDesc = async () => {
        if (onUpdateTrip) await onUpdateTrip(trip.id, { description: editDesc });
        setEditingDesc(false);
    };

    const startEditingLocation = (loc: MapLocation) => {
        setEditingLocationId(loc.id);
        setEditLocTitle(loc.title);
        setEditLocComment(loc.comment);
        setEditLocType(loc.type);
    };

    const saveLocationEdit = async () => {
        if (onUpdateLocation && editingLocationId) {
            await onUpdateLocation(editingLocationId, { title: editLocTitle, comment: editLocComment, type: editLocType });
        }
        setEditingLocationId(null);
    };

    const handleGPXUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0] || !onUpdateTrip) return;
        setGpxUploading(true);
        try {
            const text = await e.target.files[0].text();
            const result = parseGPX(text);
            if (result.points.length === 0) return alert('No track points found.');
            await onUpdateTrip(trip.id, {
                gpxData: result.points,
                gpxStats: { distanceKm: result.distanceKm, estimatedDays: result.estimatedDays }
            });
        } catch (err) {
            console.error('GPX parse failed:', err);
            alert('Failed to parse GPX.');
        } finally {
            setGpxUploading(false);
            if (gpxInputRef.current) gpxInputRef.current.value = '';
        }
    };

    const addExternalLink = async () => {
        if (!newLinkLabel.trim() || !newLinkUrl.trim() || !onUpdateTrip) return;
        let url = newLinkUrl.trim();
        if (!url.startsWith('http')) url = 'https://' + url;
        const updatedLinks = [...externalLinks, { label: newLinkLabel.trim(), url }];
        const updated = await onUpdateTrip(trip.id, { externalLinks: updatedLinks });
        if (updated) setExternalLinks(updated.externalLinks || updatedLinks);
        setNewLinkLabel(''); setNewLinkUrl('');
    };

    const removeLink = async (index: number) => {
        if (!onUpdateTrip) return;
        const updatedLinks = externalLinks.filter((_, i) => i !== index);
        const updated = await onUpdateTrip(trip.id, { externalLinks: updatedLinks });
        if (updated) setExternalLinks(updated.externalLinks || updatedLinks);
    };

    const handleUpdatePackingItems = async (items: string[]) => {
        if (onUpdateTrip) await onUpdateTrip(trip.id, { packingItems: items });
    };

    const handleSavePackList = async (items: string[]) => {
        if (onUpdateTrip) await onUpdateTrip(trip.id, { packingList: items });
    };

    const toggleEditTag = (tag: string) => {
        setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const saveTags = async () => {
        if (onUpdateTrip) await onUpdateTrip(trip.id, { tags: editTags });
        setEditingTags(false);
    };

    const handleStatChange = async (field: 'distance' | 'days', value: string) => {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) return;

        const newStats = {
            distanceKm: field === 'distance' ? numVal : editDistance,
            estimatedDays: field === 'days' ? numVal : editDays,
        };
        if (field === 'distance') setEditDistance(numVal);
        if (field === 'days') setEditDays(numVal);
        if (onUpdateTrip) await onUpdateTrip(trip.id, { gpxStats: newStats });
    };

    const handleSaveDayComment = async (dayIndex: number, comment: string) => {
        if (!onUpdateTrip) return;
        const updatedComments = { ...trip.dayComments, [dayIndex]: comment };
        await onUpdateTrip(trip.id, { dayComments: updatedComments });
    };

    const handleAddDay = async () => {
        if (!onUpdateTrip) return;
        const currentEnd = trip.endDate ? new Date(trip.endDate) : new Date(trip.startDate);
        const newEnd = new Date(currentEnd);
        newEnd.setDate(newEnd.getDate() + 1);
        await onUpdateTrip(trip.id, { endDate: newEnd.getTime() });
    };

    const handleRemoveDay = async () => {
        if (!onUpdateTrip) return;
        if (trip.endDate && new Date(trip.endDate) <= new Date(trip.startDate)) return;
        if (!trip.endDate) return;

        const currentEnd = new Date(trip.endDate);
        const newEnd = new Date(currentEnd);
        newEnd.setDate(newEnd.getDate() - 1);

        if (newEnd < new Date(trip.startDate)) {
            await onUpdateTrip(trip.id, { endDate: new Date(trip.startDate).getTime() });
        } else {
            await onUpdateTrip(trip.id, { endDate: newEnd.getTime() });
        }
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        if (!isEditable) return;
        e.dataTransfer.setData('locationId', id);
        setDraggedLocationId(id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!isEditable) return;
        e.preventDefault();
    };

    const handleDropOnDay = async (e: React.DragEvent, dayIndex: number) => {
        if (!isEditable || !onUpdateLocation) return;
        e.preventDefault();
        const locId = e.dataTransfer.getData('locationId');
        if (!locId) return;
        setDraggedLocationId(null);

        const loc = locations.find(l => l.id === locId);
        if (!loc) return;

        const targetDay = days[dayIndex];
        const newDate = new Date(targetDay.date);
        const oldDate = new Date(loc.timestamp);
        newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds());

        await onUpdateLocation(locId, { timestamp: newDate.getTime() });
    };

    return (
        <div ref={containerRef} className="w-full h-full bg-[#050505] text-white overflow-y-auto overflow-x-hidden pb-32 font-sans relative">
            {/* Nav / Floating Back Button */}
            <div className="fixed top-6 left-6 z-[100]">
                <button
                    onClick={onBack}
                    className="w-12 h-12 rounded-full bg-white/10 hover:bg-white text-white hover:text-black flex items-center justify-center backdrop-blur-md transition-all border border-white/20 shadow-2xl"
                >
                    <ArrowLeft size={20} />
                </button>
            </div>

            {/* Admin Header Actions */}
            {isEditable && (
                <div className="fixed top-6 right-6 z-[100] flex gap-3">
                    <button
                        onClick={() => gpxInputRef.current?.click()}
                        disabled={gpxUploading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white text-white hover:text-black backdrop-blur-md rounded-full text-xs font-bold transition-all border border-white/20"
                    >
                        <FileUp size={14} />
                        {gpxUploading ? 'Uploading...' : trip.gpxData ? 'Replace GPX' : 'Upload GPX'}
                    </button>
                    <input ref={gpxInputRef} type="file" accept=".gpx" onChange={handleGPXUpload} className="hidden" />

                    {onDeleteTrip && (
                        <button
                            onClick={() => {
                                if (window.confirm('Are you sure you want to delete this trip? This action cannot be undone.')) {
                                    onDeleteTrip(trip.id).then(onBack);
                                }
                            }}
                            className="w-10 h-10 flex items-center justify-center bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white backdrop-blur-md rounded-full text-xs font-bold transition-all border border-red-500/30"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            )}

            {/* Hero Parallax Section */}
            <div className="relative h-[80vh] min-h-[600px] w-full overflow-hidden">
                <motion.div
                    style={{ y: yHero, opacity: opacityHero }}
                    className="absolute inset-0 w-full h-[120%]"
                >
                    <img src={coverUrl} alt={trip.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
                </motion.div>

                <div className="absolute inset-x-0 bottom-0 p-8 md:p-16 flex flex-col justify-end z-10">
                    <div className="max-w-screen-2xl mx-auto w-full">
                        {/* Editor specific top bars */}
                        <div className="flex items-center gap-3 mb-6 flex-wrap">
                            {isEditable ? (
                                <>
                                    <select
                                        value={trip.difficulty || ''}
                                        onChange={(e) => onUpdateTrip?.(trip.id, { difficulty: e.target.value })}
                                        className="bg-white/10 backdrop-blur-md text-white border border-white/20 text-xs font-bold px-4 py-2 rounded-full outline-none focus:bg-white focus:text-black transition-all appearance-none"
                                    >
                                        <option value="" disabled>Select Difficulty</option>
                                        {DIFFICULTY_LEVELS.map(d => (
                                            <option key={d.id} value={d.id} className="text-black">{d.label}</option>
                                        ))}
                                    </select>

                                    <select
                                        value={trip.visibility}
                                        onChange={(e) => onUpdateTrip?.(trip.id, { visibility: e.target.value })}
                                        className="bg-white/10 backdrop-blur-md text-white border border-white/20 text-xs font-bold px-4 py-2 rounded-full outline-none focus:bg-white focus:text-black transition-all appearance-none"
                                    >
                                        <option value="public" className="text-black">Public</option>
                                        <option value="private" className="text-black">Private</option>
                                    </select>
                                </>
                            ) : (
                                difficultyInfo && (
                                    <span className={`bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2`}>
                                        {difficultyInfo.icon} {difficultyInfo.label}
                                    </span>
                                )
                            )}

                            {isEditable ? (
                                editingTags ? (
                                    <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 rounded-full backdrop-blur-md">
                                        <Tag size={12} className="text-white/50" />
                                        <div className="flex flex-wrap gap-2">
                                            {editTags.map(tag => (
                                                <span key={tag} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-white bg-white/20 px-2 py-0.5 rounded-sm">
                                                    {tag} <button onClick={() => toggleEditTag(tag)} className="hover:text-red-400"><X size={10} /></button>
                                                </span>
                                            ))}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Add tag..."
                                            className="bg-transparent text-[10px] font-bold text-white outline-none w-20 uppercase tracking-widest placeholder:text-white/30"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && e.currentTarget.value) {
                                                    toggleEditTag(e.currentTarget.value.trim());
                                                    e.currentTarget.value = '';
                                                }
                                            }}
                                        />
                                        <button onClick={saveTags} className="ml-2 hover:text-green-400 text-white"><Check size={14} /></button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { setEditingTags(true); setEditTags(trip.tags || []); }}
                                        className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-full transition flex items-center gap-2"
                                    >
                                        <Tag size={12} /> <span className="text-[10px] font-black uppercase tracking-widest">Edit Tags</span>
                                    </button>
                                )
                            ) : (
                                trip.tags?.map(tag => (
                                    <span key={tag} className="bg-white/10 border border-white/20 backdrop-blur-md text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest">
                                        {tag}
                                    </span>
                                ))
                            )}
                        </div>

                        {/* Title Editing */}
                        {isEditable && editingTitle ? (
                            <div className="flex items-center gap-4 mb-6">
                                <input
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    className="text-5xl md:text-7xl lg:text-8xl font-black text-white bg-transparent border-b-2 border-white/30 focus:border-white outline-none w-full max-w-4xl"
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && saveTitle()}
                                />
                                <button onClick={saveTitle} className="p-4 bg-white text-black rounded-full hover:scale-105 transition"><Check size={24} /></button>
                                <button onClick={() => { setEditingTitle(false); setEditTitle(trip.title); }} className="p-4 bg-white/10 border border-white/20 text-white rounded-full hover:bg-white/20 transition"><X size={24} /></button>
                            </div>
                        ) : (
                            <div className="group relative w-fit mb-6">
                                <h1 className="text-5xl md:text-7xl lg:text-[7rem] leading-[0.9] font-black text-white tracking-tighter drop-shadow-2xl">
                                    {trip.title}
                                </h1>
                                {isEditable && (
                                    <button onClick={() => setEditingTitle(true)} className="absolute -top-4 -right-12 p-3 bg-white/10 border border-white/20 backdrop-blur text-white rounded-full hover:bg-white transition opacity-0 group-hover:opacity-100 hover:text-black">
                                        <Edit2 size={16} />
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-6 text-white/50 text-sm font-medium">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 bg-white/10 backdrop-blur flex items-center justify-center">
                                    {author.avatarUrl ? (
                                        <img src={author.avatarUrl} alt={author.username} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[10px] text-white font-bold">{author.username.substring(0, 2).toUpperCase()}</span>
                                    )}
                                </div>
                                <span className="font-bold text-white uppercase tracking-widest text-[10px]">{author.username}</span>
                            </div>
                            <div className="w-1 h-1 rounded-full bg-white/30" />
                            {isEditable ? (
                                <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1.5 rounded-full backdrop-blur-md">
                                    <Calendar size={14} className="text-white/50" />
                                    <input
                                        type="date"
                                        value={new Date(trip.startDate).toISOString().split('T')[0]}
                                        onChange={async (e) => {
                                            if (!onUpdateTrip) return;
                                            const newDate = new Date(e.target.value);
                                            await onUpdateTrip(trip.id, { startDate: newDate.getTime() });
                                        }}
                                        className="bg-transparent text-[10px] font-bold text-white uppercase tracking-widest outline-none [&::-webkit-calendar-picker-indicator]:invert"
                                    />
                                </div>
                            ) : (
                                <span className="flex items-center gap-2 uppercase tracking-widest text-[10px] font-bold text-white/80">
                                    <Calendar size={14} />
                                    {new Date(trip.startDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Split Layout Container */}
            <div className="max-w-screen-2xl mx-auto w-full px-6 md:px-16 grid grid-cols-1 lg:grid-cols-12 gap-12 mt-12">

                {/* Left Column: Content & Timeline */}
                <div className="lg:col-span-6 xl:col-span-5 space-y-16 pb-32">

                    {/* Floating Action Bar */}
                    <div className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl sticky top-6 z-40 shadow-2xl">
                        <div className="flex gap-8">
                            <div className="group relative">
                                {isEditable ? (
                                    <input
                                        type="number"
                                        value={editDistance}
                                        onChange={(e) => setEditDistance(parseFloat(e.target.value))}
                                        onBlur={(e) => handleStatChange('distance', e.target.value)}
                                        className="block text-2xl font-black text-white w-28 bg-transparent border-b border-white/20 focus:border-white outline-none"
                                    />
                                ) : (
                                    <span className="block text-3xl font-black text-white">{trip.gpxStats?.distanceKm || stats.distance}</span>
                                )}
                                <span className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] mt-1 block">Kilometers</span>
                            </div>

                            <div className="group relative">
                                {isEditable ? (
                                    <input
                                        type="number"
                                        value={editDays}
                                        onChange={(e) => setEditDays(parseFloat(e.target.value))}
                                        onBlur={(e) => handleStatChange('days', e.target.value)}
                                        className="block text-2xl font-black text-white w-20 bg-transparent border-b border-white/20 focus:border-white outline-none"
                                    />
                                ) : (
                                    <span className="block text-3xl font-black text-white">{trip.gpxStats?.estimatedDays || stats.days}</span>
                                )}
                                <span className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] mt-1 block">Days</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => onBookmark(trip.id)}
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border ${isBookmarked ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'}`}
                            >
                                <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} strokeWidth={isBookmarked ? 0 : 2} />
                            </button>
                            <button
                                onClick={() => onLike(trip.id)}
                                className={`flex items-center gap-2 px-5 rounded-full font-bold text-sm transition-all border ${isLiked ? 'bg-red-500 border-red-500 text-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'}`}
                            >
                                <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={isLiked ? 0 : 2} />
                                {trip.likes?.length || 0}
                            </button>
                        </div>
                    </div>

                    {/* Description Paragraph */}
                    <div className="group relative">
                        {isEditable && editingDesc ? (
                            <div className="w-full">
                                <textarea
                                    value={editDesc}
                                    onChange={e => setEditDesc(e.target.value)}
                                    className="w-full p-6 bg-white/5 rounded-3xl border border-white/20 focus:border-white outline-none text-white text-lg resize-none h-48 backdrop-blur"
                                />
                                <div className="flex gap-3 mt-4">
                                    <button onClick={saveDesc} className="px-6 py-2.5 bg-white text-black rounded-full font-bold text-sm hover:scale-105 transition-transform">Save Story</button>
                                    <button onClick={() => { setEditingDesc(false); setEditDesc(trip.description); }} className="px-6 py-2.5 bg-white/10 border border-white/20 text-white rounded-full font-bold text-sm hover:bg-white/20 transition">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                <p className="text-white/80 text-lg md:text-xl leading-relaxed font-light font-sans">
                                    {trip.description}
                                </p>
                                {isEditable && (
                                    <button onClick={() => setEditingDesc(true)} className="absolute -top-4 -right-12 p-3 bg-white/10 border border-white/20 backdrop-blur text-white rounded-full hover:bg-white transition opacity-0 group-hover:opacity-100 hover:text-black">
                                        <Edit2 size={16} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* TIMELINE */}
                    <div className="relative">
                        <div className="flex items-center justify-between mb-10">
                            <h2 className="text-2xl font-black text-white flex items-center gap-3 tracking-tighter">
                                <Route size={24} className="text-white/40" />
                                Journey Log
                            </h2>
                            {isEditable && (
                                <div className="flex items-center gap-2">
                                    <button onClick={handleRemoveDay} className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition"><Minus size={16} /></button>
                                    <button onClick={handleAddDay} className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition"><Plus size={16} /></button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-12">
                            {/* Render 'all' days hiking routes top-level if any */}
                            {Array.isArray(trip.hikingRoutes) && trip.hikingRoutes.some(r => r.day === 'all' || r.day === undefined) && (
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
                                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Route size={16} className="text-pink-400" /> Overall Trip Routes</h3>
                                    <div className="space-y-4">
                                        {trip.hikingRoutes.map((route, idx) => ({ route, idx })).filter(r => r.route.day === 'all' || r.route.day === undefined).map(({ route, idx }) => (
                                            <div key={idx} className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5">
                                                <div>
                                                    <span className="font-bold text-white text-base block">{route.name}</span>
                                                    <div className="flex gap-4 text-xs font-bold text-white/50 mt-1">
                                                        <span>{route.distanceKm} km</span>
                                                        <span className="text-green-400">+{route.ascent}m</span>
                                                        <span className="text-red-400">-{route.descent}m</span>
                                                    </div>
                                                </div>
                                                {isEditable && (
                                                    <button onClick={() => handleDeleteRoute(idx)} className="p-2 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {days.map((day) => {
                                const dayLocations = locationsByDay[day.index] || [];
                                return (
                                    <div
                                        key={day.index}
                                        className="relative pl-10 border-l border-white/10 pb-8 last:pb-0"
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDropOnDay(e, day.index)}
                                    >
                                        {/* Day Node Marker */}
                                        <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />

                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-6 flex items-center gap-4">
                                            <span className="text-white text-base">{day.label}</span>
                                            <span className="h-px bg-white/10 flex-1" />
                                            <span>{day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                        </h3>

                                        {/* Edit form – shown when editing a specific location */}
                                        {editingLocationId && dayLocations.some(l => l.id === editingLocationId) && (
                                            <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/20 p-6 space-y-4 mb-4">
                                                <input value={editLocTitle} onChange={e => setEditLocTitle(e.target.value)} className="w-full font-bold text-xl text-white bg-transparent border-b border-white/20 focus:outline-none focus:border-white pb-2" placeholder="Waypoint Name" />
                                                <textarea value={editLocComment} onChange={e => setEditLocComment(e.target.value)} className="w-full text-base text-white/80 bg-black/20 border border-white/10 rounded-xl p-4 focus:ring-1 focus:ring-white focus:outline-none resize-none h-24" placeholder="Memory details..." />
                                                <select value={editLocType} onChange={e => setEditLocType(e.target.value)} className="text-xs border border-white/20 bg-black text-white rounded-lg px-3 py-2 focus:ring-1 focus:ring-white focus:outline-none appearance-none">
                                                    {LOCATION_TYPES.map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                                                </select>
                                                <div className="flex gap-3 justify-end pt-2">
                                                    <button onClick={() => setEditingLocationId(null)} className="px-4 py-2 text-xs font-bold text-white/50 hover:bg-white/10 rounded-lg transition">Cancel</button>
                                                    <button onClick={saveLocationEdit} className="px-4 py-2 text-xs bg-white text-black rounded-lg hover:scale-105 transition font-bold">Save</button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Polaroid stacked gallery */}
                                        {dayLocations.length > 0 && (
                                            <PolaroidGallery
                                                locations={dayLocations}
                                                onPhotoClick={(i) => setLightboxIndex(locationIndexOf(dayLocations[i]))}
                                                isEditable={isEditable}
                                                onEditLocation={isEditable ? startEditingLocation : undefined}
                                                onDeleteLocation={isEditable && onDeleteLocation ? (id) => onDeleteLocation(id) : undefined}
                                            />
                                        )}

                                        {/* Day Hiking Routes */}
                                        {Array.isArray(trip.hikingRoutes) && trip.hikingRoutes.some(r => r.day === day.index) && (
                                            <div className="mt-6 space-y-3">
                                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2"><Route size={12} /> Day Trails</h4>
                                                {trip.hikingRoutes.map((route, idx) => ({ route, idx })).filter(r => r.route.day === day.index).map(({ route, idx }) => (
                                                    <div key={idx} className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5 group">
                                                        <div>
                                                            <span className="font-bold text-white text-sm block">{route.name}</span>
                                                            <div className="flex gap-3 text-xs font-bold text-white/50 mt-1">
                                                                <span>{route.distanceKm} km</span>
                                                                <span className="text-green-400">+{route.ascent}m</span>
                                                                <span className="text-red-400">-{route.descent}m</span>
                                                            </div>
                                                        </div>
                                                        {isEditable && (
                                                            <button onClick={() => handleDeleteRoute(idx)} className="p-2 opacity-0 group-hover:opacity-100 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Day Comments / Log */}
                                        <div className="mt-6">
                                            {isEditable ? (
                                                <div className="relative">
                                                    <textarea
                                                        placeholder="Add an editorial entry for this day..."
                                                        className="w-full text-base text-white/80 bg-white/5 border border-white/10 rounded-2xl p-6 focus:border-white outline-none resize-none transition-all placeholder:text-white/20"
                                                        rows={3}
                                                        defaultValue={trip.dayComments?.[day.index] || ''}
                                                        onBlur={(e) => handleSaveDayComment(day.index, e.target.value)}
                                                    />
                                                </div>
                                            ) : (
                                                (trip.dayComments?.[day.index]) && (
                                                    <div className="pl-6 border-l-2 border-white/20 text-lg text-white/70 font-light font-sans leading-relaxed">
                                                        {trip.dayComments[day.index]}
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        {/* Add Memory button */}
                                        {isEditable && onAddLocation && (
                                            <button
                                                onClick={() => openAddMemory(day.index, day.date)}
                                                className="mt-4 flex items-center gap-2 text-xs font-bold text-white/30 hover:text-white transition-colors group/add"
                                            >
                                                <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center group-hover/add:border-white group-hover/add:bg-white/10 transition">
                                                    <Plus size={12} />
                                                </span>
                                                Add Memory
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Altitude Profile */}
                    {trip.gpxData && trip.gpxData.length > 0 && trip.gpxData.some(p => p.ele && p.ele > 0) && (
                        <div className="pt-12">
                            <AltitudeProfileWidget gpxData={trip.gpxData} />
                        </div>
                    )}

                    {/* Resources & Packing */}
                    {(externalLinks.length > 0 || isEditable || trip.tags?.length || trip.difficulty) && (
                        <div className="flex flex-col gap-6 pt-12 border-t border-white/10">

                            {(externalLinks.length > 0 || isEditable) && (
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6 flex items-center gap-2">
                                        <Globe size={14} /> Waypoints
                                    </h3>
                                    <div className="flex flex-col gap-2">
                                        {externalLinks.map((link, idx) => (
                                            <div key={idx} className="flex items-center gap-3 group/link">
                                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 text-white/80 hover:text-white text-sm font-medium transition-all">
                                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                                                        <Globe size={14} className="opacity-60" />
                                                    </div>
                                                    {link.label}
                                                </a>
                                                {isEditable && (
                                                    <button onClick={() => removeLink(idx)} className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-xl opacity-0 group-hover/link:opacity-100 transition"><Trash2 size={16} /></button>
                                                )}
                                            </div>
                                        ))}
                                        {isEditable && (
                                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mt-2 flex flex-col gap-3">
                                                <input type="text" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} placeholder="Label" className="w-full bg-transparent border-b border-white/20 px-2 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/30" />
                                                <input type="text" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="URL (https://...)" className="w-full bg-transparent border-b border-white/20 px-2 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/30" />
                                                <button onClick={addExternalLink} disabled={!newLinkLabel || !newLinkUrl} className="mt-2 py-2.5 bg-white hover:bg-white/90 text-black font-bold text-xs uppercase tracking-widest rounded-xl disabled:opacity-50 transition-colors">Add Link</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {(trip.tags?.length || trip.difficulty) && (
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                                    <PackingChecklist
                                        tags={trip.tags || []}
                                        difficulty={trip.difficulty}
                                        isEditable={isEditable}
                                        customItems={trip.packingItems || []}
                                        onUpdateCustomItems={isEditable ? handleUpdatePackingItems : undefined}
                                        packingList={trip.packingList}
                                        onSavePackList={isEditable ? handleSavePackList : undefined}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column: Sticky Map */}
                <div className="hidden lg:block lg:col-span-6 xl:col-span-7">
                    <div className="sticky top-6 h-[calc(100vh-48px)] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
                        <MiniMap
                            center={mapCenter || { lat: 20, lng: 10 }}
                            routePositions={routePositions}
                            gpxPositions={gpxPositions}
                            tripLocations={tripLocations}
                            authorColor={author.color || "#000"}
                            hikingRoutes={trip.hikingRoutes}
                            routePlanMode={routePlanMode}
                            pendingWaypoints={pendingWaypoints}
                            pendingRoute={pendingRoute || undefined}
                            onPlanMapClick={handleMapClick}
                            pendingMemoryPin={memoryPinCoords}
                            onMemoryMapClick={handleMemoryMapClick}
                        />

                        {/* Map Pinning Prompt */}
                        {isPlacingMemoryPin && (
                            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-[3000] bg-[#f59e0b]/90 backdrop-blur text-white px-5 py-2.5 rounded-full text-xs font-bold border border-white/20 shadow-2xl flex items-center gap-4 animate-fade-in-down">
                                <div className="flex items-center gap-2 pointer-events-none">
                                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                                    Tap map to place your memory
                                </div>
                                <button
                                    onClick={() => { setAddMemoryDay(null); setIsPlacingMemoryPin(false); }}
                                    className="bg-black/20 hover:bg-black/40 px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition pointer-events-auto"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {/* Planner overlay on map */}
                        {isEditable && (
                            <div className="absolute bottom-6 left-6 z-[1000]">
                                {!routePlanMode ? (
                                    <button
                                        onClick={() => setRoutePlanMode(true)}
                                        className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-white/90 text-black font-bold uppercase tracking-widest text-xs rounded-full shadow-2xl transition"
                                    >
                                        <Route size={16} /> Plan Route
                                    </button>
                                ) : (
                                    <div className="bg-black/90 backdrop-blur-xl border border-white/20 p-6 rounded-3xl shadow-2xl w-80 space-y-4">
                                        <h4 className="text-white font-bold mb-2">Plan a Trail</h4>
                                        <p className="text-xs text-white/50">Click on the map to add waypoints (up to 8).</p>

                                        <input
                                            type="text"
                                            placeholder="Trail Name"
                                            value={newRouteName}
                                            onChange={e => setNewRouteName(e.target.value)}
                                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors"
                                        />

                                        <div className="flex flex-col gap-2">
                                            <select
                                                value={routeDay === 'all' ? 'all' : routeDay}
                                                onChange={e => setRouteDay(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none appearance-none cursor-pointer"
                                            >
                                                <option value="all" className="text-black">All Days</option>
                                                {days.map(d => (
                                                    <option key={d.index} value={d.index} className="text-black">{d.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {pendingWaypoints.length > 1 && (
                                            <div className="flex justify-between text-xs text-white/70 bg-white/5 p-3 rounded-xl border border-white/10">
                                                <span>{pendingRouteKm} km</span>
                                                <span>+{pendingRouteAscent}m</span>
                                                <span>-{pendingRouteDescent}m</span>
                                            </div>
                                        )}

                                        {routingError && <p className="text-xs text-red-400">{routingError}</p>}
                                        {routingLoading && <p className="text-xs text-white/50">Routing...</p>}

                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={() => {
                                                    setRoutePlanMode(false);
                                                    setPendingWaypoints([null]);
                                                    setPendingRoute(null);
                                                    setPendingRouteKm(0);
                                                    setPendingRoutePoints([]);
                                                    setRouteDay('all');
                                                }}
                                                className="flex-1 py-2 rounded-xl border border-white/20 text-white/70 hover:bg-white/10 hover:text-white transition text-xs font-bold"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveRoute}
                                                disabled={!newRouteName || !pendingRoute || routingLoading}
                                                className="flex-1 py-2 rounded-xl bg-white text-black disabled:opacity-50 hover:bg-white/90 transition text-xs font-bold"
                                            >
                                                Save Route
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Weather overlay on map */}
                        <div className="absolute top-6 right-6 z-[1000] drop-shadow-2xl">
                            {mapCenter && <WeatherWidget coords={mapCenter} />}
                        </div>
                    </div>
                </div>

            </div>

            {/* Photo Lightbox */}
            {lightboxIndex !== null && (
                <PhotoLightbox
                    photos={tripLocations}
                    currentIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onNavigate={setLightboxIndex}
                />
            )}

            {/* Add Memory Modal */}
            {addMemoryDay && !isPlacingMemoryPin && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
                        {/* Header */}
                        <div className="flex justify-between items-center px-6 py-5 border-b border-white/10">
                            <div>
                                <h2 className="text-lg font-black text-white">Add Memory</h2>
                                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
                                    {days.find(d => d.index === addMemoryDay.dayIndex)?.label} · {addMemoryDay.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </p>
                            </div>
                            <button onClick={() => setAddMemoryDay(null)} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition text-white">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-6 space-y-5">
                            {/* Photo Upload */}
                            <div
                                onClick={() => !memoryIsCompressing && memoryFileInputRef.current?.click()}
                                className={`relative w-full h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden
                                    ${memoryPhotoPreview ? 'border-transparent' : 'border-white/20 hover:border-white/40 bg-white/5'}`}
                            >
                                {memoryIsCompressing ? (
                                    <div className="flex flex-col items-center text-white/50">
                                        <Loader2 className="animate-spin mb-2" size={24} />
                                        <span className="text-xs">Optimizing photo...</span>
                                    </div>
                                ) : memoryPhotoPreview ? (
                                    <img src={memoryPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center text-white/40">
                                        <Image className="mx-auto mb-2" size={32} />
                                        <p className="text-sm font-medium">Tap to upload photo</p>
                                    </div>
                                )}
                                <input type="file" ref={memoryFileInputRef} className="hidden" accept="image/*" onChange={handleMemoryPhotoChange} />
                            </div>

                            {/* Title */}
                            <input
                                type="text"
                                value={memoryTitle}
                                onChange={e => setMemoryTitle(e.target.value)}
                                placeholder="Location name..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/40 transition placeholder:text-white/30"
                            />

                            {/* Type */}
                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                {LOCATION_TYPES.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setMemoryType(t.id as MapLocation['type'])}
                                        className={`flex-shrink-0 flex items-center px-3 py-1.5 rounded-full text-xs font-bold transition border
                                            ${memoryType === t.id ? 'bg-white text-black border-transparent' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white'}`}
                                    >
                                        <span className="mr-1">{t.icon}</span>{t.label}
                                    </button>
                                ))}
                            </div>

                            {/* Comment */}
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Experience</span>
                                    <button
                                        onClick={handleMemoryAiCaption}
                                        disabled={!memoryPhotoFile || memoryIsGenerating}
                                        className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 font-bold disabled:opacity-40 transition"
                                    >
                                        {memoryIsGenerating ? <Loader2 size={11} className="animate-spin" /> : '✦'}
                                        {memoryIsGenerating ? 'Writing...' : 'AI Caption'}
                                    </button>
                                </div>
                                <textarea
                                    value={memoryComment}
                                    onChange={e => setMemoryComment(e.target.value)}
                                    placeholder="What happened here..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/80 text-sm focus:outline-none focus:border-white/40 transition resize-none h-24 placeholder:text-white/20"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-white/10 flex gap-3">
                            <button
                                onClick={() => setAddMemoryDay(null)}
                                className="flex-1 py-3 rounded-xl border border-white/20 text-white/60 hover:bg-white/5 hover:text-white transition font-bold text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveMemory}
                                disabled={!memoryTitle || !memoryPhotoPreview || memoryIsCompressing || memoryIsSaving}
                                className="flex-1 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-white/90 disabled:opacity-40 transition flex items-center justify-center gap-2"
                            >
                                {memoryIsSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                                {memoryIsSaving ? 'Saving...' : 'Pin Memory'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TripDetailPage;
