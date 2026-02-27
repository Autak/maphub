import React, { useState, useRef } from 'react';
import { X, Calendar, Map, Globe, Lock, Tag, Camera, Loader2, Mountain, FileUp, Trash2 } from 'lucide-react';
import { TRIP_TAGS, DIFFICULTY_LEVELS } from '../constants';
import { compressImage } from '../services/imageService';
import { parseGPX } from '../utils/gpxParser';

interface TripModalProps {
  onClose: () => void;
  onSave: (data: {
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
  }) => void;
}

const TripModal: React.FC<TripModalProps> = ({ onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'friends'>('public');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<'easy' | 'moderate' | 'hard' | 'expert' | undefined>(undefined);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [gpxPoints, setGpxPoints] = useState<{ lat: number; lng: number; ele?: number }[] | null>(null);
  const [gpxStats, setGpxStats] = useState<{ distanceKm: number; estimatedDays: number } | null>(null);
  const [gpxFileName, setGpxFileName] = useState<string | null>(null);

  const [externalLinks, setExternalLinks] = useState<{ label: string; url: string }[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const [isCompressing, setIsCompressing] = useState(false);
  const [parsingGPX, setParsingGPX] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const gpxInputRef = useRef<HTMLInputElement>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleCoverPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsCompressing(true);
      try {
        const compressed = await compressImage(e.target.files[0], 800, 0.7);
        setCoverPreview(compressed);
      } catch (err) {
        console.error("Cover photo compression failed", err);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleGPXFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setParsingGPX(true);
      try {
        const file = e.target.files[0];
        const text = await file.text();
        const result = parseGPX(text);
        if (result.points.length > 0) {
          setGpxPoints(result.points);
          setGpxStats({ distanceKm: result.distanceKm, estimatedDays: result.estimatedDays });
          setGpxFileName(file.name);

          // Auto-calculate end date based on estimated days if start date is set
          if (date && result.estimatedDays > 1) {
            const start = new Date(date);
            const end = new Date(start);
            end.setDate(start.getDate() + result.estimatedDays - 1);
            setEndDate(end.toISOString().split('T')[0]);
          }
        } else {
          alert('No track points found in GPX file.');
        }
      } catch (err) {
        console.error("GPX parsing failed", err);
        alert('Failed to parse GPX file.');
      } finally {
        setParsingGPX(false);
      }
    }
  };

  const addExternalLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    setExternalLinks([...externalLinks, { label: newLinkLabel.trim(), url }]);
    setNewLinkLabel('');
    setNewLinkUrl('');
  };

  const removeLink = (index: number) => {
    setExternalLinks(externalLinks.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    onSave({
      title,
      description,
      date,
      endDate: endDate || undefined,
      location: location.trim() || undefined,
      visibility,
      difficulty,
      tags: selectedTags,
      coverPhotoUrl: coverPreview || undefined,
      gpxData: gpxPoints || undefined,
      gpxStats: gpxStats || undefined,
      externalLinks: externalLinks.length > 0 ? externalLinks : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-page-in max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Map size={20} className="text-blue-600" />
            Plan a New Journey
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition" type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Cover Photo */}
          <div
            onClick={() => !isCompressing && fileInputRef.current?.click()}
            className={`relative w-full h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition overflow-hidden ${coverPreview ? 'border-transparent' : 'border-slate-300 hover:border-blue-400 bg-slate-50'
              }`}
          >
            {isCompressing ? (
              <div className="flex flex-col items-center text-slate-400">
                <Loader2 className="animate-spin mb-1" size={24} />
                <span className="text-xs">Processing...</span>
              </div>
            ) : coverPreview ? (
              <>
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                  <span className="text-white text-sm font-bold">Change Cover</span>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-400">
                <Camera className="mx-auto mb-1" size={28} />
                <p className="text-xs font-medium">Add Cover Photo (Optional)</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleCoverPhoto} />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Journey Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Tenerife Round Hike"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Location / Country</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Gran Canaria, Spain"
                className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 text-sm"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 text-sm"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-1">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Visibility Toggle */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Visibility</label>
            <div className="flex gap-2">
              {([
                { value: 'public' as const, label: 'Public', icon: <Globe size={14} />, desc: 'Anyone can see' },
                { value: 'private' as const, label: 'Private', icon: <Lock size={14} />, desc: 'Only you' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className={`flex-1 p-3 rounded-lg border-2 transition text-left ${visibility === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                    }`}
                >
                  <div className={`flex items-center gap-1.5 font-bold text-sm ${visibility === opt.value ? 'text-blue-600' : 'text-slate-600'}`}>
                    {opt.icon} {opt.label}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Mountain size={14} /> Difficulty
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {DIFFICULTY_LEVELS.map(lvl => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setDifficulty(difficulty === lvl.id ? undefined : lvl.id as any)}
                  className={`p-2 rounded-lg border-2 transition text-center ${difficulty === lvl.id
                    ? `border-current ${lvl.textColor} bg-opacity-10`
                    : 'border-slate-200 hover:border-slate-300'
                    }`}
                >
                  <span className="text-lg">{lvl.icon}</span>
                  <div className={`text-[10px] font-bold mt-0.5 ${difficulty === lvl.id ? lvl.textColor : 'text-slate-500'}`}>{lvl.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Tag size={14} /> Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TRIP_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition border ${selectedTags.includes(tag)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                    }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>



          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief summary of what this trip is about..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none h-20 resize-none text-sm"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
            >
              Cancel
            </button>
            <button type="submit" disabled={!title}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
            >
              Start Adventure
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TripModal;
