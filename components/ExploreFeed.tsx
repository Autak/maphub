import React, { useState, useMemo } from 'react';
import { Trip, MapLocation, User } from '../types';
import { Search, MapPin, Heart, ArrowRight, Calendar, Filter, Globe, Tag, Bookmark, Compass, Sparkles, Navigation } from 'lucide-react';
import { TRIP_TAGS, DIFFICULTY_LEVELS } from '../constants';
import BackgroundDecorations from './BackgroundDecorations';

interface ExploreFeedProps {
  trips: Trip[];
  locations: MapLocation[];
  users: User[];
  currentUser: User | null;
  onViewTrip: (tripId: string) => void;
  onLikeTrip: (tripId: string) => void;
  onBookmarkTrip: (tripId: string) => void;
}

type SortOption = 'newest' | 'most-liked' | 'most-photos';

const ExploreFeed: React.FC<ExploreFeedProps> = ({ trips, locations, users, currentUser, onViewTrip, onLikeTrip, onBookmarkTrip }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Only show public trips
  const publicTrips = useMemo(() => trips.filter(t => t.visibility === 'public'), [trips]);

  const filteredAndSorted = useMemo(() => {
    let result = publicTrips;

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(trip =>
        trip.title.toLowerCase().includes(term) ||
        trip.description.toLowerCase().includes(term) ||
        trip.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Tag filter
    if (selectedTag) {
      result = result.filter(trip => trip.tags?.includes(selectedTag));
    }

    // Sort - Connect Trending logic and Newest
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.startDate - a.startDate;
        case 'most-liked':
          return (b.likes?.length || 0) - (a.likes?.length || 0);
        case 'most-photos':
          return locations.filter(l => l.tripId === b.id).length - locations.filter(l => l.tripId === a.id).length;
        default:
          return b.startDate - a.startDate;
      }
    });

    return result;
  }, [publicTrips, searchTerm, selectedTag, sortBy, locations]);

  // Collect all used tags from public trips for filter chips
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    publicTrips.forEach(t => t.tags?.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [publicTrips]);

  const featuredTrip = useMemo(() => {
    return publicTrips.find(t => t.coverPhotoUrl) || publicTrips[0];
  }, [publicTrips]);

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-y-auto pb-24 scroll-smooth">
      <BackgroundDecorations />

      {/* V4 Simplified Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-2xl shadow-slate-200 group overflow-hidden">
              <Globe size={24} className="group-hover:rotate-12 transition-transform" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-1">TrailThread</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Live Discoveries</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          <div className="hidden lg:block lg:col-span-3 space-y-10">
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 pl-1">Feed</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setSortBy('newest')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition shadow-slate-200 ${sortBy === 'newest' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  <Compass size={16} /> Discover
                </button>
                <button
                  onClick={() => setSortBy('most-liked')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition shadow-slate-200 ${sortBy === 'most-liked' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  <Navigation size={16} /> Trending
                </button>
              </nav>
            </div>

            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 pl-1">Trekking Tags</h3>
              <div className="flex flex-col gap-1">
                {TRIP_TAGS.slice(0, 10).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold text-left transition ${selectedTag === tag ? 'text-blue-600 bg-blue-50/50 border border-blue-100' : 'text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent'}`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-10">
            {/* V4 Centered Search Bar */}
            <div className="max-w-2xl mx-auto mb-16">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={24} />
                <input
                  type="text"
                  placeholder="Search adventures, trails, or hikers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-16 pr-6 py-5 bg-white rounded-[2rem] shadow-[0_20px_50px_rgb(0,0,0,0.05)] focus:ring-4 focus:ring-blue-50 border border-slate-100 focus:border-blue-100 placeholder-slate-400 text-lg font-medium transition-all"
                />
              </div>
            </div>
            {filteredAndSorted.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
                <Sparkles size={40} className="mx-auto mb-6 text-slate-200" />
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Zero traces found</h2>
                <p className="text-slate-400 text-sm mt-3 font-medium">Try broadening your horizon with fewer filters.</p>
                <button
                  onClick={() => { setSearchTerm(''); setSelectedTag(null); }}
                  className="mt-8 px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-800 transition shadow-xl"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              filteredAndSorted.map(trip => {
                const author = users.find(u => u.id === trip.userId);
                const tripPins = locations.filter(l => l.tripId === trip.id);
                const previewPhotos = tripPins.slice(0, 3);
                const isLiked = currentUser && trip.likes?.includes(currentUser.id);
                const isBookmarked = currentUser && currentUser.bookmarks?.includes(trip.id);
                const difficultyInfo = trip.difficulty ? DIFFICULTY_LEVELS.find(d => d.id === trip.difficulty) : null;

                if (!author) return null;

                return (
                  <article
                    key={trip.id}
                    className="bg-white rounded-[1.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-slate-300 overflow-hidden hover:shadow-[0_20px_55px_rgba(0,0,0,0.09)] hover:border-slate-400 transition-all duration-700 group"
                  >
                    {(trip.coverPhotoUrl || previewPhotos.length > 0) && (
                      <div
                        className="relative h-96 cursor-pointer overflow-hidden"
                        onClick={() => onViewTrip(trip.id)}
                      >
                        {trip.coverPhotoUrl ? (
                          <img src={trip.coverPhotoUrl} className="w-full h-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-105" alt="" />
                        ) : (
                          <div className="flex h-full">
                            {previewPhotos.map((pin, idx) => (
                              <div
                                key={pin.id}
                                className={`relative h-full overflow-hidden ${previewPhotos.length === 1 ? 'w-full' : idx === 0 ? 'w-2/3' : 'w-1/3 flex-1 border-l border-white'}`}
                              >
                                <img src={pin.photoUrl} className="w-full h-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-105" alt="" />
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-black/20" />

                        <div className="absolute top-6 left-6 right-6 flex justify-between items-start">
                          <div className="flex flex-wrap gap-2">
                            {trip.tags?.slice(0, 2).map(tag => (
                              <span key={tag} className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest rounded-lg border border-white/20">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="absolute bottom-8 left-8 right-8">
                          <h2 className="text-3xl font-black text-white leading-tight tracking-tight drop-shadow-2xl group-hover:-translate-y-1 transition-transform duration-500">
                            {trip.title}
                          </h2>
                          <div className="mt-4 flex items-center gap-4 text-white/80">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={14} className="text-blue-400" />
                              <span className="text-[11px] font-black uppercase tracking-widest">{tripPins.length} stops</span>
                            </div>
                            {trip.gpxStats && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-white/40" />
                                <span className="text-[11px] font-black uppercase tracking-widest">{trip.gpxStats.distanceKm}KM</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-8">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg"
                            style={{ backgroundColor: author.color }}
                          >
                            {author.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 tracking-tight leading-none mb-1">{author.username}</h3>
                            <p className="text-[9px] font-bold text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded uppercase tracking-widest">{new Date(trip.startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</p>
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); onLikeTrip(trip.id); }}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isLiked ? 'bg-red-50 text-red-500 shadow-inner' : 'bg-slate-50 text-slate-300 hover:text-red-400'}`}
                          >
                            <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      </div>

                      <p className="text-slate-600 text-base leading-relaxed font-medium mb-8">
                        {trip.description}
                      </p>

                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => onViewTrip(trip.id)}
                          className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl shadow-slate-200"
                        >
                          View Adventure <ArrowRight size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onBookmarkTrip(trip.id); }}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${isBookmarked ? 'bg-amber-50 border-amber-100 text-amber-500 shadow-inner' : 'bg-white border-slate-100 text-slate-300 hover:text-amber-500'}`}
                        >
                          <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="hidden lg:block lg:col-span-3">
            <div className="sticky top-32 space-y-8">
              {featuredTrip && (
                <div className="relative rounded-[2rem] overflow-hidden group shadow-2xl shadow-slate-200">
                  <img
                    src={featuredTrip.coverPhotoUrl || (locations.find(l => l.tripId === featuredTrip.id)?.photoUrl)}
                    className="w-full h-[32rem] object-cover transition-transform duration-[3s] group-hover:scale-110"
                    alt="Magazine Feature"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/20 opacity-95" />

                  <div className="absolute inset-0 flex flex-col justify-end p-8">
                    <div className="w-12 h-0.5 bg-blue-500 mb-6" />
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">Feature Story</p>
                    <h4 className="text-xl font-black text-white leading-tight mb-8 drop-shadow-lg">{featuredTrip.title}</h4>
                    <button
                      onClick={() => onViewTrip(featuredTrip.id)}
                      className="group/btn flex items-center gap-3 text-white text-xs font-black uppercase tracking-[0.2em]"
                    >
                      Read Feature <ArrowRight size={14} className="group-hover/btn:translate-x-2 transition-transform" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExploreFeed;
