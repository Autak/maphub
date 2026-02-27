import React, { useState, useRef, useMemo } from 'react';
import { User, Trip, MapLocation } from '../types';
import { Camera, MapPin, Calendar, Edit2, Check, LogOut, Loader2, Globe, Lock, Heart, Bookmark, Compass, Plus } from 'lucide-react';
import { DIFFICULTY_LEVELS } from '../constants';
import { compressImage } from '../services/imageService';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfilePageProps {
  user: User;
  trips: Trip[];
  locations: MapLocation[];
  allUsers: User[];
  onUpdateUser: (user: User) => void;
  onLogout: () => void;
  onViewTrip: (tripId: string) => void;
  onViewTripFromProfile: (tripId: string) => void;
  onCreateTrip?: () => void;
}

type ProfileTab = 'public' | 'private' | 'saved';

// Animated Counter Component
const AnimatedCounter = ({ value, label }: { value: number, label: string }) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-sm">
      <motion.span
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: 'spring' }}
        className="block text-4xl font-black text-white tracking-tighter mb-1"
      >
        {value}
      </motion.span>
      <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
};

const ProfilePage: React.FC<ProfilePageProps> = ({ user, trips, locations, allUsers, onUpdateUser, onLogout, onViewTrip, onViewTripFromProfile, onCreateTrip }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(user.bio || '');
  const [username, setUsername] = useState(user.username);
  const [isCompressing, setIsCompressing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('public');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const myTrips = useMemo(() => trips.filter(t => t.userId === user.id), [trips, user.id]);
  const myLocations = useMemo(() => locations.filter(l => l.userId === user.id), [locations, user.id]);
  const publicTrips = useMemo(() => myTrips.filter(t => t.visibility === 'public'), [myTrips]);
  const privateTrips = useMemo(() => myTrips.filter(t => t.visibility !== 'public'), [myTrips]);
  const totalLikes = useMemo(() => myTrips.reduce((sum, t) => sum + (t.likes?.length || 0), 0), [myTrips]);

  const savedTrips = useMemo(() => {
    if (!user.bookmarks?.length) return [];
    return trips.filter(t => user.bookmarks!.includes(t.id));
  }, [trips, user.bookmarks]);

  const handleSave = () => {
    onUpdateUser({ ...user, bio, username });
    setIsEditing(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsCompressing(true);
      try {
        const compressedBase64 = await compressImage(file, 400, 0.7);
        onUpdateUser({ ...user, avatarUrl: compressedBase64 });
      } catch (err) {
        console.error("Avatar compression failed", err);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const TripCard = ({ trip, index }: { trip: Trip, index: number }) => {
    const tripPins = locations.filter(l => l.tripId === trip.id);
    const coverPhoto = trip.coverPhotoUrl || (tripPins.length > 0 ? tripPins[0].photoUrl : 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b');
    const isPublic = trip.visibility === 'public';
    const author = allUsers.find(u => u.id === trip.userId);
    const isOwn = trip.userId === user.id;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, delay: index * 0.05 }}
        onClick={() => isOwn ? onViewTripFromProfile(trip.id) : onViewTrip(trip.id)}
        className="group relative rounded-[2rem] overflow-hidden cursor-pointer bg-white/5 border border-white/10 hover:border-white/30 transition-all duration-500 h-[320px]"
      >
        <div className="absolute inset-0">
          <img src={coverPhoto} className="w-full h-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-110" alt={trip.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-70" />
        </div>

        <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10">
          <div className="flex gap-2">
            {isOwn && (
              <span className={`px-3 py-1.5 backdrop-blur-md text-white text-[9px] font-bold uppercase tracking-widest rounded-full border border-white/10 flex items-center gap-1.5 ${isPublic ? 'bg-green-500/40' : 'bg-black/60'}`}>
                {isPublic ? <Globe size={10} /> : <Lock size={10} />}
                {isPublic ? 'Public' : 'Private'}
              </span>
            )}
            {!isOwn && author && (
              <span className="px-3 py-1.5 bg-white/20 backdrop-blur-md text-white text-[9px] font-bold uppercase tracking-widest rounded-full border border-white/10">
                by {author.username}
              </span>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 z-10 flex flex-col justify-end transform transition-transform duration-500 translate-y-4 group-hover:translate-y-0">
          <h3 className="text-2xl font-bold leading-[1.1] tracking-tight text-white mb-2 drop-shadow-xl">{trip.title}</h3>

          <div className="flex items-center gap-4 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-white" />
              <span className="text-[10px] font-bold uppercase tracking-widest">{new Date(trip.startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
            </div>
            {(trip.likes?.length || 0) > 0 && (
              <div className="flex items-center gap-1.5">
                <Heart size={14} className="text-red-400" fill="currentColor" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{trip.likes?.length}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const tabTrips = activeTab === 'public' ? publicTrips : activeTab === 'private' ? privateTrips : savedTrips;

  return (
    <div className="w-full h-full bg-[#050505] text-white overflow-y-auto pb-32 font-sans overflow-x-hidden">

      {/* Cinematic Header Background */}
      <div className="h-[35vh] min-h-[300px] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/10 to-transparent" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542224566-6e85f2e6772f')] bg-cover bg-center opacity-20 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />

        <div className="absolute top-6 right-6 z-10">
          <button onClick={onLogout} className="bg-white/5 hover:bg-white border border-white/10 text-white hover:text-black px-5 py-2.5 rounded-full backdrop-blur-md flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 md:px-12 -mt-32 relative z-10">

        {/* Profile Info Section */}
        <div className="flex flex-col md:flex-row gap-10 items-start mb-16">

          {/* Avatar Container */}
          <div className="relative group shrink-0">
            <div
              className="w-40 h-40 rounded-[2.5rem] overflow-hidden bg-white/5 border border-white/20 backdrop-blur-xl flex items-center justify-center text-5xl font-black text-white shadow-2xl"
              style={{ backgroundColor: user.avatarUrl ? 'transparent' : `${user.color}40` }}
            >
              {isCompressing ? (
                <Loader2 className="animate-spin text-white/50" size={32} />
              ) : user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                user.username.substring(0, 2).toUpperCase()
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              className="absolute -bottom-4 -right-4 w-14 h-14 bg-white text-black rounded-full shadow-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all disabled:opacity-50 border-4 border-[#050505]"
            >
              <Camera size={20} />
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
          </div>

          {/* User Details */}
          <div className="flex-1 w-full pt-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
              <div className="w-full">
                {isEditing ? (
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="text-4xl md:text-6xl font-black text-white bg-transparent border-b-2 border-white/20 focus:border-white outline-none w-full max-w-md tracking-tighter"
                  />
                ) : (
                  <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">{user.username}</h1>
                )}
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-3">
                  Pioneer since {new Date(user.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                </p>
              </div>

              <button
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border ${isEditing ? 'bg-white text-black border-white hover:scale-105' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white'}`}
              >
                {isEditing ? <Check size={20} /> : <Edit2 size={18} />}
              </button>
            </div>

            {isEditing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your travel philosophy..."
                className="w-full p-6 bg-white/5 rounded-3xl border border-white/20 focus:border-white outline-none text-white text-lg font-light resize-none h-32 backdrop-blur-md"
              />
            ) : (
              <p className="text-white/70 text-lg md:text-xl font-light font-serif leading-relaxed max-w-3xl">
                {user.bio ? `"${user.bio}"` : "Every journey begins with a single trace."}
              </p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          <AnimatedCounter value={myTrips.length} label="Expeditions" />
          <AnimatedCounter value={myLocations.length} label="Map pins" />
          <AnimatedCounter value={totalLikes} label="Resonances" />
        </div>

        {/* Cinematic Segmented Control Tabs */}
        <div className="flex items-center gap-4 mb-10 w-full place-content-center">
          <div className="flex p-1.5 bg-white/5 border border-white/10 rounded-full w-full max-w-md relative overflow-hidden backdrop-blur-md">
            <div
              className="absolute top-1.5 bottom-1.5 bg-white rounded-full transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
              style={{
                width: 'calc(33.333% - 4px)',
                transform: `translateX(${activeTab === 'public' ? '0' : activeTab === 'private' ? '100%' : '200%'})`,
                left: activeTab === 'public' ? '4px' : activeTab === 'private' ? '2px' : '0px'
              }}
            />
            <button onClick={() => setActiveTab('public')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest z-10 transition-colors duration-300 flex justify-center items-center gap-2 ${activeTab === 'public' ? 'text-black' : 'text-white/50 hover:text-white'}`}>
              <Globe size={14} /> Public
            </button>
            <button onClick={() => setActiveTab('private')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest z-10 transition-colors duration-300 flex justify-center items-center gap-2 ${activeTab === 'private' ? 'text-black' : 'text-white/50 hover:text-white'}`}>
              <Lock size={14} /> Private
            </button>
            <button onClick={() => setActiveTab('saved')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest z-10 transition-colors duration-300 flex justify-center items-center gap-2 ${activeTab === 'saved' ? 'text-black' : 'text-white/50 hover:text-white'}`}>
              <Bookmark size={14} /> Saved trips
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode='popLayout'>
            {onCreateTrip && activeTab !== 'saved' && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={onCreateTrip}
                className="group relative rounded-[2rem] overflow-hidden cursor-pointer bg-white/5 border border-white/20 border-dashed hover:border-white hover:bg-white/10 transition-all duration-500 h-[320px] flex flex-col items-center justify-center text-white/50 hover:text-white"
              >
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
                  <Plus size={32} strokeWidth={2} />
                </div>
                <h3 className="text-2xl font-bold tracking-tight mb-2 drop-shadow-xl text-white">New Journey</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest">Start forging a new path</p>
              </motion.div>
            )}

            {tabTrips.length === 0 && (!onCreateTrip || activeTab === 'saved') ? (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="col-span-full py-24 text-center border border-white/10 rounded-[2rem] bg-white/5 backdrop-blur-md"
              >
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  {activeTab === 'saved' ? <Bookmark size={24} className="text-white/30" /> : activeTab === 'private' ? <Lock size={24} className="text-white/30" /> : <Globe size={24} className="text-white/30" />}
                </div>
                <h3 className="text-xl font-light text-white mb-2">
                  {activeTab === 'saved' ? 'Empty trips' : activeTab === 'private' ? 'Empty Private' : 'No Public Traces'}
                </h3>
                <p className="text-white/40 text-sm">
                  {activeTab === 'saved' ? 'Bookmark expeditions from the Explore feed to collect them here.' : 'Forge a new path and chronicle your memories.'}
                </p>
              </motion.div>
            ) : (
              tabTrips.slice().reverse().map((trip, idx) => (
                <TripCard key={trip.id} trip={trip} index={idx} />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
