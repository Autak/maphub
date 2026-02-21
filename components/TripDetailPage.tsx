import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trip, MapLocation, User } from '../types';
import { DIFFICULTY_LEVELS, LOCATION_TYPES } from '../constants';
import { computeTripStats, getRouteCenter } from '../utils/tripStats';
import { ArrowLeft, Heart, MapPin, Calendar, Mountain, Route, Camera, Bookmark, Edit2, Check, X, Trash2, Upload, FileUp, Globe, Plus, Minus, Tag, Map as MapIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PhotoLightbox from './PhotoLightbox';
import WeatherWidget from './WeatherWidget';
import PackingChecklist from './PackingChecklist';
import { parseGPX } from '../utils/gpxParser';
import { ALL_TAGS } from '../utils/packingRules';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';

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
                {gpxPositions.length > 1 && (
                    <Polyline
                        positions={gpxPositions}
                        pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }}
                    />
                )}
                {routePositions.length > 1 && (
                    <Polyline
                        positions={routePositions}
                        pathOptions={{ color: authorColor, weight: 3, opacity: 0.7, dashArray: '5, 10' }}
                    />
                )}
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
    const [editDistance, setEditDistance] = useState(trip.gpxStats?.distanceKm || 0);
    const [editDays, setEditDays] = useState(trip.gpxStats?.estimatedDays || 0);

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
                                <p className="text-white/80 text-lg md:text-xl leading-relaxed font-light font-serif">
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

                                        <div className="space-y-6">
                                            {dayLocations.map((loc, idx) => {
                                                const typeDef = LOCATION_TYPES.find(t => t.id === loc.type);
                                                const isEditingThis = editingLocationId === loc.id;
                                                const isBeingDragged = draggedLocationId === loc.id;

                                                return (
                                                    <div
                                                        key={loc.id}
                                                        className={`relative transition-all duration-300 ${isBeingDragged ? 'opacity-30 scale-95' : 'opacity-100'}`}
                                                        draggable={isEditable}
                                                        onDragStart={(e) => handleDragStart(e, loc.id)}
                                                    >
                                                        {isEditingThis ? (
                                                            <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/20 p-6 space-y-4">
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
                                                        ) : (
                                                            <div className="group/item flex gap-6 cursor-pointer" onClick={() => setLightboxIndex(locationIndexOf(loc))}>
                                                                <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden flex-shrink-0 bg-white/5 border border-white/10 relative">
                                                                    <img src={loc.photoUrl} alt={loc.title} className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-[2s] ease-out" />
                                                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                                                </div>
                                                                <div className="flex-1 min-w-0 pt-2">
                                                                    <div className="flex items-center gap-3 mb-2">
                                                                        <h4 className="text-lg font-bold text-white truncate">{loc.title}</h4>
                                                                    </div>
                                                                    <p className="text-base text-white/60 font-light line-clamp-2 md:line-clamp-3 leading-relaxed">"{loc.comment}"</p>
                                                                </div>

                                                                {isEditable && (
                                                                    <div className="absolute -left-4 top-4 flex flex-col gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                                        <button onClick={(e) => { e.stopPropagation(); startEditingLocation(loc); }} className="p-2 bg-white text-black rounded-full hover:scale-110 transition shadow-xl"><Edit2 size={12} /></button>
                                                                        <button onClick={(e) => { e.stopPropagation(); onDeleteLocation && onDeleteLocation(loc.id); }} className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition shadow-xl"><Trash2 size={12} /></button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

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
                                                    <div className="pl-6 border-l-2 border-white/20 text-lg text-white/70 font-light font-serif leading-relaxed italic">
                                                        "{trip.dayComments[day.index]}"
                                                    </div>
                                                )
                                            )}
                                        </div>
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
                        {(tripLocations.length > 0 || gpxPositions.length > 0) && mapCenter ? (
                            <MiniMap
                                center={mapCenter}
                                routePositions={routePositions}
                                gpxPositions={gpxPositions}
                                tripLocations={tripLocations}
                                authorColor={author.color || "#000"}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-white/5">
                                <MapIcon size={48} className="text-white/20 mb-4" />
                                <p className="text-white/40 text-sm">No map data available.</p>
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
        </div>
    );
};

export default TripDetailPage;
