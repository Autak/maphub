import React, { useState, useRef, useMemo } from 'react';
import { User, Trip, MapLocation } from '../types';
import { Camera, MapPin, Calendar, Edit2, Check, LogOut, Loader2, Globe, Lock, Heart, Bookmark, Footprints, Mountain, Tent, Droplets, Binoculars, Compass } from 'lucide-react';
import { DIFFICULTY_LEVELS } from '../constants';
import { compressImage } from '../services/imageService';




interface ProfilePageProps {
  user: User;
  trips: Trip[];
  locations: MapLocation[];
  allUsers: User[];
  onUpdateUser: (user: User) => void;
  onLogout: () => void;
  onViewTrip: (tripId: string) => void;
  onViewTripFromProfile: (tripId: string) => void;
}

type ProfileTab = 'public' | 'private' | 'saved';

const ProfilePage: React.FC<ProfilePageProps> = ({ user, trips, locations, allUsers, onUpdateUser, onLogout, onViewTrip, onViewTripFromProfile }) => {
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

  // Bookmarked trips
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

  const TripCard = ({ trip }: { trip: Trip }) => {
    const tripPins = locations.filter(l => l.tripId === trip.id);
    const coverPhoto = trip.coverPhotoUrl || (tripPins.length > 0 ? tripPins[0].photoUrl : null);
    const isPublic = trip.visibility === 'public';
    const author = allUsers.find(u => u.id === trip.userId);
    const difficultyInfo = trip.difficulty ? DIFFICULTY_LEVELS.find(d => d.id === trip.difficulty) : null;
    const isOwn = trip.userId === user.id;

    return (
      <div
        className="bg-white rounded-xl shadow-sm hover:shadow-lg transition overflow-hidden group border border-slate-100 cursor-pointer"
        onClick={() => isOwn ? onViewTripFromProfile(trip.id) : onViewTrip(trip.id)}
      >
        <div className="h-48 bg-slate-200 relative overflow-hidden">
          {coverPhoto ? (
            <img src={coverPhoto} alt={trip.title} className="w-full h-full object-cover transition duration-700 group-hover:scale-110" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
              <MapPin size={48} opacity={0.2} />
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            {isOwn && (
              <span className={`backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${isPublic ? 'bg-green-500/80 text-white' : 'bg-slate-800/60 text-white'}`}>
                {isPublic ? <Globe size={10} /> : <Lock size={10} />}
                {isPublic ? 'Public' : 'Private'}
              </span>
            )}
            {!isOwn && author && (
              <span className="bg-white/80 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold text-slate-700">
                by {author.username}
              </span>
            )}
          </div>
          <div className="absolute top-3 right-3 flex gap-1.5">
            {difficultyInfo && (
              <span className={`${difficultyInfo.color} text-white text-[10px] font-bold px-2 py-1 rounded-full`}>
                {difficultyInfo.icon} {difficultyInfo.label}
              </span>
            )}
          </div>
          <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
            {trip.gpxStats && (
              <div className="bg-slate-900/90 backdrop-blur px-2 py-1 rounded text-white text-[9px] font-bold flex items-center gap-1.5 tracking-tight">
                <span>KM {trip.gpxStats.distanceKm}</span>
                <span className="opacity-50">|</span>
                <span>DAYS {trip.gpxStats.estimatedDays}</span>
              </div>
            )}
            <div className="bg-black/40 backdrop-blur px-2 py-1 rounded text-white text-[9px] font-bold uppercase tracking-wider">
              {tripPins.length} Memories
            </div>
          </div>
        </div>
        <div className="p-5">
          <h3 className="font-bold text-lg text-slate-800 mb-1">{trip.title}</h3>
          <p className="text-slate-500 text-sm line-clamp-2 mb-3">{trip.description}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Calendar size={12} />
              {new Date(trip.startDate).toLocaleDateString()}
            </div>
            {(trip.likes?.length || 0) > 0 && (
              <div className="flex items-center gap-1 text-xs text-red-400 font-medium">
                <Heart size={12} fill="currentColor" /> {trip.likes?.length}
              </div>
            )}
          </div>
          {trip.tags && trip.tags.length > 0 && (
            <div className="flex gap-1 mt-3 flex-wrap">
              {trip.tags.slice(0, 4).map(tag => (
                <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const tabTrips = activeTab === 'public' ? publicTrips : activeTab === 'private' ? privateTrips : savedTrips;
  const tabLabel = activeTab === 'public' ? 'Public Journeys' : activeTab === 'private' ? 'Private Journeys' : 'Saved Trips';

  return (
    <div className="w-full h-full bg-slate-50 overflow-y-auto pb-24">
      {/* Header / Cover */}
      <div className="h-48 relative" style={{ background: 'linear-gradient(135deg, #0f1b2d 0%, #1a2d4a 50%, #0d2137 100%)' }}>
        <div className="absolute top-4 right-4">
          <button onClick={onLogout} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg backdrop-blur flex items-center gap-2 text-sm font-bold transition">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-16">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
            {/* Avatar */}
            <div className="relative group">
              <div
                className="w-32 h-32 rounded-2xl border-4 border-white shadow-lg overflow-hidden bg-slate-200 flex items-center justify-center text-4xl font-bold text-white"
                style={{ backgroundColor: user.avatarUrl ? 'transparent' : user.color }}
              >
                {isCompressing ? (
                  <Loader2 className="animate-spin text-slate-500" />
                ) : user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  user.username.substring(0, 2).toUpperCase()
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                className="absolute bottom-2 right-2 p-2 bg-slate-900 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition transform scale-90 hover:scale-100 disabled:opacity-50"
              >
                <Camera size={16} />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
            </div>

            {/* Info */}
            <div className="flex-1 w-full">
              <div className="flex justify-between items-start">
                <div className="w-full">
                  {isEditing ? (
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="text-2xl font-bold text-slate-800 border-b border-blue-500 focus:outline-none w-full md:w-auto mb-1"
                    />
                  ) : (
                    <h1 className="text-3xl font-bold text-slate-900">{user.username}</h1>
                  )}
                  <p className="text-slate-500 text-sm flex items-center gap-2 mb-2">
                    <span>Joined {new Date(user.joinedAt).toLocaleDateString()}</span>
                  </p>
                </div>
                <button
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  className={`p-2 rounded-full transition ${isEditing ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  {isEditing ? <Check size={20} /> : <Edit2 size={20} />}
                </button>
              </div>

              {isEditing ? (
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell the world about your adventures..."
                  className="w-full p-3 bg-slate-50 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 resize-none h-24"
                />
              ) : (
                <p className="text-slate-600 leading-relaxed max-w-2xl">
                  {user.bio || "No bio yet. Start sharing your story!"}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-6 text-center">
              <div>
                <span className="block text-2xl font-black text-slate-900">{myTrips.length}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Trips</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-slate-900">{myLocations.length}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Pins</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-red-500">{totalLikes}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Likes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trip Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab('public')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'public' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
          >
            <Globe size={14} /> Public ({publicTrips.length})
          </button>
          <button
            onClick={() => setActiveTab('private')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'private' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
          >
            <Lock size={14} /> Private ({privateTrips.length})
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'saved' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
          >
            <Bookmark size={14} /> Saved ({savedTrips.length})
          </button>
        </div>

        {/* Trips Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {tabTrips.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl bg-white text-slate-400">
              <p className="text-lg mb-1 flex flex-col items-center gap-2">
                {activeTab === 'saved' ? <Bookmark size={32} className="opacity-20" /> : activeTab === 'private' ? <Lock size={32} className="opacity-20" /> : <Globe size={32} className="opacity-20" />}
                {activeTab === 'saved' ? 'No saved trips yet' : activeTab === 'private' ? 'No private trips' : 'No public trips yet'}
              </p>
              <p className="text-sm">
                {activeTab === 'saved' ? 'Bookmark trips from the Explore feed to see them here.' : 'Create a trip and start adding memories!'}
              </p>
            </div>
          )}
          {tabTrips.slice().reverse().map(trip => <TripCard key={trip.id} trip={trip} />)}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;