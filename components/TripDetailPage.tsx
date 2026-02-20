import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trip, MapLocation, User } from '../types';
import { DIFFICULTY_LEVELS, LOCATION_TYPES } from '../constants';
import { computeTripStats, getRouteCenter } from '../utils/tripStats';
import { ArrowLeft, Heart, MapPin, Calendar, Mountain, Route, Camera, Bookmark, Edit2, Check, X, Trash2, Upload, FileUp, Globe, Plus, Minus, Tag } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PhotoLightbox from './PhotoLightbox';
import WeatherWidget from './WeatherWidget';
import PackingChecklist from './PackingChecklist';
import { parseGPX } from '../utils/gpxParser';
import { ALL_TAGS } from '../utils/packingRules';

interface MiniMapProps {
    center: { lat: number; lng: number };
    routePositions: [number, number][];
    gpxPositions: [number, number][];
    tripLocations: MapLocation[];
    authorColor: string;
}

const MiniMap: React.FC<MiniMapProps> = ({ center, routePositions, gpxPositions, tripLocations, authorColor }) => {
    const apiKey = (import.meta as any).env.VITE_MAPY_API_KEY || '';
    const tileUrl = `https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=${apiKey}`;

    return (
        <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm h-56 w-full relative z-0">
            <MapContainer
                center={[center.lat, center.lng]}
                zoom={8}
                scrollWheelZoom={true}
                dragging={true}
                zoomControl={true}
                attributionControl={false}
                className="h-full w-full"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.seznam.cz/" target="_blank">Seznam.cz, a.s.</a>, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
                    url={tileUrl}
                />
                {gpxPositions.length > 1 && (
                    <Polyline
                        positions={gpxPositions}
                        pathOptions={{ color: '#16a34a', weight: 4, opacity: 0.9 }}
                    />
                )}
                {routePositions.length > 1 && (
                    <Polyline
                        positions={routePositions}
                        pathOptions={{ color: authorColor, weight: 3, opacity: 0.7 }}
                    />
                )}
                {tripLocations.map((loc) => (
                    <Marker
                        key={loc.id}
                        position={[loc.coords.lat, loc.coords.lng]}
                        icon={L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div style="background-color: #3b82f6; border: 2px solid white; border-radius: 50%; width: 10px; height: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
                            iconSize: [10, 10],
                            iconAnchor: [5, 5],
                        })}
                    />
                ))}
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
}


