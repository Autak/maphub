import React, { useState, useCallback, useEffect } from 'react';
import LocationModal from './components/LocationModal';
import LandingPage from './components/LandingPage';
import TripModal from './components/TripModal';
import ProfilePage from './components/ProfilePage';
import ExploreFeed from './components/ExploreFeed';
import TripDetailPage from './components/TripDetailPage';
import NavBar from './components/NavBar';
import ExpeditionDashboard from './components/ExpeditionDashboard';
import { MapLocation, Coordinates, NewLocationDraft, User, Trip } from './types';
import { api, setToken, clearToken, AuthUser } from './services/api';
import { Plus } from 'lucide-react';

// Convert API user shape to app User shape
const toAppUser = (u: AuthUser): User => ({
  id: u.id,
  username: u.username,
  email: u.email,
  password: '', // never stored on client
  color: u.color,
  bio: u.bio,
  avatarUrl: u.avatarUrl,
  joinedAt: u.joinedAt,
  bookmarks: u.bookmarks || [],
});

const App: React.FC = () => {
  // Global Data State
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Session & View State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'map' | 'feed' | 'profile' | 'trip-detail'>('map');
  const [viewingTripId, setViewingTripId] = useState<string | null>(null);
  const [tripDetailSource, setTripDetailSource] = useState<'profile' | 'explore'>('explore');
  const [isLoading, setIsLoading] = useState(true);

  // Map UI State
  const [draftLocation, setDraftLocation] = useState<NewLocationDraft | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [showTripModal, setShowTripModal] = useState(false);

  // --- Session restore + data load ---

  useEffect(() => {
    const restore = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const me = await api.getMe();
          setCurrentUser(toAppUser(me));
          await loadData();
        }
      } catch {
        // Token invalid or expired
        clearToken();
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const loadData = async () => {
    try {
      const [tripsData, locationsData, usersData] = await Promise.all([
        api.getTrips(),
        api.getLocations(),
        api.getUsers(),
      ]);
      setTrips(tripsData);
      setLocations(locationsData);
      setUsers(usersData.map(toAppUser));
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  // --- Handlers ---

  const handleLogin = async (user: User, token?: string) => {
    if (token) {
      setToken(token);
    }
    setCurrentUser(user);
    setCurrentView('map');
    // Load all data from backend
    await loadData();
    // Set active trip to latest user trip
    const userTrips = trips.filter(t => t.userId === user.id);
    if (userTrips.length > 0) {
      setActiveTripId(userTrips[userTrips.length - 1].id);
    }
  };

  const handleLogout = () => {
    clearToken();
    setCurrentUser(null);
    setTrips([]);
    setLocations([]);
    setUsers([]);
    setActiveTripId(null);
    setCurrentView('map');
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      const updated = await api.updateProfile({
        username: updatedUser.username,
        bio: updatedUser.bio,
        avatarUrl: updatedUser.avatarUrl,
      });
      const appUser = toAppUser(updated);
      setCurrentUser(appUser);
      setUsers(prev => prev.map(u => u.id === appUser.id ? appUser : u));
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  };

  const handleCreateTrip = async (data: {
    title: string;
    description: string;
    date: string;
    endDate?: string;
    location?: string;
    visibility: 'public' | 'private' | 'friends';
    difficulty?: 'easy' | 'moderate' | 'hard' | 'expert';
    tags: string[];
    coverPhotoUrl?: string;
    gpxData?: { lat: number; lng: number; ele?: number }[];
    gpxStats?: { distanceKm: number; estimatedDays: number };
    externalLinks?: { label: string; url: string }[];
  }) => {
    if (!currentUser) return;
    try {
      const newTrip = await api.createTrip({
        title: data.title,
        description: data.description,
        startDate: new Date(data.date).getTime(),
        endDate: data.endDate ? new Date(data.endDate).getTime() : undefined,
        location: data.location,
        visibility: data.visibility,
        difficulty: data.difficulty,
        tags: data.tags,
        coverPhotoUrl: data.coverPhotoUrl,
        gpxData: data.gpxData,
        gpxStats: data.gpxStats,
        externalLinks: data.externalLinks,
      });
      setTrips(prev => [...prev, newTrip]);
      setActiveTripId(newTrip.id);
      setShowTripModal(false);
    } catch (err) {
      console.error('Failed to create trip:', err);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
      await api.deleteTrip(tripId);
      setTrips(prev => prev.filter(t => t.id !== tripId));
      setLocations(prev => prev.filter(l => l.tripId !== tripId));
      if (activeTripId === tripId) setActiveTripId(null);
    } catch (err) {
      console.error('Failed to delete trip:', err);
    }
  };

  const handleToggleVisibility = async (tripId: string) => {
    try {
      const result = await api.toggleVisibility(tripId);
      setTrips(prev => prev.map(t => t.id === tripId ? { ...t, visibility: result.visibility } : t));
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
    }
  };

  const handleUpdateTrip = async (tripId: string, data: Partial<Trip>) => {
    try {
      const updated = await api.updateTrip(tripId, data);
      setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
      return updated;
    } catch (err) {
      console.error('Failed to update trip:', err);
    }
  };

  const handleUpdateLocation = async (locationId: string, data: { title?: string; comment?: string; type?: string; timestamp?: number }) => {
    try {
      const updated = await api.updateLocation(locationId, data);
      setLocations(prev => prev.map(l => l.id === locationId ? updated : l));
      return updated;
    } catch (err) {
      console.error('Failed to update location:', err);
    }
  };

  const handleSaveRouteToTrip = async (routeData: { name: string; points: { lat: number; lng: number; ele?: number }[]; distanceKm: number; ascent: number; descent: number; day: 'all' }) => {
    if (!activeTripId) return;
    const trip = trips.find(t => t.id === activeTripId);
    if (!trip) return;
    const currentRoutes = trip.hikingRoutes || [];
    await handleUpdateTrip(activeTripId, { hikingRoutes: [...currentRoutes, routeData] });
  };

  const handleDeleteLocation = async (locationId: string) => {
    try {
      await api.deleteLocation(locationId);
      setLocations(prev => prev.filter(l => l.id !== locationId));
    } catch (err) {
      console.error('Failed to delete location:', err);
    }
  };

  const handleLikeTrip = async (tripId: string) => {
    if (!currentUser) return;
    try {
      const result = await api.likeTrip(tripId);
      setTrips(prev => prev.map(t => t.id === tripId ? { ...t, likes: result.likes } : t));
    } catch (err) {
      console.error('Failed to like trip:', err);
    }
  };

  const handleBookmarkTrip = (tripId: string) => {
    if (!currentUser) return;
    const bookmarks = currentUser.bookmarks || [];
    const alreadyBookmarked = bookmarks.includes(tripId);
    const updatedUser = {
      ...currentUser,
      bookmarks: alreadyBookmarked ? bookmarks.filter(id => id !== tripId) : [...bookmarks, tripId]
    };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const handleMapClick = useCallback((coords: Coordinates) => {
    if (currentView !== 'map') return;

    if (!currentUser) return;
    if (!activeTripId) return;
    setDraftLocation({
      coords,
      photoFile: null,
      photoPreview: null
    });
    setSelectedLocationId(null);
  }, [currentUser, activeTripId, currentView]);

  const handleSaveLocation = async (data: Omit<MapLocation, 'id' | 'timestamp' | 'tripId' | 'userId'>) => {
    if (!currentUser || !activeTripId) return;
    try {
      const newLocation = await api.createLocation({
        tripId: activeTripId,
        coords: data.coords,
        title: data.title,
        comment: data.comment,
        photoUrl: data.photoUrl,
        type: data.type,
      });
      setLocations(prev => [...prev, newLocation]);
      setDraftLocation(null);
      setSelectedLocationId(newLocation.id);
      setIsSidebarOpen(true);
    } catch (err) {
      console.error('Failed to save location:', err);
    }
  };

  const handleAddLocationFromTrip = async (data: Omit<MapLocation, 'id'>) => {
    try {
      const newLocation = await api.createLocation({
        tripId: data.tripId,
        coords: data.coords,
        title: data.title,
        comment: data.comment,
        photoUrl: data.photoUrl,
        type: data.type,
        timestamp: data.timestamp,
      });
      setLocations(prev => [...prev, newLocation]);
      return newLocation;
    } catch (err) {
      console.error('Failed to add location from trip:', err);
    }
  };

  const handleViewTrip = (tripId: string, source: 'profile' | 'explore' = 'explore') => {
    setViewingTripId(tripId);
    setTripDetailSource(source);
    setCurrentView('trip-detail');
  };

  const handleBackFromTripDetail = () => {
    setViewingTripId(null);
    setCurrentView(tripDetailSource === 'profile' ? 'profile' : 'feed');
  };

  // --- Render ---

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium text-sm">Loading TrailThread...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LandingPage onLogin={handleLogin} />;
  }

  // Trip Detail View
  if (currentView === 'trip-detail' && viewingTripId) {
    const trip = trips.find(t => t.id === viewingTripId);
    const author = trip ? users.find(u => u.id === trip.userId) : null;
    const isEditable = tripDetailSource === 'profile' && trip?.userId === currentUser.id;

    if (trip && author) {
      return (
        <div className="relative w-full h-full overflow-hidden font-sans">
          <TripDetailPage
            trip={trip}
            locations={locations}
            author={author}
            currentUser={currentUser}
            onBack={handleBackFromTripDetail}
            onLike={handleLikeTrip}
            onBookmark={handleBookmarkTrip}
            isEditable={isEditable}
            onUpdateTrip={handleUpdateTrip}
            onUpdateLocation={handleUpdateLocation}
            onDeleteLocation={handleDeleteLocation}
            onDeleteTrip={handleDeleteTrip}
            onAddLocation={isEditable ? handleAddLocationFromTrip : undefined}
          />
        </div>
      );
    }
  }

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden font-sans">

      {/* VIEW: MY MAP (Expedition Dashboard) */}
      {currentView === 'map' && (
        <div className="absolute inset-0 z-10 animate-page-in">
          <ExpeditionDashboard
            currentUser={currentUser}
            trips={trips}
            locations={locations}
            onViewTrip={(id) => handleViewTrip(id, 'profile')}
            onCreateTrip={() => setShowTripModal(true)}
          />
        </div>
      )}

      {/* VIEW: FEED */}
      {currentView === 'feed' && (
        <div className="absolute inset-0 z-20 bg-slate-50 animate-page-in">
          <ExploreFeed
            trips={trips}
            locations={locations}
            users={users}
            currentUser={currentUser}
            onViewTrip={handleViewTrip}
            onLikeTrip={handleLikeTrip}
            onBookmarkTrip={handleBookmarkTrip}
          />
        </div>
      )}

      {/* VIEW: PROFILE */}
      {currentView === 'profile' && (
        <div className="absolute inset-0 z-[2000] bg-slate-50 animate-page-in">
          <ProfilePage
            user={currentUser}
            trips={trips}
            locations={locations}
            allUsers={users}
            onViewTripFromProfile={(id: string) => handleViewTrip(id, 'profile')}
            onUpdateUser={handleUpdateUser}
            onLogout={handleLogout}
            onViewTrip={handleViewTrip}
            onCreateTrip={() => setShowTripModal(true)}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="relative z-[3000]">
        <NavBar currentView={currentView} setView={(view) => setCurrentView(view)} />
      </div>

      {/* Modals */}
      {draftLocation && (
        <LocationModal
          draft={draftLocation}
          onClose={() => setDraftLocation(null)}
          onSave={handleSaveLocation}
        />
      )}

      {showTripModal && (
        <TripModal
          onClose={() => setShowTripModal(false)}
          onSave={handleCreateTrip}
        />
      )}

    </div>
  );
};

export default App;
