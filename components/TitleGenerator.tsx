import React, { useState } from 'react';
import { CopyIcon } from './icons/CopyIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { Language } from '../types';

interface TitleGeneratorProps {
  onGenerate: (topic: string, language: Language) => void;
  titles: string[];
  onSelect: (title: string) => void;
  isLoading: boolean;
  initialTopic: string;
  initialLanguage: Language;
}

export const TitleGenerator: React.FC<TitleGeneratorProps> = ({ onGenerate, titles, onSelect, isLoading, initialTopic, initialLanguage }) => {
  const [topic, setTopic] = useState(initialTopic);
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim() && !isLoading) {
      onGenerate(topic, language);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="w-full">
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg mb-8 border border-gray-700">
        <div className="flex justify-between items-center mb-1">
            <h2 className="text-xl font-semibold">Step 1: Generate Titles</h2>
            <div className="flex items-center gap-2">
                <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-sm rounded-md ${language === 'en' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>English</button>
                <button onClick={() => setLanguage('ar')} className={`px-3 py-1 text-sm rounded-md ${language === 'ar' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>العربية</button>
            </div>
        </div>
        <p className="text-gray-400 mb-4">Enter a video topic or a rough idea to get started.</p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., 'How to learn React in 2024'"
            className="flex-grow bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
            disabled={isLoading}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          />
          <button
            type="submit"
            disabled={isLoading || !topic.trim()}
            className="flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3 px-6 rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Generating...
              </>
            ) : (
              <>
                <SparklesIcon className="w-5 h-5" />
                Generate Titles
              </>
            )}
          </button>
        </form>
      </div>

      {titles.length > 0 && (
        <div dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <h3 className="text-lg font-semibold mb-4 text-center">Select a title to create a thumbnail</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {titles.map((title, index) => (
              <div
                key={index}
                className="group bg-gray-800 rounded-lg p-4 flex flex-col justify-between border border-gray-700 cursor-pointer hover:border-red-500 hover:bg-gray-700 transition-all"
                onClick={() => onSelect(title)}
              >
                <p className="text-gray-200 mb-3 flex-grow">{title}</p>
                <div className="flex justify-between items-center text-gray-500">
                  <span className="text-xs">{title.length} chars</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(title, index);
                    }}
                    className="p-1.5 rounded-md hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                    aria-label="Copy title"
                  >
                    {copiedIndex === index ? (
                      <span className="text-xs font-semibold text-green-400">Copied!</span>
                    ) : (
                      <CopyIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
