import React, { useState, useMemo } from 'react';
import { Trip, MapLocation, User } from '../types';
import { Search, MapPin, Heart, ArrowRight, Calendar, Bookmark, Compass, Sparkles, Navigation } from 'lucide-react';
import { TRIP_TAGS, DIFFICULTY_LEVELS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';

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

  const publicTrips = useMemo(() => trips.filter(t => t.visibility === 'public'), [trips]);

  const filteredAndSorted = useMemo(() => {
    let result = publicTrips;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(trip =>
        trip.title.toLowerCase().includes(term) ||
        trip.description.toLowerCase().includes(term) ||
        trip.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    if (selectedTag) {
      result = result.filter(trip => trip.tags?.includes(selectedTag));
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'newest': return b.startDate - a.startDate;
        case 'most-liked': return (b.likes?.length || 0) - (a.likes?.length || 0);
        case 'most-photos': return locations.filter(l => l.tripId === b.id).length - locations.filter(l => l.tripId === a.id).length;
        default: return b.startDate - a.startDate;
      }
    });

    return result;
  }, [publicTrips, searchTerm, selectedTag, sortBy, locations]);

  const featuredTrip = useMemo(() => {
    return publicTrips.find(t => t.coverPhotoUrl) || publicTrips[0];
  }, [publicTrips]);

  return (
    <div className="relative w-full h-full bg-[#050505] text-white overflow-y-auto pb-32 scroll-smooth font-sans">

      {/* Search & Header (Floating) */}
      <div className="sticky top-0 z-50 pt-8 pb-4 px-6 md:px-12 bg-gradient-to-b from-[#050505] via-[#050505]/90 to-transparent pointer-events-none flex justify-between items-start">

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-auto"
        >
          <h1 className="text-3xl font-bold tracking-tight mb-1">Explore</h1>
          <p className="text-white/40 text-sm font-medium">Discover cinematic journeys.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="pointer-events-auto relative group w-full max-w-sm hidden md:block"
        >
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/30 group-focus-within:text-white transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search horizons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-full focus:bg-white/10 focus:border-white/20 focus:outline-none text-white placeholder-white/30 transition-all backdrop-blur-md text-sm"
          />
        </motion.div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 mt-6">

        {/* Mobile Search (Visible only on small screens) */}
        <div className="md:hidden relative group w-full mb-8">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/30" size={18} />
          <input
            type="text"
            placeholder="Search horizons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-full focus:bg-white/10 focus:outline-none text-white placeholder-white/30 backdrop-blur-md text-sm"
          />
        </div>

        {/* Filters and Tags Row */}
        <div className="flex flex-col md:flex-row gap-6 mb-12">
          {/* Main Sorting */}
          <div className="flex gap-2 bg-white/5 p-1 rounded-2xl w-fit border border-white/5">
            <button
              onClick={() => setSortBy('newest')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${sortBy === 'newest' ? 'bg-white text-black shadow-lg' : 'text-white/50 hover:text-white'}`}
            >
              <Compass size={14} /> Latest
            </button>
            <button
              onClick={() => setSortBy('most-liked')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${sortBy === 'most-liked' ? 'bg-white text-black shadow-lg' : 'text-white/50 hover:text-white'}`}
            >
              <Navigation size={14} /> Trending
            </button>
          </div>

          {/* Tags (Horizontal Scroll) */}
          <div className="flex-1 overflow-x-auto scrollbar-hide py-1 flex items-center gap-2 pr-6">
            <button
              onClick={() => setSelectedTag(null)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${selectedTag === null ? 'bg-white text-black' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/5'}`}
            >
              ALL
            </button>
            {TRIP_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${selectedTag === tag ? 'bg-white text-black' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-white/5'}`}
              >
                {tag}
              </button>
            ))}
            {/* Added spacer to ensure last item is fully visible when scrolled */}
            <div className="flex-shrink-0 w-2 md:w-6"></div>
          </div>
        </div>

        {/* Empty State */}
        {filteredAndSorted.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-32 rounded-3xl border border-white/5 bg-white/[0.02]"
          >
            <Sparkles size={48} className="mx-auto mb-6 text-white/20" strokeWidth={1} />
            <h2 className="text-2xl font-light text-white tracking-tight">Zero traces found</h2>
            <p className="text-white/40 text-sm mt-2">Adjust your filters to discover new paths.</p>
            <button
              onClick={() => { setSearchTerm(''); setSelectedTag(null); }}
              className="mt-8 px-8 py-3 bg-white text-black text-xs font-bold rounded-full hover:scale-105 transition-transform"
            >
              Reset World
            </button>
          </motion.div>
        )}

        {/* Cinematic Bento/Masonry Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-[320px]">
          <AnimatePresence>
            {filteredAndSorted.map((trip, index) => {
              const author = users.find(u => u.id === trip.userId);
              const tripPins = locations.filter(l => l.tripId === trip.id);
              const isLiked = currentUser && trip.likes?.includes(currentUser.id);
              const isBookmarked = currentUser && currentUser.bookmarks?.includes(trip.id);

              if (!author) return null;

              // Grid Span Logic for Bento effect
              const isFeatured = index === 0; // First item is massive
              const coverPhoto = trip.coverPhotoUrl || (tripPins.length > 0 ? tripPins[0].photoUrl : 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b');

              return (
                <motion.article
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  key={trip.id}
                  onClick={() => onViewTrip(trip.id)}
                  className={`group relative rounded-[2rem] overflow-hidden cursor-pointer bg-white/5 border border-white/10 hover:border-white/30 transition-all duration-500
                    ${isFeatured ? 'md:col-span-2 md:row-span-2' : ''}
                  `}
                >
                  {/* Cinematic Image Background */}
                  <div className="absolute inset-0">
                    <img
                      src={coverPhoto}
                      className="w-full h-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-110"
                      alt={trip.title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-70" />
                  </div>

                  {/* Header overlay (Tags & Actions) */}
                  <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10">
                    <div className="flex flex-wrap gap-2">
                      {trip.tags?.slice(0, 2).map(tag => (
                        <span key={tag} className="px-3 py-1.5 bg-black/40 backdrop-blur-md text-white text-[9px] font-bold uppercase tracking-widest rounded-full border border-white/10">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onBookmarkTrip(trip.id); }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${isBookmarked ? 'bg-white text-black' : 'bg-black/40 text-white/50 hover:bg-white/20 hover:text-white border border-white/10'}`}
                      >
                        <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} strokeWidth={isBookmarked ? 0 : 2} />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Content Area */}
                  <div className="absolute bottom-0 left-0 right-0 p-8 z-10 flex flex-col justify-end transform transition-transform duration-500 translate-y-4 group-hover:translate-y-0">

                    {/* Author & Date */}
                    <div className="flex items-center gap-3 mb-4 opacity-70 group-hover:opacity-100 transition-opacity duration-500">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold overflow-hidden border border-white/20 backdrop-blur-sm">
                        {author.avatarUrl ? (
                          <img src={author.avatarUrl} alt={author.username} className="w-full h-full object-cover" />
                        ) : author.username.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold">{author.username}</span>
                      <span className="w-1 h-1 rounded-full bg-white/40" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{new Date(trip.startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                    </div>

                    {/* Title */}
                    <h2 className={`${isFeatured ? 'text-4xl md:text-5xl' : 'text-3xl'} font-bold leading-[1.1] tracking-tight mb-2 drop-shadow-xl`}>
                      {trip.title}
                    </h2>

                    {/* Hidden Stats that slide up on hover */}
                    <div className="mt-4 flex items-center gap-4 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-white" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{tripPins.length} stops</span>
                      </div>
                      {trip.gpxStats && (
                        <div className="flex items-center gap-1.5">
                          <Compass size={14} className="text-white" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{trip.gpxStats.distanceKm}KM</span>
                        </div>
                      )}

                      {/* Read More button inline */}
                      <div className="ml-auto">
                        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white">
                          Explore <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </span>
                      </div>
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
