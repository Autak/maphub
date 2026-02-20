import React, { useEffect, useCallback } from 'react';
import { MapLocation } from '../types';
import { X, ChevronLeft, ChevronRight, MapPin, Calendar } from 'lucide-react';

interface PhotoLightboxProps {
    photos: MapLocation[];
    currentIndex: number;
    onClose: () => void;
    onNavigate: (index: number) => void;
}

const PhotoLightbox: React.FC<PhotoLightboxProps> = ({ photos, currentIndex, onClose, onNavigate }) => {
    const current = photos[currentIndex];
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < photos.length - 1;

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowLeft' && hasPrev) onNavigate(currentIndex - 1);
        if (e.key === 'ArrowRight' && hasNext) onNavigate(currentIndex + 1);
    }, [onClose, onNavigate, currentIndex, hasPrev, hasNext]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    if (!current) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col" onClick={onClose}>
            {/* Top bar */}
            <div className="flex justify-between items-center px-6 py-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <div className="text-white/70 text-sm font-medium">
                    {currentIndex + 1} / {photos.length}
                </div>
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                >
                    <X size={20} />
                </button>
            </div>

            {/* Photo area */}
            <div className="flex-1 flex items-center justify-center relative min-h-0 px-16" onClick={(e) => e.stopPropagation()}>
                {/* Previous arrow */}
                {hasPrev && (
                    <button
                        onClick={() => onNavigate(currentIndex - 1)}
                        className="absolute left-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition backdrop-blur-sm"
                    >
                        <ChevronLeft size={28} />
                    </button>
                )}

                {/* Image */}
                <img
                    src={current.photoUrl}
                    alt={current.title}
                    className="max-h-[95vh] max-w-[95vw] object-contain rounded-lg shadow-2xl select-none"
                    draggable={false}
                />

                {/* Next arrow */}
                {hasNext && (
                    <button
                        onClick={() => onNavigate(currentIndex + 1)}
                        className="absolute right-4 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition backdrop-blur-sm"
                    >
                        <ChevronRight size={28} />
                    </button>
                )}
            </div>

            {/* Info bar */}
            <div
                className="flex-shrink-0 bg-gradient-to-t from-black/80 to-transparent px-8 py-6"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-white text-xl font-bold mb-1">{current.title}</h3>
                <p className="text-white/70 text-sm italic mb-2">"{current.comment}"</p>
                <div className="flex items-center gap-4 text-white/50 text-xs">
                    <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {current.coords.lat.toFixed(4)}, {current.coords.lng.toFixed(4)}
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(current.timestamp).toLocaleDateString()}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default PhotoLightbox;
