import React, { useState } from 'react';
import { Map, Compass, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface NavBarProps {
  currentView: 'map' | 'feed' | 'profile' | 'trip-detail';
  setView: (view: 'map' | 'feed' | 'profile') => void;
}

const NavBar: React.FC<NavBarProps> = ({ currentView, setView }) => {
  if (currentView === 'trip-detail') return null;

  const tabs = [
    { id: 'explore', view: 'feed' as const, icon: Compass, label: 'Explore' },
    { id: 'map', view: 'map' as const, icon: Map, label: 'My World' },
    { id: 'profile', view: 'profile' as const, icon: UserIcon, label: 'My Trips' },
  ];

  return (
    <motion.div
      initial={{ y: 50, x: "-50%", opacity: 0 }}
      animate={{ y: 0, x: "-50%", opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-8 left-1/2 z-[1000]"
    >
      <div className="bg-black/60 backdrop-blur-3xl px-2 py-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10 flex items-center gap-1">

        {tabs.map((tab) => {
          const isActive = currentView === tab.view;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.view)}
              className={`relative flex items-center justify-center gap-2 px-6 py-3 rounded-full transition-all duration-300 outline-none ${isActive ? 'bg-white text-black shadow-lg scale-105' : 'bg-transparent text-white/60 hover:text-white hover:bg-white/10'
                }`}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 2}
                className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}
              />
              <span className="relative z-10 text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}

      </div>
    </motion.div>
  );
};

export default NavBar;
