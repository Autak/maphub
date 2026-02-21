import React, { useState, useMemo } from 'react';
import { MapLocation, Trip, User } from '../types';
import { LOCATION_TYPES } from '../constants';
import { MapPin, Navigation, Plus, User as UserIcon, LogOut, Map as MapIcon, Calendar, Trash2, ChevronDown, ChevronRight, Globe, Lock, ArrowLeft, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    <>
      {/* Floating Header / User Chip (Always visible) */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-6 left-6 z-[950] flex gap-4 pointer-events-auto"
      >
        <button
          onClick={toggleSidebar}
          className="w-12 h-12 bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors shadow-2xl"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div
          onClick={() => onViewChange('profile')}
          className="flex items-center gap-3 bg-black/60 backdrop-blur-2xl border border-white/10 p-1.5 pr-5 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors shadow-2xl"
        >
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-white/20 flex items-center justify-center text-white font-bold text-sm">
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.username} className="w-full h-full object-cover" />
            ) : (
              currentUser.username.substring(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <h2 className="font-bold text-white text-sm leading-tight tracking-wide">{currentUser.username}</h2>
            <p className="text-[10px] text-white/50 font-medium uppercase tracking-widest">
              {totalTrips} Trips • {totalPins} Pins
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Overlay Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            className="fixed top-24 left-6 bottom-24 w-[26rem] z-[900] pointer-events-auto flex flex-col"
          >
            <div className="flex-1 bg-black/60 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col text-white">

              <div className="p-6 overflow-y-auto scrollbar-hide flex-1 space-y-6">

                <button
                  onClick={onCreateTrip}
                  className="w-full py-4 bg-white text-black rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all font-bold tracking-tight"
                >
                  <Plus size={18} strokeWidth={2.5} />
                  Start New Journey
                </button>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                    <MapIcon size={12} />
                    My Journeys
                  </h3>

                  <div className="space-y-4">
                    {myTrips.length === 0 && (
                      <div className="text-sm text-white/40 italic text-center py-10 border border-white/10 rounded-2xl bg-white/5">
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
                        <div key={trip.id} className={`flex flex-col rounded-2xl overflow-hidden transition-all duration-500 border ${isActive ? 'bg-white/10 border-white/30' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>

                          {/* Card Header image */}
                          <div
                            onClick={() => onSelectTrip(trip.id)}
                            className="cursor-pointer relative h-32 w-full overflow-hidden"
                          >
                            {coverPhoto ? (
                              <>
                                <img src={coverPhoto} alt={trip.title} className="w-full h-full object-cover transition-transform duration-700 hover:scale-110" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                              </>
                            ) : (
                              <div className="absolute inset-0 bg-white/5" />
                            )}

                            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                              <h4 className="font-bold text-white text-lg truncate tracking-tight text-shadow-md">{trip.title}</h4>
                            </div>

                            <div className="absolute top-3 right-3 flex gap-2">
                              {isActive && (
                                <span className="bg-white text-black px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest shadow-lg">Active</span>
                              )}
                            </div>
                          </div>

                          {/* Detail Bar */}
                          <div className="px-4 py-3 bg-black/40 flex justify-between items-center backdrop-blur-md rounded-b-2xl">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-medium text-white/60 flex items-center gap-1.5">
                                <Calendar size={12} />
                                {new Date(trip.startDate).toLocaleDateString()}
                              </span>
                              <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-md border border-white/20 bg-white/10">
                                {tripLocations.length} PINS
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); onToggleVisibility(trip.id); }}
                                className={`p-1.5 rounded-lg transition ${isPublic ? 'text-emerald-400 bg-emerald-400/10' : 'text-white/40 hover:bg-white/10'}`}
                              >
                                {isPublic ? <Globe size={14} /> : <Lock size={14} />}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this journey?')) onDeleteTrip(trip.id); }}
                                className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Content */}
                          <AnimatePresence>
                            {isActive && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden bg-black/40 border-t border-white/10"
                              >
                                <div className="p-4 space-y-4">

                                  {/* Memory Spotlight */}
                                  {selectedLoc && (
                                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                      <div className="p-2 border-b border-white/10 flex items-center justify-between">
                                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest pl-2">Memory Spotlight</span>
                                        <button onClick={(e) => { e.stopPropagation(); onSelectLocation?.(null); }} className="p-1.5 hover:bg-white/10 text-white/60 rounded-lg">
                                          <ArrowLeft size={14} />
                                        </button>
                                      </div>
                                      <div className="p-3">
                                        <img src={selectedLoc.photoUrl} alt={selectedLoc.title} className="w-full aspect-video object-cover rounded-xl mb-3" />
                                        <div className="text-center">
                                          <h5 className="font-bold text-white text-base mb-1">{selectedLoc.title}</h5>
                                          <p className="text-sm text-white/70 italic p-3 bg-white/5 rounded-xl border border-white/5">
                                            "{selectedLoc.comment}"
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Pin List */}
                                  {!selectedLoc && (
                                    <div className="space-y-2">
                                      {tripLocations.length === 0 ? (
                                        <div className="py-6 text-center border-2 border-dashed border-white/10 rounded-xl">
                                          <MapPin size={20} className="mx-auto text-white/20 mb-2" />
                                          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">No pins yet</p>
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          {tripLocations.map((loc, idx) => (
                                            <div
                                              key={loc.id}
                                              onClick={(e) => { e.stopPropagation(); onSelectLocation?.(loc.id); }}
                                              className={`
                                                flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer border border-transparent
                                                ${selectedLocationId === loc.id ? 'bg-white/10 border-white/10' : 'hover:bg-white/5'}
                                              `}
                                            >
                                              <span className="text-[10px] font-bold text-white/30 w-4 text-center">{idx + 1}</span>
                                              <img src={loc.photoUrl} alt={loc.title} className="w-8 h-8 rounded-lg object-cover" />
                                              <div className="flex-1 min-w-0">
                                                <span className="font-semibold text-sm block truncate text-white">{loc.title}</span>
                                                <span className="text-[9px] text-white/50 uppercase tracking-widest block truncate">
                                                  {(LOCATION_TYPES.find(t => t.id === loc.type)?.label || 'Unknown')}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Bottom Actions */}
              <div className="p-4 border-t border-white/10 bg-white/5">
                <button
                  onClick={onLogout}
                  className="flex items-center justify-center gap-2 text-white/60 hover:text-red-400 text-xs font-bold uppercase tracking-widest w-full px-4 py-3 rounded-xl transition hover:bg-white/5"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StatsSidebar;
