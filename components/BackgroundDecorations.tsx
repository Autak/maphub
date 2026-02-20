import React from 'react';

const BackgroundDecorations: React.FC = () => {
    return (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none bg-slate-100">
            {/* Soft Design Gradients */}
            <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[40%] bg-blue-100/10 rounded-full blur-[140px]" />
            <div className="absolute bottom-[5%] right-[-5%] w-[40%] h-[45%] bg-indigo-50/20 rounded-full blur-[120px]" />

            {/* Minimalist Texture Overlay */}
            <svg
                className="absolute inset-0 w-full h-full opacity-[0.02] text-slate-900"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <pattern id="grid-dots" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="0.5" fill="currentColor" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-dots)" />

                {/* Very subtle structural lines */}
                <line x1="15%" y1="0" x2="15%" y2="100%" stroke="currentColor" strokeWidth="0.5" />
                <line x1="85%" y1="0" x2="85%" y2="100%" stroke="currentColor" strokeWidth="0.5" />
            </svg>
        </div>
    );
};

export default BackgroundDecorations;
