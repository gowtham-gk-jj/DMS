import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Loader2 } from 'lucide-react';

export default function ImageViewer({
  src,
  alt = 'Document Preview',
  zoom = 100,
  rotation = 0,
  isDark = true,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-auto p-2 sm:p-4 select-none">
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-xs text-[#888888]">
          <Loader2 className="w-8 h-8 animate-spin mb-2 text-[#0284c7]" />
          <span>Loading image...</span>
        </div>
      )}

      {error ? (
        <div className="p-6 text-center text-xs text-red-400">
          <p className="font-semibold mb-1">Failed to display image</p>
          <p className="text-[#888888]">The image format or URL could not be rendered.</p>
        </div>
      ) : (
        <div
          className="flex items-center justify-center max-w-full max-h-full transition-transform duration-100 ease-out"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
          }}
        >
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            className={`max-w-full max-h-[80vh] sm:max-h-[85vh] object-contain shadow-2xl transition-opacity duration-200 border border-white/10 ${
              loading ? 'opacity-0' : 'opacity-100'
            }`}
            style={{
              backgroundColor: isDark ? '#141c2b' : '#ffffff',
            }}
          />
        </div>
      )}
    </div>
  );
}
