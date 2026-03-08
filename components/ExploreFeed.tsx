import React, { useState, useMemo, useEffect } from 'react';
import { Trip, MapLocation, User } from '../types';
import { Search, MapPin, ArrowRight, Bookmark, Compass, Navigation, Sparkles, SlidersHorizontal, X } from 'lucide-react';
import { TRIP_TAGS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';

// ── Geocode cache (module-level, survives re-renders) ──────────────
const _geocodeCache: Record<string, string> = {};

const reverseGeocodeCountry = async (lat: number, lng: number): Promise<string> => {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (_geocodeCache[key] !== undefined) return _geocodeCache[key];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=5`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const country = data.address?.country || data.address?.state || '';
    _geocodeCache[key] = country;
    return country;
  } catch {
    _geocodeCache[key] = '';
    return '';
  }
};

// Extract country from a "City, Country" style location string
const locationToCountry = (loc?: string): string => {
  if (!loc) return '';
  const parts = loc.split(',').map(s => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || '';
};

interface ExploreFeedProps {
  trips: Trip[];
  locations: MapLocation[];
  users: User[];
  currentUser: User | null;
  onViewTrip: (tripId: string) => void;
  onLikeTrip: (tripId: string) => void;
  onBookmarkTrip: (tripId: string) => void;
}

type SortOption = 'newest' | 'most-liked';

const ExploreFeed: React.FC<ExploreFeedProps> = ({
  trips, locations, users, currentUser,
  onViewTrip, onLikeTrip, onBookmarkTrip,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [pinCountries, setPinCountries] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const publicTrips = useMemo(() => trips.filter(t => t.visibility === 'public'), [trips]);

  // Supplement with reverse-geocoded pin countries (async)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const results: Record<string, string> = {};
      for (const trip of publicTrips) {
        if (locationToCountry(trip.location)) continue; // already have it from location field
        const pin = locations.find(l => l.tripId === trip.id && l.coords?.lat && l.coords?.lng);
        if (pin) {
          const c = await reverseGeocodeCountry(pin.coords.lat, pin.coords.lng);
          if (c) results[trip.id] = c;
        }
      }
      if (!cancelled) setPinCountries(prev => ({ ...prev, ...results }));
    };
    run();
    return () => { cancelled = true; };
  }, [publicTrips, locations]);

  // Resolve country for each trip: location field first, then geocoded pin
  const tripCountry = useMemo(() => {
    const map: Record<string, string> = {};
    for (const trip of publicTrips) {
      const c = locationToCountry(trip.location) || pinCountries[trip.id] || '';
      if (c) map[trip.id] = c;
    }
    return map;
  }, [publicTrips, pinCountries]);

  const availableCountries = useMemo(() => {
    const set = new Set(Object.values(tripCountry).filter(Boolean));
    return Array.from(set).sort();
  }, [tripCountry]);

  const filteredAndSorted = useMemo(() => {
    let result = publicTrips;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term) ||
        t.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }
    if (selectedTag) result = result.filter(t => t.tags?.includes(selectedTag));
    if (selectedCountry) result = result.filter(t => tripCountry[t.id] === selectedCountry);

    return [...result].sort((a, b) =>
      sortBy === 'most-liked'
        ? (b.likes?.length ?? 0) - (a.likes?.length ?? 0)
        : b.startDate - a.startDate
    );
  }, [publicTrips, searchTerm, selectedTag, selectedCountry, sortBy, tripCountry]);

  const hasActiveFilters = !!searchTerm || !!selectedTag || !!selectedCountry;
  const clearAll = () => { setSearchTerm(''); setSelectedTag(''); setSelectedCountry(null); };

  return (
    <div className="relative w-full h-full bg-[#050505] text-white overflow-y-auto pb-32 font-sans">

      {/* ── Sticky header ─────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-xl border-b border-white/[0.05]">

        {/* Row 1 — title + sort */}
        <div className="px-6 md:px-12 pt-7 pb-3 flex items-center justify-between gap-4">
          <motion.h1
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold tracking-tight flex-shrink-0"
          >
            Explore
          </motion.h1>

          {/* Sort */}
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5 flex-shrink-0">
            <button
              onClick={() => setSortBy('newest')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${sortBy === 'newest' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
            >
              <Compass size={11} /> Latest
            </button>
            <button
              onClick={() => setSortBy('most-liked')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${sortBy === 'most-liked' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
            >
              <Navigation size={11} /> Trending
            </button>
          </div>
        </div>

        {/* Row 2 — search · country pills · activity · clear */}
        <div className="px-6 md:px-12 pb-4 flex items-center gap-3 overflow-x-auto scrollbar-hide">

          {/* Search */}
          <div className="relative group flex-shrink-0 w-44">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 group-focus-within:text-white/60 transition-colors" size={13} />
            <input
              type="text"
              placeholder="Search…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-transparent rounded-full focus:bg-white/10 focus:border-white/10 focus:outline-none text-white placeholder-white/40 text-[11px] transition-all shadow-sm"
            />
          </div>

          <div className="w-px h-4 bg-white/10 flex-shrink-0" />

          {/* Country pills */}
          {availableCountries.map(country => (
            <button
              key={country}
              onClick={() => setSelectedCountry(selectedCountry === country ? null : country)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${selectedCountry === country
                ? 'bg-white text-black border-transparent shadow-md'
                : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/10'
                }`}
            >
              <MapPin size={8} />{country}
            </button>
          ))}

          {availableCountries.length > 0 && <div className="w-px h-4 bg-white/10 flex-shrink-0" />}

          {/* Activity dropdown */}
          <div className="relative flex-shrink-0">
            <select
              value={selectedTag}
              onChange={e => setSelectedTag(e.target.value)}
              className={`appearance-none pl-3 pr-7 py-1.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer focus:outline-none ${selectedTag
                ? 'bg-white text-black border-transparent shadow-md'
                : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/10'
                }`}
              style={{ backgroundImage: 'none' }}
            >
              <option value="">Activity</option>
              {TRIP_TAGS.map(tag => (
                <option key={tag} value={tag} className="bg-[#111] text-white">{tag}</option>
              ))}
            </select>
            <SlidersHorizontal size={8} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${selectedTag ? 'text-black' : 'text-white/30'}`} />
          </div>

          {/* Clear — only when a filter is active */}
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all"
            >
              <X size={8} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 mt-8">

        {filteredAndSorted.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-40 rounded-3xl border border-white/5 bg-white/[0.02]"
          >
            <Sparkles size={36} className="mx-auto mb-5 text-white/15" strokeWidth={1} />
            <h2 className="text-xl font-light tracking-tight">No journeys found</h2>
            <p className="text-white/30 text-sm mt-1.5">Try adjusting your filters.</p>
            <button onClick={clearAll} className="mt-7 px-7 py-2.5 bg-white text-black text-xs font-bold rounded-full hover:scale-105 transition-transform">
              Clear filters
            </button>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 auto-rows-[320px]">
          <AnimatePresence>
            {filteredAndSorted.map((trip, index) => {
              const author = users.find(u => u.id === trip.userId);
              const tripPins = locations.filter(l => l.tripId === trip.id);
              const isBookmarked = currentUser?.bookmarks?.includes(trip.id);
              if (!author) return null;

              const isFeatured = index === 0;
              const coverPhoto = trip.coverPhotoUrl
                || (tripPins[0]?.photoUrl)
                || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b';
              const country = tripCountry[trip.id];

              return (
                <motion.article
                  layout
                  key={trip.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, delay: index * 0.04 }}
                  onClick={() => onViewTrip(trip.id)}
                  className={`group relative rounded-[2rem] overflow-hidden cursor-pointer ring-1 ring-white/5 hover:ring-white/15 transition-all duration-500 shadow-2xl ${isFeatured ? 'md:col-span-2 md:row-span-2' : ''}`}
                >
                  {/* Background */}
                  <div className="absolute inset-0">
                    <img
                      src={coverPhoto}
                      className="w-full h-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-105"
                      alt={trip.title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                  </div>

                  {/* Bookmark — top right */}
                  <div className="absolute top-5 right-5 z-10">
                    <button
                      onClick={e => { e.stopPropagation(); onBookmarkTrip(trip.id); }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-all border ${isBookmarked ? 'bg-white text-black border-white' : 'bg-black/30 text-white/50 hover:bg-white/15 hover:text-white border-white/10'}`}
                    >
                      <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} strokeWidth={isBookmarked ? 0 : 2} />
                    </button>
                  </div>

                  {/* Bottom content */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                    {/* Author + country — visible on hover */}
                    <div className="flex items-center gap-2.5 mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold overflow-hidden border border-white/20">
                        {author.avatarUrl
                          ? <img src={author.avatarUrl} alt={author.username} className="w-full h-full object-cover" />
                          : author.username.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-white/80">{author.username}</span>
                      {country && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-white/25" />
                          <span className="flex items-center gap-1 text-[10px] text-white/50">
                            <MapPin size={8} /> {country}
                          </span>
                        </>
                      )}
                    </div>

                    <h2 className={`${isFeatured ? 'text-4xl md:text-5xl' : 'text-2xl'} font-bold leading-tight tracking-tight mb-3 drop-shadow-xl`}>
                      {trip.title}
                    </h2>

                    <div className="flex items-center gap-4 text-white/60 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
                        <MapPin size={10} /> {tripPins.length} {tripPins.length === 1 ? 'pin' : 'pins'}
                      </span>
                      {trip.gpxStats && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
                          <Compass size={10} /> {trip.gpxStats.distanceKm} km
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
                        View <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ExploreFeed;
