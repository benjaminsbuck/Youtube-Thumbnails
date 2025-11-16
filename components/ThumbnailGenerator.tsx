import React, { useState, useCallback, ChangeEvent, useEffect } from 'react';
import { fileToBase64 } from '../utils/fileUtils';
import { YouTubePreview } from './YouTubePreview';
import { generateThumbnail, analyzeStyleReferences, editThumbnail, getImprovementSuggestions } from '../services/geminiService';
import { Language, UploadedImage } from '../types';

import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ImageIcon } from './icons/ImageIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { WandIcon } from './icons/WandIcon';
import { UndoIcon } from './icons/UndoIcon';
import { RedoIcon } from './icons/RedoIcon';
import { UsersIcon } from './icons/UsersIcon';

interface ThumbnailGeneratorProps {
  title: string;
  language: Language;
  onBack: () => void;
}

enum LoadingState {
  NONE,
  ANALYZING,
  GENERATING,
  EDITING,
  SUGGESTING
}

const loadingMessages = {
  [LoadingState.ANALYZING]: "Analyzing design aesthetics...",
  [LoadingState.GENERATING]: "Crafting your new thumbnail...",
  [LoadingState.EDITING]: "Applying your creative edits...",
  [LoadingState.SUGGESTING]: "Getting improvement ideas...",
};

type LayoutPreset = "Default" | "Versus/Comparison" | "Collaboration" | "Explainer";

interface ImageUploadSlotProps {
  label: string;
  image: UploadedImage | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  id: string;
}

