import React, { useState, useMemo } from 'react';
import { MapLocation, Trip, User } from '../types';
import { LOCATION_TYPES } from '../constants';
import { MapPin, Navigation, Plus, User as UserIcon, LogOut, Map as MapIcon, Calendar, Trash2, ChevronDown, ChevronRight, Globe, Lock, ArrowLeft } from 'lucide-react';

interface StatsSidebarProps {
  currentUser: User;
  trips: Trip[];
  locations: MapLocation[];
  activeTripId: string | null;
  selectedLocationId?: string | null;
  onSelectTrip: (id: string) => void;
  onSelectLocation?: (id: string | null) => void;
  onCreateTrip: () => void;
  onDeleteTrip: (id: string) => void;
  onToggleVisibility: (tripId: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  onViewChange: (view: 'map' | 'feed' | 'profile') => void;
}

const StatsSidebar: React.FC<StatsSidebarProps> = ({
  currentUser,
  trips,
  locations,
  activeTripId,
  selectedLocationId,
  onSelectTrip,
  onSelectLocation,
  onCreateTrip,
  onDeleteTrip,
  onToggleVisibility,
  onLogout,
  isOpen,
  toggleSidebar,
  onViewChange
}) => {
  const myTrips = useMemo(() => trips.filter(t => t.userId === currentUser.id), [trips, currentUser.id]);
  const totalPins = useMemo(() => locations.filter(l => l.userId === currentUser.id).length, [locations, currentUser.id]);
  const totalTrips = myTrips.length;

  return (
    <div
      className={`
        fixed top-0 left-0 bottom-0 z-[900] 
        bg-white shadow-2xl pointer-events-auto flex flex-col border-r border-slate-200
        transition-all duration-300 ease-in-out
        ${isOpen ? 'w-[30rem] translate-x-0' : 'w-16 translate-x-0'}
      `}
    >
      {/* Sidebar Header */}
      <div className="flex items-center p-4 border-b h-16 bg-slate-50 flex-shrink-0">
        {isOpen ? (
          <div className="flex-1 flex justify-between items-center animate-fade-in-down">
            <h1 className="text-xl font-black text-slate-900 cursor-pointer" onClick={() => onViewChange('feed')}>TrailThread</h1>
            <button onClick={toggleSidebar} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
              <Navigation size={18} className="transform rotate-180" />
            </button>
          </div>
        ) : (
          <button onClick={() => onViewChange('feed')} className="w-full flex justify-center py-4" title="Explore Feed">
            <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-white font-bold text-lg">T</div>
          </button>
        )}
      </div>

      {isOpen ? (
        <>
          {/* User Profile Snippet */}
          <div
            className="p-6 bg-slate-50 border-b border-slate-100 flex items-center gap-4 flex-shrink-0 cursor-pointer hover:bg-slate-100 transition"
            onClick={() => onViewChange('profile')}
          >
            <div className="w-12 h-12 rounded-full shadow-lg border-2 border-white flex items-center justify-center text-white text-lg font-bold overflow-hidden bg-slate-200" style={{ backgroundColor: currentUser.avatarUrl ? 'transparent' : currentUser.color }}>
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.username} className="w-full h-full object-cover" />
              ) : (
                currentUser.username.substring(0, 2).toUpperCase()
              )}
            </div>
            <div className="overflow-hidden">
              <h2 className="font-bold text-slate-800 truncate">{currentUser.username}</h2>
              <p className="text-xs text-slate-500 font-medium">
                {totalTrips} Trips • {totalPins} Pins
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">

            {/* New Trip Action */}
            <button
              onClick={onCreateTrip}
              className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg flex items-center justify-center gap-2 transition transform active:scale-[0.98] font-bold tracking-tight"
            >
              <Plus size={20} />
              Start New Journey
            </button>

            {/* My Trips List */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                <MapIcon size={12} />
                My Journeys
              </h3>

              <div className="space-y-4 pb-12">
                {myTrips.length === 0 && (
                  <div className="text-sm text-slate-400 italic text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl">
                    No trips yet. Start one!
                  </div>
                )}

                {myTrips.slice().reverse().map(trip => {
                  const isActive = trip.id === activeTripId;
                  const tripLocations = locations.filter(l => l.tripId === trip.id).sort((a, b) => a.timestamp - b.timestamp);
                  const isPublic = trip.visibility === 'public';
                  const coverPhoto = trip.coverPhotoUrl || (tripLocations.length > 0 ? tripLocations[0].photoUrl : null);
                  const selectedLoc = selectedLocationId ? tripLocations.find(l => l.id === selectedLocationId) : null;

                  return (
                    <div key={trip.id} className={`flex flex-col rounded-2xl transition-all border ${isActive ? 'bg-slate-50 border-blue-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                      {/* Trip Card Header */}
                      <div
                        onClick={() => onSelectTrip(trip.id)}
                        className="cursor-pointer relative rounded-t-2xl overflow-hidden"
                      >
                        {coverPhoto && (
                          <div className="h-24 w-full overflow-hidden relative">
                            <img src={coverPhoto} alt={trip.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
                            <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end">
                              <h4 className="font-black text-white text-base truncate drop-shadow-md tracking-tight">{trip.title}</h4>
                            </div>
                          </div>
                        )}

                        <div className="p-4">
                          {!coverPhoto && (
                            <h4 className={`font-black text-base truncate mb-1 tracking-tight ${isActive ? 'text-blue-900' : 'text-slate-900'}`}>{trip.title}</h4>
                          )}

                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-100 rounded-lg">
                                <Calendar size={12} className="text-slate-400" />
                                {new Date(trip.startDate).toLocaleDateString()}
                              </span>
                              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                                {tripLocations.length} PINS
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); onToggleVisibility(trip.id); }}
                                className={`p-2 rounded-lg transition ${isPublic ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}
                                title={isPublic ? 'Public — click to make private' : 'Private — click to make public'}
                              >
                                {isPublic ? <Globe size={14} /> : <Lock size={14} />}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this adventure and all its memories?')) onDeleteTrip(trip.id); }}
                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                title="Delete Journey"
                              >
                                <Trash2 size={16} />
                              </button>
                              {isActive ? <ChevronDown size={20} className="text-blue-600" /> : <ChevronRight size={20} className="text-slate-300" />}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Section (Flat layout, no nesting issues) */}
                      {isActive && (
                        <div className="border-t border-blue-100 bg-blue-50/30 p-4 rounded-b-2xl">

                          {/* 1. Selected Memory Feature (Large & Centered) */}
                          {selectedLoc && (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                              {/* Header */}
                              <div className="p-3 bg-slate-900 flex items-center justify-between">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Memory Spotlight</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onSelectLocation?.(null); }}
                                  className="p-1 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                                >
                                  <ArrowLeft size={16} />
                                </button>
                              </div>

                              {/* Content */}
                              <div className="p-5 flex flex-col gap-4">
                                <div className="w-full aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-100 shadow-sm mx-auto">
                                  <img src={selectedLoc.photoUrl} alt={selectedLoc.title} className="w-full h-full object-cover" />
                                </div>

                                <div className="space-y-3 text-center">
                                  <div>
                                    <h5 className="font-black text-slate-900 text-xl leading-tight mb-2">{selectedLoc.title}</h5>
                                    <div className="flex items-center justify-center gap-2">
                                      <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-full text-slate-700 font-bold uppercase tracking-wide border border-slate-200">
                                        {LOCATION_TYPES.find(t => t.id === selectedLoc.type)?.label || selectedLoc.type}
                                      </span>
                                      <span className="text-xs font-bold text-slate-400 tracking-tight">
                                        {new Date(selectedLoc.timestamp).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>

                                  <p className="text-base text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100 italic whitespace-normal break-words shadow-inner">
                                    "{selectedLoc.comment}"
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 2. Journey Narrative & List */}
                          <div className="space-y-3">
                            {trip.description && !selectedLoc && (
                              <p className="text-xs text-slate-500 italic leading-relaxed px-4 text-center">
                                "{trip.description}"
                              </p>
                            )}

                            {tripLocations.length === 0 ? (
                              <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
                                <MapPin size={24} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No pins yet</p>
                              </div>
                            ) : (
                              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                                {tripLocations.map((loc, idx) => (
                                  <div
                                    key={loc.id}
                                    onClick={(e) => { e.stopPropagation(); onSelectLocation?.(loc.id); }}
                                    className={`
                                      flex items-center gap-3 p-3 transition-all cursor-pointer border-b last:border-0
                                      ${selectedLocationId === loc.id
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-white text-slate-700 hover:bg-slate-50'}
                                    `}
                                  >
                                    <span className={`text-[10px] font-black w-6 text-center ${selectedLocationId === loc.id ? 'text-slate-500' : 'text-slate-300'}`}>
                                      {idx + 1}
                                    </span>
                                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-slate-100 bg-slate-100">
                                      <img src={loc.photoUrl} alt={loc.title} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-bold text-sm block truncate tracking-tight">{loc.title}</span>
                                      <span className={`text-[9px] font-black uppercase tracking-widest ${selectedLocationId === loc.id ? 'text-slate-500' : 'text-slate-400'}`}>
                                        {(LOCATION_TYPES.find(t => t.id === loc.type)?.label || 'Unknown').split(' ')[0]}
                                      </span>
                                    </div>
                                    {selectedLocationId === loc.id && <ChevronRight size={14} className="text-slate-500" />}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/50">
            <button
              onClick={onLogout}
              className="flex items-center gap-3 text-slate-500 hover:text-red-500 text-sm font-bold w-full px-4 py-3 rounded-xl transition hover:bg-red-50"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </>
      ) : (
        /* Collapsed State Icons */
        <div className="flex flex-col items-center gap-8 pt-8 px-2">
          <button onClick={() => onViewChange('profile')} className="p-3 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-blue-600 relative group transition-all">
            <UserIcon size={24} />
            <span className="absolute left-16 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition shadow-xl z-50">Profile</span>
          </button>
          <button onClick={() => { if (!isOpen) toggleSidebar(); onViewChange('map'); }} className="p-3 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-blue-600 relative group transition-all">
            <MapIcon size={24} />
            <span className="absolute left-16 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition shadow-xl z-50">My Trips</span>
          </button>
          <div className="h-px w-8 bg-slate-100" />
          <button onClick={onCreateTrip} className="p-3 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-slate-800 relative group transition-all">
            <Plus size={24} />
            <span className="absolute left-16 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition shadow-xl z-50">New Trip</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default StatsSidebar;