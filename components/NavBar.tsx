import React from 'react';
import { Map, Compass, User as UserIcon } from 'lucide-react';

interface NavBarProps {
  currentView: 'map' | 'feed' | 'profile' | 'trip-detail';
  setView: (view: 'map' | 'feed' | 'profile') => void;
}

const NavBar: React.FC<NavBarProps> = ({ currentView, setView }) => {
  // Hide nav when viewing trip detail (it has its own back button)
  if (currentView === 'trip-detail') return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl border border-slate-200 flex gap-8">
      <button
        onClick={() => setView('feed')}
        className={`flex flex-col items-center gap-1 transition ${currentView === 'feed' ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}
      >
        <Compass size={24} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Explore</span>
      </button>

      <button
        onClick={() => setView('map')}
        className={`flex flex-col items-center gap-1 transition ${currentView === 'map' ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}
      >
        <Map size={24} />
        <span className="text-[10px] font-bold uppercase tracking-wider">My Map</span>
      </button>

      <button
        onClick={() => setView('profile')}
        className={`flex flex-col items-center gap-1 transition ${currentView === 'profile' ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}
      >
        <UserIcon size={24} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
      </button>
    </div>
  );
};

export default NavBar;
