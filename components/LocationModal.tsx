import React, { useState, useRef } from 'react';
import { NewLocationDraft, MapLocation } from '../types';
import { LOCATION_TYPES } from '../constants';
import { generateFunCaption } from '../services/geminiService';
import { compressImage } from '../services/imageService';
import { Loader2, Camera, Wand2, X } from 'lucide-react';

interface LocationModalProps {
  draft: NewLocationDraft;
  onClose: () => void;
  onSave: (location: Omit<MapLocation, 'id' | 'timestamp' | 'tripId' | 'userId'>) => void;
}

const LocationModal: React.FC<LocationModalProps> = ({ draft, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [type, setType] = useState<MapLocation['type']>('adventure');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setIsCompressing(true);

      try {
        // Compress image immediately to avoid heavy base64 strings
        const compressedBase64 = await compressImage(file);
        setPhotoPreview(compressedBase64);
      } catch (err) {
        console.error("Compression failed", err);
        alert("Could not process image.");
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleAiGenerate = async () => {
    if (!photoFile) return;
    setIsGenerating(true);
    try {
      const caption = await generateFunCaption(photoFile, title);
      setComment(caption);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!title || !photoPreview) return;

    // Create timestamp from selected date
    // Use current time for hours/mins if today, otherwise noon
    const now = new Date();
    const selectedDate = new Date(date);

    if (selectedDate.toDateString() === now.toDateString()) {
      selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    } else {
      selectedDate.setHours(12, 0, 0, 0);
    }

    onSave({
      coords: draft.coords,
      title,
      comment: comment,
      photoUrl: photoPreview,
      type,
      timestamp: selectedDate.getTime()
    } as any); // Type cast needed until we update the prop definition
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">New Memory</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto space-y-4">

          {/* Photo Upload Area */}
          <div
            onClick={() => !isCompressing && fileInputRef.current?.click()}
            className={`
              relative w-full h-48 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden
              ${photoPreview ? 'border-transparent' : 'border-slate-300 hover:border-slate-400 bg-slate-50'}
            `}
          >
            {isCompressing ? (
              <div className="flex flex-col items-center text-slate-500">
                <Loader2 className="animate-spin mb-2" />
                <span className="text-xs">Optimizing photo...</span>
              </div>
            ) : photoPreview ? (
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-slate-500">
                <Camera className="mx-auto mb-2" size={32} />
                <p className="text-sm font-medium">Click to upload photo</p>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Location Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Hidden Waterfall"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Date Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 font-medium"
            />
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {LOCATION_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`
                    flex items-center px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border
                    ${type === t.id
                      ? `${t.color} text-white border-transparent shadow-md transform scale-105`
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}
                  `}
                >
                  <span className="mr-1.5">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comment & AI */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-semibold text-slate-700">Experience</label>
              <button
                onClick={handleAiGenerate}
                disabled={!photoFile || isGenerating || isCompressing}
                className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 font-semibold disabled:opacity-50 transition"
              >
                {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                {isGenerating ? 'Generating...' : 'AI Caption'}
              </button>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={photoFile ? "Press AI Caption for a suggestion..." : "Upload a photo first!"}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none h-24 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title || !photoPreview || isCompressing}
            className="px-6 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
          >
            Pin Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationModal;