const TripDetailPage: React.FC<TripDetailPageProps> = ({
    trip, locations, author, currentUser, onBack, onLike, onBookmark,
    isEditable = false, onUpdateTrip, onUpdateLocation, onDeleteLocation, onDeleteTrip
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
    // Initialize editing state with current values, defaulting to 0 to avoid undefined
    const [editDistance, setEditDistance] = useState(trip.gpxStats?.distanceKm || 0);
    const [editDays, setEditDays] = useState(trip.gpxStats?.estimatedDays || 0);


    // Timeline Drag & Drop
    const [draggedLocationId, setDraggedLocationId] = useState<string | null>(null);

    // External Links state
    const [newLinkLabel, setNewLinkLabel] = useState('');
    const [newLinkUrl, setNewLinkUrl] = useState('');
    const [externalLinks, setExternalLinks] = useState(trip.externalLinks || []);

    const gpxInputRef = useRef<HTMLInputElement>(null);

    const tripLocations = useMemo(
        () => locations.filter(l => l.tripId === trip.id).sort((a, b) => a.timestamp - b.timestamp),
        [locations, trip.id]
    );

    const locationIndexOf = (loc: MapLocation) => tripLocations.findIndex(l => l.id === loc.id);

    const stats = useMemo(() => computeTripStats(tripLocations, trip.startDate, trip.endDate), [tripLocations, trip.startDate, trip.endDate]);

    // Update local validation state when trip/stats changes
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
    const coverUrl = trip.coverPhotoUrl || (tripLocations.length > 0 ? tripLocations[0].photoUrl : null);

    // Polyline positions for map (pins)
    const routePositions: [number, number][] = tripLocations
        .filter(l => l.coords && !isNaN(l.coords.lat) && !isNaN(l.coords.lng))
        .map(l => [l.coords.lat, l.coords.lng]);

    // GPX track positions
    const gpxPositions: [number, number][] = (trip.gpxData || [])
        .filter(p => !isNaN(p.lat) && !isNaN(p.lng))
        .map(p => [p.lat, p.lng]);

    // Compute map center: prefer GPX center if available
    const mapCenter = useMemo(() => {
        if (gpxPositions.length > 0) {
            const latSum = gpxPositions.reduce((s, p) => s + p[0], 0);
            const lngSum = gpxPositions.reduce((s, p) => s + p[1], 0);
            return { lat: latSum / gpxPositions.length, lng: lngSum / gpxPositions.length };
        }
        return center;
    }, [gpxPositions, center]);

    // --- Timeline "Days" Logic ---
    const days = useMemo(() => {
        const start = new Date(trip.startDate);
        start.setHours(0, 0, 0, 0);

        // If no end date, default to start date, effectively 1 day
        const end = trip.endDate ? new Date(trip.endDate) : new Date(trip.startDate);
        end.setHours(0, 0, 0, 0);

        // Ideally, we want to show at least one day, or the range
        // Provide a buffer if needed, but for now just the range
        const dayList = [];
        const current = new Date(start);

        let index = 0;
        // Safety break after 365 days to prevent infinite loops if data is weird
        while (current <= end && dayList.length < 365) {
            dayList.push({
                index,
                date: new Date(current),
                label: `Day ${index + 1}`
            });
            current.setDate(current.getDate() + 1);
            index++;
        }
        return dayList;
    }, [trip.startDate, trip.endDate]);

    // Group locations by day
    const locationsByDay = useMemo(() => {
        const grouped: Record<number, MapLocation[]> = {};
        days.forEach(d => grouped[d.index] = []);

        tripLocations.forEach(loc => {
            const locDate = new Date(loc.timestamp);
            locDate.setHours(0, 0, 0, 0);

            const tripStart = new Date(trip.startDate);
            tripStart.setHours(0, 0, 0, 0);

            const dayIndex = Math.round((locDate.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24));

            if (grouped[dayIndex]) {
                grouped[dayIndex].push(loc);
            } else {
                // Fallback: put in Day 1 if before start, or last day if after?
                // Or create a "overflow" bucket?
                // For now, let's clamp to 0 or last index
                if (dayIndex < 0 && grouped[0]) grouped[0].push(loc);
                else if (dayIndex >= days.length && grouped[days.length - 1]) grouped[days.length - 1].push(loc);
            }
        });
        return grouped;
    }, [tripLocations, days, trip.startDate]);

    // --- Edit handlers ---

    const saveTitle = async () => {
        if (onUpdateTrip && editTitle.trim()) {
            await onUpdateTrip(trip.id, { title: editTitle.trim() });
        }
        setEditingTitle(false);
    };

    const saveDesc = async () => {
        if (onUpdateTrip) {
            await onUpdateTrip(trip.id, { description: editDesc });
        }
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
            await onUpdateLocation(editingLocationId, {
                title: editLocTitle,
                comment: editLocComment,
                type: editLocType,
            });
        }
        setEditingLocationId(null);
    };

    const handleGPXUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0] || !onUpdateTrip) return;
        setGpxUploading(true);
        try {
            const text = await e.target.files[0].text();
            const result = parseGPX(text);
            if (result.points.length === 0) {
                alert('No track points found in the GPX file.');
                return;
            }
            await onUpdateTrip(trip.id, {
                gpxData: result.points,
                gpxStats: { distanceKm: result.distanceKm, estimatedDays: result.estimatedDays }
            });
        } catch (err) {
            console.error('GPX parsing failed:', err);
            alert('Failed to parse GPX file.');
        } finally {
            setGpxUploading(false);
            if (gpxInputRef.current) gpxInputRef.current.value = '';
        }
    };

    const handleSaveRoute = async (points: { lat: number; lng: number; ele?: number }[]) => {
        if (onUpdateTrip && points.length > 0) {
            // Calculate mock stats for the manual route
            const distance = points.length * 0.5; // Very rough estimate

            await onUpdateTrip(trip.id, {
                gpxData: points,
                gpxStats: { distanceKm: distance, estimatedDays: 1 }
            });
        }
    };

    const addExternalLink = async () => {
        if (!newLinkLabel.trim() || !newLinkUrl.trim() || !onUpdateTrip) return;
        let url = newLinkUrl.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        const updatedLinks = [...externalLinks, { label: newLinkLabel.trim(), url }];
        const updated = await onUpdateTrip(trip.id, { externalLinks: updatedLinks });
        if (updated) setExternalLinks(updated.externalLinks || updatedLinks);
        setNewLinkLabel('');
        setNewLinkUrl('');
    };

    const removeLink = async (index: number) => {
        if (!onUpdateTrip) return;
        const updatedLinks = externalLinks.filter((_, i) => i !== index);
        const updated = await onUpdateTrip(trip.id, { externalLinks: updatedLinks });
        if (updated) setExternalLinks(updated.externalLinks || updatedLinks);
    };

    const handleUpdatePackingItems = async (items: string[]) => {
        if (onUpdateTrip) {
            await onUpdateTrip(trip.id, { packingItems: items });
        }
    };

    const handleSavePackList = async (items: string[]) => {
        if (onUpdateTrip) {
            await onUpdateTrip(trip.id, { packingList: items });
        }
    };

    const toggleEditTag = (tag: string) => {
        setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const saveTags = async () => {
        if (onUpdateTrip) {
            await onUpdateTrip(trip.id, { tags: editTags });
        }
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

        if (onUpdateTrip) {
            await onUpdateTrip(trip.id, { gpxStats: newStats });
        }
    };

    // Day Comments Handler
    const handleSaveDayComment = async (dayIndex: number, comment: string) => {
        if (!onUpdateTrip) return;
        const updatedComments = { ...trip.dayComments, [dayIndex]: comment };
        await onUpdateTrip(trip.id, { dayComments: updatedComments });
    };

    // --- Timeline Handlers ---

    const handleAddDay = async () => {
        if (!onUpdateTrip) return;

        const currentEnd = trip.endDate ? new Date(trip.endDate) : new Date(trip.startDate);
        const newEnd = new Date(currentEnd);
        newEnd.setDate(newEnd.getDate() + 1);

        await onUpdateTrip(trip.id, { endDate: newEnd.getTime() });
    };

    const handleRemoveDay = async () => {
        if (!onUpdateTrip) return;

        // Don't allow less than 1 day (startDate == endDate)
        if (trip.endDate && new Date(trip.endDate) <= new Date(trip.startDate)) return;
        if (!trip.endDate) return; // Already 1 day

        const currentEnd = new Date(trip.endDate);
        const newEnd = new Date(currentEnd);
        newEnd.setDate(newEnd.getDate() - 1);

        // Safety check
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
        e.preventDefault(); // allow drop
    };

    const handleDropOnDay = async (e: React.DragEvent, dayIndex: number) => {
        if (!isEditable || !onUpdateLocation) return;
        e.preventDefault();
        const locId = e.dataTransfer.getData('locationId');
        if (!locId) return;

        setDraggedLocationId(null);

        // Find the location
        const loc = locations.find(l => l.id === locId);
        if (!loc) return;

        // Calculate new timestamp
        // Keep the original time of day, but change the date to the target day
        const targetDay = days[dayIndex];
        const newDate = new Date(targetDay.date);
        const oldDate = new Date(loc.timestamp);

        newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds());

        await onUpdateLocation(locId, { timestamp: newDate.getTime() });
    };

    return (
        <div className="w-full h-full bg-slate-50 overflow-y-auto pb-24">
            {/* Hero Section */}
            <div className="relative h-80 md:h-96 bg-slate-800 overflow-hidden">
                {coverUrl && (
                    <img src={coverUrl} alt={trip.title} className="w-full h-full object-cover opacity-70" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Back button */}
                <button
                    onClick={onBack}
                    className="absolute top-6 left-6 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition"
                >
                    <ArrowLeft size={20} />
                </button>

                {/* GPX Upload button (top-right, only when editable) */}
                {isEditable && (
                    <div className="absolute top-6 right-6 z-10">
                        <button
                            onClick={() => gpxInputRef.current?.click()}
                            disabled={gpxUploading}
                            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm rounded-lg text-sm font-bold transition disabled:opacity-50"
                        >
                            <FileUp size={16} />
                            {gpxUploading ? 'Uploading...' : trip.gpxData ? 'Replace GPX Track' : 'Upload GPX Track'}
                        </button>
                        <input
                            ref={gpxInputRef}
                            type="file"
                            accept=".gpx"
                            onChange={handleGPXUpload}
                            className="hidden"
                        />
                    </div>
                )}

                {/* Delete Trip Button (top-right, below GPX upload) */}
                {isEditable && onDeleteTrip && (
                    <div className="absolute top-20 right-6 z-10">
                        <button
                            onClick={() => {
                                if (window.confirm('Are you sure you want to delete this trip? This action cannot be undone.')) {
                                    onDeleteTrip(trip.id).then(onBack);
                                }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/80 hover:bg-red-600/90 text-white backdrop-blur-sm rounded-lg text-sm font-bold transition shadow-lg"
                        >
                            <Trash2 size={16} />
                            Delete Trip
                        </button>
                    </div>
                )}

                {/* Hero info */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {isEditable ? (
                            <>
                                <select
                                    value={trip.difficulty || ''}
                                    onChange={(e) => onUpdateTrip?.(trip.id, { difficulty: e.target.value })}
                                    className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full border border-white/30 outline-none cursor-pointer hover:bg-white/30 transition appearance-none [&>option]:text-slate-900"
                                >
                                    <option value="" disabled>Select Difficulty</option>
                                    {DIFFICULTY_LEVELS.map(d => (
                                        <option key={d.id} value={d.id}>{d.label}</option>
                                    ))}
                                </select>

                                <select
                                    value={trip.visibility}
                                    onChange={(e) => onUpdateTrip?.(trip.id, { visibility: e.target.value })}
                                    className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full border border-white/30 outline-none cursor-pointer hover:bg-white/30 transition appearance-none [&>option]:text-slate-900"
                                >
                                    <option value="public">Public</option>
                                    <option value="private">Private</option>
                                    <option value="friends">Friends Only</option>
                                </select>
                            </>
                        ) : (
                            difficultyInfo && (
                                <span className={`${difficultyInfo.color} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                                    {difficultyInfo.icon} {difficultyInfo.label}
                                </span>
                            )
                        )}

                        {isEditable && editingTags ? (
                            <div className="flex flex-col gap-2 bg-slate-900/50 backdrop-blur p-3 rounded-xl border border-white/10 w-full md:w-auto">
                                <p className="text-xs text-white/70 font-bold uppercase">Select Categories:</p>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_TAGS.map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => toggleEditTag(tag)}
                                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition ${editTags.includes(tag)
                                                ? 'bg-blue-500 text-white shadow-lg scale-105'
                                                : 'bg-white/10 text-slate-300 hover:bg-white/20'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                    <button onClick={() => { setEditingTags(false); setEditTags(trip.tags || []); }} className="px-3 py-1 bg-white/10 text-white rounded text-xs hover:bg-white/20">Cancel</button>
                                    <button onClick={saveTags} className="px-3 py-1 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600">Save Tags</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {trip.tags?.map(tag => (
                                    <span key={tag} className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter">
                                        {tag}
                                    </span>
                                ))}
                                {isEditable && (
                                    <button
                                        onClick={() => { setEditingTags(true); setEditTags(trip.tags || []); }}
                                        className="bg-white/10 hover:bg-white/20 text-white/70 hover:text-white px-2 py-1 rounded-full transition flex items-center gap-1"
                                    >
                                        <Tag size={10} /> <span className="text-[10px] font-bold">Edit</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Editable title */}
                    {isEditable && editingTitle ? (
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                className="text-3xl md:text-4xl font-black text-white bg-white/20 backdrop-blur px-3 py-1 rounded-lg outline-none w-full"
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && saveTitle()}
                            />
                            <button onClick={saveTitle} className="p-2 bg-green-500 text-white rounded-full"><Check size={16} /></button>
                            <button onClick={() => { setEditingTitle(false); setEditTitle(trip.title); }} className="p-2 bg-red-500 text-white rounded-full"><X size={16} /></button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl md:text-4xl font-black text-white drop-shadow-lg">{trip.title}</h1>
                            {isEditable && (
                                <button onClick={() => setEditingTitle(true)} className="p-1.5 bg-white/20 text-white rounded-full hover:bg-white/30 transition">
                                    <Edit2 size={14} />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-3 text-white/80 text-sm">
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 border-white/50"
                            style={{ backgroundColor: author.color }}
                        >
                            {author.avatarUrl ? (
                                <img src={author.avatarUrl} alt={author.username} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                author.username.substring(0, 2).toUpperCase()
                            )}
                        </div>
                        <span className="font-medium">{author.username}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {new Date(trip.startDate).toLocaleDateString()}
                            {trip.endDate && ` — ${new Date(trip.endDate).toLocaleDateString()}`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-4 md:px-8 -mt-4 relative z-10">

                {/* Stats & Actions Bar */}
                <div className="bg-white rounded-2xl shadow-lg p-5 mb-8 border border-slate-100">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        {/* Stats */}
                        <div className="flex items-center gap-6 flex-wrap">
                            <div className="text-center group relative">
                                {isEditable ? (
                                    <input
                                        type="number"
                                        value={editDistance}
                                        onChange={(e) => setEditDistance(parseFloat(e.target.value))}
                                        onBlur={(e) => handleStatChange('distance', e.target.value)}
                                        className="block text-xl font-black text-slate-800 w-24 text-center bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                ) : (
                                    <span className="block text-xl font-black text-slate-800">{trip.gpxStats?.distanceKm || stats.distance}</span>
                                )}
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">KM</span>
                                {isEditable && <Edit2 size={10} className="absolute -top-1 -right-2 text-slate-300 opacity-0 group-hover:opacity-100" />}
                            </div>
                            <div className="w-px h-8 bg-slate-200" />
                            <div className="text-center group relative">
                                {isEditable ? (
                                    <input
                                        type="number"
                                        value={editDays}
                                        onChange={(e) => setEditDays(parseFloat(e.target.value))}
                                        onBlur={(e) => handleStatChange('days', e.target.value)}
                                        className="block text-xl font-black text-slate-800 w-16 text-center bg-slate-50 border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                ) : (
                                    <span className="block text-xl font-black text-slate-800">{trip.gpxStats?.estimatedDays || stats.days}</span>
                                )}
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{(trip.gpxStats?.estimatedDays || stats.days) === 1 ? 'Day' : 'Days'}</span>
                                {isEditable && <Edit2 size={10} className="absolute -top-1 -right-2 text-slate-300 opacity-0 group-hover:opacity-100" />}
                            </div>

                            {stats.summits > 0 && (
                                <>
                                    <div className="w-px h-8 bg-slate-200" />
                                    <div className="text-center">
                                        <span className="block text-xl font-black text-slate-900">{stats.summits}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Summits</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onBookmark(trip.id)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition border ${isBookmarked
                                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-500'
                                    }`}
                            >
                                <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
                                {isBookmarked ? 'Saved' : 'Save'}
                            </button>
                            <button
                                onClick={() => onLike(trip.id)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition border ${isLiked
                                    ? 'bg-red-50 text-red-500 border-red-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-400'
                                    }`}
                            >
                                <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                                {trip.likes?.length || 0}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div className="bg-white rounded-2xl p-6 mb-8 border border-slate-100 shadow-sm">
                    {isEditable && editingDesc ? (
                        <div className="w-full">
                            <textarea
                                value={editDesc}
                                onChange={e => setEditDesc(e.target.value)}
                                className="w-full p-3 bg-slate-50 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 resize-none h-32"
                            />
                            <div className="flex gap-2 mt-2 justify-end">
                                <button onClick={() => { setEditingDesc(false); setEditDesc(trip.description); }} className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 rounded-lg transition">Cancel</button>
                                <button onClick={saveDesc} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold">Save</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-between items-start gap-4">
                            <p className="text-slate-700 leading-relaxed text-base">{trip.description}</p>
                            {isEditable && (
                                <button onClick={() => setEditingDesc(true)} className="p-1.5 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition flex-shrink-0">
                                    <Edit2 size={14} />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* External Links */}
                {(externalLinks.length > 0 || isEditable) && (
                    <div className="bg-white rounded-2xl p-6 mb-8 border border-slate-100 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Globe size={16} className="text-blue-500" />
                            Hike Resources
                        </h3>

                        <div className="flex flex-wrap gap-3 mb-4">
                            {externalLinks.map((link, idx) => (
                                <div key={idx} className="flex items-center gap-2 group/link">
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-100 transition shadow-sm"
                                    >
                                        <Globe size={14} />
                                        {link.label}
                                    </a>
                                    {isEditable && (
                                        <button
                                            onClick={() => removeLink(idx)}
                                            className="p-1 px-2 text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover/link:opacity-100 transition"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {isEditable && (
                            <div className="flex gap-2 items-center pt-4 border-t border-slate-50">
                                <input
                                    type="text"
                                    value={newLinkLabel}
                                    onChange={e => setNewLinkLabel(e.target.value)}
                                    placeholder="Label (e.g. Maps.cz)"
                                    className="px-3 py-1.5 text-xs bg-slate-50 border rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                                <input
                                    type="text"
                                    value={newLinkUrl}
                                    onChange={e => setNewLinkUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                                <button
                                    onClick={addExternalLink}
                                    disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
                                    className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black transition disabled:opacity-50"
                                >
                                    Add Link
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Weather + Mini Map row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Weather */}
                    {mapCenter && <WeatherWidget coords={mapCenter} />}

                    {/* Mini Map with GPX track overlay */}
                    {(tripLocations.length > 0 || gpxPositions.length > 0) && mapCenter && (
                        <MiniMap
                            center={mapCenter}
                            routePositions={routePositions}
                            gpxPositions={gpxPositions}
                            tripLocations={tripLocations}
                            authorColor={author.color}
                        />
                    )}
                </div>

                {/* Trip Timeline (Day Based) */}
                <div className="mb-8 relative">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Route size={20} className="text-blue-600" />
                            Journey Timeline
                        </h2>
                        {isEditable && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleRemoveDay}
                                    title="Remove Day"
                                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-sm font-bold hover:bg-red-50 hover:text-red-500 transition"
                                >
                                    <Minus size={16} />
                                </button>
                                <button
                                    onClick={handleAddDay}
                                    title="Add Day"
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition"
                                >
                                    <Plus size={16} />
                                    Add Day
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        {days.map((day) => {
                            const dayLocations = locationsByDay[day.index] || [];

                            return (
                                <div
                                    key={day.index}
                                    className="relative pl-8 border-l-2 border-slate-100 pb-2 transition-all"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDropOnDay(e, day.index)}
                                >
                                    {/* Day Marker */}
                                    <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-slate-300 border-2 border-white" />

                                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">
                                        {day.label} <span className="text-slate-300 font-medium ml-2">{day.date.toLocaleDateString()}</span>
                                    </h3>

                                    {/* Empty State for Day */}
                                    {dayLocations.length === 0 && (
                                        <div className="p-4 border-2 border-dashed border-slate-100 rounded-xl text-center text-slate-400 text-xs italic mb-4">
                                            No memories yet on this day.
                                            {isEditable && <span className="block mt-1 font-bold text-slate-300">Drag items here!</span>}
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        {dayLocations.map((loc, idx) => {
                                            const typeDef = LOCATION_TYPES.find(t => t.id === loc.type);
                                            const isEditingThis = editingLocationId === loc.id;
                                            const isBeingDragged = draggedLocationId === loc.id;

                                            return (
                                                <div
                                                    key={loc.id}
                                                    className={`
                                                        relative transition-all 
                                                        ${isBeingDragged ? 'opacity-50 scale-95' : 'opacity-100'}
                                                    `}
                                                    draggable={isEditable}
                                                    onDragStart={(e) => handleDragStart(e, loc.id)}
                                                >
                                                    {isEditingThis ? (
                                                        /* Inline editing mode */
                                                        <div className="bg-white rounded-xl border-2 border-blue-200 shadow-md p-4 space-y-3">
                                                            <input
                                                                value={editLocTitle}
                                                                onChange={e => setEditLocTitle(e.target.value)}
                                                                className="w-full font-bold text-slate-800 border-b border-blue-300 focus:outline-none focus:border-blue-500 pb-1"
                                                                placeholder="Title"
                                                            />
                                                            <textarea
                                                                value={editLocComment}
                                                                onChange={e => setEditLocComment(e.target.value)}
                                                                className="w-full text-sm text-slate-600 border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none h-16"
                                                                placeholder="Comment..."
                                                            />
                                                            <select
                                                                value={editLocType}
                                                                onChange={e => setEditLocType(e.target.value)}
                                                                className="text-xs border rounded-lg px-2 py-1.5 text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                            >
                                                                {LOCATION_TYPES.map(t => (
                                                                    <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                                                                ))}
                                                            </select>
                                                            <div className="flex gap-2 justify-end">
                                                                <button onClick={() => setEditingLocationId(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition">Cancel</button>
                                                                <button onClick={saveLocationEdit} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold">Save</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        /* View mode */
                                                        <div
                                                            className={`
                                                                bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition group/item relative
                                                                ${isEditable ? 'cursor-grab active:cursor-grabbing' : ''}
                                                            `}
                                                        >
                                                            <div className="flex gap-4 p-4 cursor-pointer" onClick={() => setLightboxIndex(locationIndexOf(loc))}>
                                                                <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 relative">
                                                                    <img src={loc.photoUrl} alt={loc.title} className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-300" />
                                                                    <div className="absolute top-1 left-1 bg-white/90 backdrop-blur rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-700 shadow-sm">
                                                                        {new Date(loc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <h4 className="font-bold text-slate-800 truncate">{loc.title}</h4>
                                                                    </div>
                                                                    <p className="text-sm text-slate-500 italic line-clamp-2">"{loc.comment}"</p>
                                                                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                                                                        <MapPin size={10} />
                                                                        <span>{loc.coords.lat.toFixed(4)}, {loc.coords.lng.toFixed(4)}</span>
                                                                        <span className={`px-1.5 py-0.5 bg-slate-100 rounded font-medium ${typeDef ? '' : 'text-slate-500'}`}>
                                                                            {typeDef?.icon} {typeDef?.label}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Edit/Delete buttons for editable mode */}
                                                            {isEditable && (
                                                                <button
                                                                    className="absolute top-2 right-2 p-1 bg-white/50 hover:bg-white text-slate-500 rounded-full opacity-0 group-hover/item:opacity-100 transition z-10"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        startEditingLocation(loc);
                                                                    }}
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            )}
                                                            {isEditable && (
                                                                <button
                                                                    className="absolute bottom-2 right-2 p-1 bg-white/50 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-full opacity-0 group-hover/item:opacity-100 transition z-10"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onDeleteLocation && onDeleteLocation(loc.id);
                                                                    }}
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Day Comment Section */}
                                    <div className="mt-4 pt-4 border-t border-slate-50">
                                        {isEditable ? (
                                            <div className="relative">
                                                <textarea
                                                    placeholder="Add a summary or thoughts for this day..."
                                                    className="w-full text-sm text-slate-600 bg-white border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none resize-none transition"
                                                    rows={3}
                                                    defaultValue={trip.dayComments?.[day.index] || ''}
                                                    onBlur={(e) => handleSaveDayComment(day.index, e.target.value)}
                                                />
                                                <div className="absolute right-2 bottom-2 text-xs text-slate-400 font-medium">Auto-saves on blur</div>
                                            </div>
                                        ) : (
                                            (trip.dayComments?.[day.index]) && (
                                                <div className="bg-blue-50/50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed italic border border-blue-100/50">
                                                    "{trip.dayComments[day.index]}"
                                                </div>
                                            )
                                        )}
                                    </div>

                                </div>
                            );
                        })}
                    </div >

                    {/* Photo Gallery Grid */}
                    {
                        tripLocations.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Camera size={20} className="text-blue-600" />
                                    Photo Gallery
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {tripLocations.map((loc, idx) => (
                                        <div
                                            key={loc.id}
                                            className="aspect-square rounded-xl overflow-hidden cursor-pointer relative group"
                                            onClick={() => setLightboxIndex(idx)}
                                        >
                                            <img src={loc.photoUrl} alt={loc.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div className="absolute bottom-2 left-2 right-2">
                                                    <p className="text-white text-sm font-bold truncate">{loc.title}</p>
                                                    <p className="text-white/70 text-xs italic truncate">"{loc.comment}"</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    }

                    {/* Packing Checklist */}
                    {
                        (trip.tags?.length || trip.difficulty) && (
                            <div className="mb-8">
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
                        )
                    }
                </div >

                {/* Photo Lightbox */}
                {
                    lightboxIndex !== null && (
                        <PhotoLightbox
                            photos={tripLocations}
                            currentIndex={lightboxIndex}
                            onClose={() => setLightboxIndex(null)}
                            onNavigate={setLightboxIndex}
                        />
                    )
                }
            </div>
        </div>
    );
};

export default TripDetailPage;
