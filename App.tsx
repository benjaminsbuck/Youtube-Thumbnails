import React, { useState, useCallback } from 'react';
import { TitleGenerator } from './components/TitleGenerator';
import { ThumbnailGenerator } from './components/ThumbnailGenerator';
import { generateTitles } from './services/geminiService';
import { AppState, Language } from './types';
import { LogoIcon } from './components/icons/LogoIcon';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.TITLE_INPUT);
  const [topic, setTopic] = useState<string>('');
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [error, setError] = useState<string | null>(null);

  const handleGenerateTitles = useCallback(async (newTopic: string, lang: Language) => {
    setTopic(newTopic);
    setLanguage(lang);
    setAppState(AppState.GENERATING_TITLES);
    setError(null);
    try {
      const titles = await generateTitles(newTopic, lang);
      setGeneratedTitles(titles);
      setAppState(AppState.TITLES_DISPLAYED);
    } catch (err) {
      setError('Failed to generate titles. Please try again.');
      setAppState(AppState.TITLE_INPUT);
      console.error(err);
    }
  }, []);

  const handleTitleSelect = useCallback((title: string) => {
    setSelectedTitle(title);
    setAppState(AppState.THUMBNAIL_INPUT);
  }, []);
  
  const handleStartOver = useCallback(() => {
    setAppState(AppState.TITLE_INPUT);
    setTopic('');
    setGeneratedTitles([]);
    setSelectedTitle(null);
    setError(null);
  }, []);
  
  const renderContent = () => {
    switch (appState) {
      case AppState.TITLE_INPUT:
      case AppState.GENERATING_TITLES:
      case AppState.TITLES_DISPLAYED:
        return (
          <TitleGenerator
            onGenerate={handleGenerateTitles}
            titles={generatedTitles}
            onSelect={handleTitleSelect}
            isLoading={appState === AppState.GENERATING_TITLES}
            initialTopic={topic}
            initialLanguage={language}
          />
        );
      case AppState.THUMBNAIL_INPUT:
        if (!selectedTitle) {
          handleStartOver();
          return null;
        }
        return (
          <ThumbnailGenerator
            title={selectedTitle}
            language={language}
            onBack={() => setAppState(AppState.TITLES_DISPLAYED)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <LogoIcon className="h-10 w-10 text-red-500" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-red-500 to-red-400 text-transparent bg-clip-text">
              YouTube Content Optimizer
            </h1>
          </div>
          {appState !== AppState.TITLE_INPUT && (
             <button
                onClick={handleStartOver}
                className="px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Start Over
              </button>
          )}
        </header>
        <main>
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
