import React from 'react';
import { Language } from '../types';

interface YouTubePreviewProps {
  title: string;
  thumbnailUrl: string;
  language: Language;
}

export const YouTubePreview: React.FC<YouTubePreviewProps> = ({ title, thumbnailUrl, language }) => {
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden p-2 border border-gray-700 max-w-sm mx-auto">
      <div className="flex gap-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div className="w-40 flex-shrink-0">
          <div className="aspect-video bg-gray-700 rounded-md overflow-hidden">
            <img src={thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="flex-grow">
          <h3 className="text-sm font-semibold text-gray-100 leading-tight line-clamp-2">{title}</h3>
          <div className="text-xs text-gray-400 mt-1">
            <p>Your Channel</p>
            <p>1.2M views &bull; 1 day ago</p>
          </div>
        </div>
      </div>
    </div>
  );
};