export const ThumbnailGenerator: React.FC<ThumbnailGeneratorProps> = ({ title, language, onBack }) => {
  const [numSubjects, setNumSubjects] = useState(1);
  const [mainSubject1, setMainSubject1] = useState<UploadedImage | null>(null);
  const [mainSubject2, setMainSubject2] = useState<UploadedImage | null>(null);
  const [backgroundImages, setBackgroundImages] = useState<UploadedImage[]>([]);
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>("Default");

  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [referencePreviews, setReferencePreviews] = useState<string[]>([]);
  const [analyzedStyle, setAnalyzedStyle] = useState<string | null>(null);
  const [styleStrength, setStyleStrength] = useState(80);

  const [thumbnailHistory, setThumbnailHistory] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const currentThumbnail = thumbnailHistory[currentIndex] || null;

  const [editInstruction, setEditInstruction] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const [loading, setLoading] = useState<LoadingState>(LoadingState.NONE);
  const [error, setError] = useState<string | null>(null);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < thumbnailHistory.length - 1;

  useEffect(() => {
    if (currentThumbnail && suggestions.length === 0 && loading === LoadingState.NONE) {
      handleGetSuggestions();
    }
  }, [currentThumbnail]);

  const updateHistory = (newThumbnail: string) => {
    const newHistory = thumbnailHistory.slice(0, currentIndex + 1);
    newHistory.push(newThumbnail);
    setThumbnailHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  const handleUndo = () => canUndo && setCurrentIndex(currentIndex - 1);
  const handleRedo = () => canRedo && setCurrentIndex(currentIndex + 1);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>, type: 'main1' | 'main2' | 'background' | 'reference') => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (type === 'reference') {
        const newFiles = [...referenceFiles, ...files].slice(0, 3);
        setReferenceFiles(newFiles);
        const previews = await Promise.all(newFiles.map(file => fileToBase64(file)));
        setReferencePreviews(previews);
        setAnalyzedStyle(null);
    } else if (type === 'background') {
        const newImages: UploadedImage[] = await Promise.all(
            files
                .filter((file): file is File => file instanceof File)
                .map(async file => ({ file, preview: await fileToBase64(file) }))
        );
        setBackgroundImages(prev => [...prev, ...newImages].slice(0, 5));
    } else {
      const file = files[0];
      if (file instanceof File) {
        if (file.size > 4 * 1024 * 1024) {
          setError("Image file is too large. Max 4MB.");
          return;
        }
        setError(null);
        const newImage = { file, preview: await fileToBase64(file) };
        if (type === 'main1') setMainSubject1(newImage);
        if (type === 'main2') setMainSubject2(newImage);
      }
    }
  };
  
  const handleRemoveReference = (indexToRemove: number) => {
    const newFiles = referenceFiles.filter((_, index) => index !== indexToRemove);
    const newPreviews = referencePreviews.filter((_, index) => index !== indexToRemove);

    setReferenceFiles(newFiles);
    setReferencePreviews(newPreviews);
    
    if (analyzedStyle) {
        setAnalyzedStyle(null);
    }
  };

  const handleRemoveBackgroundImage = (indexToRemove: number) => {
    setBackgroundImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };


  const handleAnalyzeStyle = async () => {
    if (referencePreviews.length === 0) return;
    setLoading(LoadingState.ANALYZING);
    setError(null);
    try {
      const style = await analyzeStyleReferences(referencePreviews);
      setAnalyzedStyle(style);
    } catch (err) {
      setError("Failed to analyze style references.");
      console.error(err);
    } finally {
      setLoading(LoadingState.NONE);
    }
  };

  const handleGenerateClick = async () => {
    if (!mainSubject1 || (numSubjects === 2 && !mainSubject2)) {
      setError("Please upload all main subject photos.");
      return;
    }
    setLoading(LoadingState.GENERATING);
    setError(null);
    setSuggestions([]);

    try {
      let styleToUse = analyzedStyle;
      if (referencePreviews.length > 0 && !analyzedStyle) {
          styleToUse = await analyzeStyleReferences(referencePreviews);
          setAnalyzedStyle(styleToUse);
      }
      
      const backgroundPreviews = backgroundImages.map(img => img.preview);
      const mainSubject1B64 = mainSubject1 ? mainSubject1.preview : null;
      const mainSubject2B64 = mainSubject2 ? mainSubject2.preview : null;
      
      const newThumbnail = await generateThumbnail(
        title, 
        language, 
        numSubjects, 
        mainSubject1B64, 
        mainSubject2B64, 
        backgroundPreviews, 
        layoutPreset, 
        styleToUse, 
        styleStrength
      );
      updateHistory(newThumbnail);
    } catch (err) {
      setError("Failed to generate thumbnail.");
      console.error(err);
    } finally {
      setLoading(LoadingState.NONE);
    }
  };

  const handleApplyEdit = async (instruction: string) => {
    if (!currentThumbnail || !instruction.trim()) return;
    setLoading(LoadingState.EDITING);
    setError(null);
    try {
      const newThumbnail = await editThumbnail(currentThumbnail, instruction, language);
      updateHistory(newThumbnail);
      setEditInstruction('');
    } catch (err) {
      setError("Failed to apply the edit.");
      console.error(err);
    } finally {
      setLoading(LoadingState.NONE);
    }
  };

  const handleGetSuggestions = async () => {
    setLoading(LoadingState.SUGGESTING);
    try {
        const newSuggestions = await getImprovementSuggestions(title, language);
        setSuggestions(newSuggestions);
    } catch (err) {
        console.error("Failed to get suggestions", err);
    } finally {
        setLoading(LoadingState.NONE);
    }
  };

  const handleDownload = () => {
    if (!currentThumbnail) return;
    const link = document.createElement('a');
    link.href = currentThumbnail;
    link.download = `yt_thumbnail_${title.replace(/\s+/g, '_').toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const ImageUploadSlot: React.FC<ImageUploadSlotProps> = ({ label, image, onChange, id }) => (
    <div className="flex items-center gap-4 p-4 border-2 border-gray-600 border-dashed rounded-md">
      {image ? <img src={image.preview} alt={`${label} preview`} className="h-20 w-20 object-cover rounded-md" /> : <ImageIcon className="h-12 w-12 text-gray-500" />}
      <div className="text-sm">
        <label htmlFor={id} className="cursor-pointer font-medium text-red-400 hover:text-red-500">
          <span>{image ? `Change ${label}` : `Upload ${label}`}</span>
          <input id={id} type="file" className="sr-only" onChange={onChange} accept="image/png, image/jpeg" />
        </label>
        <p className="text-gray-500">PNG or JPG, up to 4MB</p>
      </div>
    </div>
  );

  return (
    <div className="w-full">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Titles
        </button>

        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-1">Step 2: Create a Thumbnail</h2>
            <p className="text-gray-400 mb-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>Your selected title: <strong className="text-gray-200">"{title}"</strong></p>
            {error && <p className="text-sm text-red-400 my-4 p-3 bg-red-900/50 rounded-md border border-red-700">{error}</p>}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Inputs */}
                <div className="space-y-6">
                    {/* Main Subjects */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">1. Main Subjects</label>
                        <div className="flex gap-2 mb-2">
                          {[1, 2].map(n => 
                            <button key={n} onClick={() => setNumSubjects(n)} className={`px-4 py-2 text-sm rounded-md flex items-center gap-2 ${numSubjects === n ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                              <UsersIcon className="w-4 h-4" /> {n} Face{n>1 && 's'}
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <ImageUploadSlot id="main1-upload" label="Subject 1" image={mainSubject1} onChange={e => handleFileChange(e, 'main1')} />
                          {numSubjects === 2 && <ImageUploadSlot id="main2-upload" label="Subject 2" image={mainSubject2} onChange={e => handleFileChange(e, 'main2')} />}
                        </div>
                    </div>
                    {/* Layout Presets */}
                    {numSubjects > 1 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Layout Preset</label>
                        <div className="flex gap-2 flex-wrap">
                          {(["Default", "Versus/Comparison", "Collaboration"] as LayoutPreset[]).map(p => (
                            <button key={p} onClick={() => setLayoutPreset(p)} className={`px-3 py-1 text-xs rounded-md ${layoutPreset === p ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}>{p}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Background Images */}
                     <details className="bg-gray-700/50 rounded-lg border border-gray-600">
                        <summary className="p-3 cursor-pointer text-sm font-medium text-gray-300">2. Background & Context Images (Optional)</summary>
                        <div className="p-4 border-t border-gray-600">
                            <div className="flex items-center gap-4 flex-wrap">
                                {backgroundImages.map((p, i) => (
                                    <div key={i} className="relative group">
                                        <img src={p.preview} className="h-16 w-16 object-cover rounded-md" alt={`Background ${i+1}`} />
                                        <button
                                            onClick={() => handleRemoveBackgroundImage(i)}
                                            className="absolute top-0 right-0 -mt-1.5 -mr-1.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none"
                                            aria-label="Remove background image"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                {backgroundImages.length < 5 && (
                                    <label htmlFor="bg-upload" className="flex flex-col items-center justify-center h-16 w-16 border-2 border-gray-500 border-dashed rounded-md cursor-pointer hover:border-red-500">
                                    <span className="text-2xl text-gray-500">+</span>
                                    <input id="bg-upload" type="file" multiple className="sr-only" onChange={(e) => handleFileChange(e, 'background')} accept="image/png, image/jpeg" />
                                    </label>
                                )}
                            </div>
                           <p className="text-xs text-gray-500 mt-2">Upload up to 5 context images (e.g., screenshots, products).</p>
                        </div>
                    </details>
                    {/* Style Reference */}
                     <details className="bg-gray-700/50 rounded-lg border border-gray-600">
                        <summary className="p-3 cursor-pointer text-sm font-medium text-gray-300">3. Upload Style References (Optional)</summary>
                         <div className="p-4 border-t border-gray-600">
                            <div className="flex items-center gap-4 flex-wrap">
                                {referencePreviews.map((p, i) => (
                                    <div key={i} className="relative group">
                                        <img src={p} className="h-16 w-16 object-cover rounded-md" alt={`Reference ${i+1}`} />
                                        <button
                                            onClick={() => handleRemoveReference(i)}
                                            className="absolute top-0 right-0 -mt-1.5 -mr-1.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none"
                                            aria-label="Remove reference image"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                {referencePreviews.length < 3 && (
                                    <label htmlFor="ref-upload" className="flex flex-col items-center justify-center h-16 w-16 border-2 border-gray-500 border-dashed rounded-md cursor-pointer hover:border-red-500">
                                    <span className="text-2xl text-gray-500">+</span>
                                    <input id="ref-upload" type="file" multiple className="sr-only" onChange={(e) => handleFileChange(e, 'reference')} accept="image/png, image/jpeg" />
                                    </label>
                                )}
                            </div>
                           <p className="text-xs text-gray-500 mt-2">Upload up to 3 thumbnails you like.</p>
                           {referenceFiles.length > 0 && (
                             <div className="mt-3">
                                <button onClick={handleAnalyzeStyle} disabled={loading === LoadingState.ANALYZING} className="text-sm flex items-center gap-2 text-red-400 disabled:text-gray-500 hover:text-red-500 transition">
                                  <WandIcon className="w-4 h-4" /> {loading === LoadingState.ANALYZING ? "Analyzing..." : "Analyze Style"}
                                </button>
                                {analyzedStyle && <p className="text-xs mt-2 p-2 bg-gray-900 rounded-md text-gray-300 whitespace-pre-wrap">{analyzedStyle}</p>}
                             </div>
                           )}
                           {analyzedStyle && (
                                <div className="mt-4">
                                     <label htmlFor="strength" className="block text-sm font-medium text-gray-300">Style Strength: {styleStrength}%</label>
                                     <input id="strength" type="range" min="10" max="100" value={styleStrength} onChange={e => setStyleStrength(parseInt(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-red-500" />
                                </div>
                            )}
                         </div>
                    </details>
                    
                    {/* Generate Button */}
                    <button onClick={handleGenerateClick} disabled={!mainSubject1 || loading === LoadingState.GENERATING || loading === LoadingState.EDITING} className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-bold py-3 px-6 rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                        {loading === LoadingState.GENERATING ? "Generating..." : (currentThumbnail ? "Regenerate Thumbnail" : "Generate Thumbnail")}
                    </button>
                </div>
                
                {/* Right Column: Results & Editing */}
                <div>
                     <h3 className="text-lg font-semibold text-gray-300 mb-2">4. Result & Fine-tuning</h3>
                     <div className="aspect-video bg-gray-700 rounded-lg flex items-center justify-center border border-gray-600 relative overflow-hidden">
                         {loading === LoadingState.GENERATING || loading === LoadingState.EDITING ? (
                             <div className="text-center p-4">
                               <div className="w-8 h-8 mx-auto border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                               <p className="mt-3 text-sm text-gray-400">{loadingMessages[loading]}</p>
                             </div>
                         ) : !currentThumbnail ? (
                             <p className="text-gray-500 text-sm">Your thumbnail will appear here</p>
                         ) : (
                           <img src={currentThumbnail} alt="Generated thumbnail" className="w-full h-full object-contain" />
                         )}
                         {currentThumbnail && (
                           <div className="absolute top-2 right-2 flex gap-2">
                            <button onClick={handleUndo} disabled={!canUndo} className="p-2 bg-gray-800/80 rounded-full text-white disabled:text-gray-500 hover:bg-gray-700"><UndoIcon className="w-5 h-5" /></button>
                            <button onClick={handleRedo} disabled={!canRedo} className="p-2 bg-gray-800/80 rounded-full text-white disabled:text-gray-500 hover:bg-gray-700"><RedoIcon className="w-5 h-5" /></button>
                           </div>
                         )}
                     </div>

                     {currentThumbnail && (
                       <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-300 mb-2">Edit with words:</label>
                          <div className="flex gap-2" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                             <input type="text" value={editInstruction} onChange={e => setEditInstruction(e.target.value)} placeholder="e.g., 'make the text yellow'" className="flex-grow bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-red-500 transition" />
                             <button onClick={() => handleApplyEdit(editInstruction)} disabled={!editInstruction.trim() || loading === LoadingState.EDITING} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:bg-gray-600">Apply</button>
                          </div>
                          <div className="flex gap-2 flex-wrap mt-2" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                            {suggestions.map(s => <button key={s} onClick={() => handleApplyEdit(s)} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-md hover:bg-gray-600">{s}</button>)}
                          </div>

                           <div className="mt-4 flex gap-2">
                              <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-md hover:bg-green-700"><DownloadIcon className="w-5 h-5" /> Download (PNG)</button>
                           </div>
                       </div>
                     )}

                      <div className="mt-6">
                       <h4 className="text-sm font-medium text-gray-400 mb-2">YouTube Search Preview:</h4>
                       <YouTubePreview title={title} language={language} thumbnailUrl={currentThumbnail || 'https://placehold.co/1280x720/1f2937/4b5563?text=Preview'} />
                     </div>
                </div>
            </div>
        </div>
    </div>
  );
};