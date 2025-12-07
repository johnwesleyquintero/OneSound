import React, { useState, useRef, useEffect } from 'react';
import { Upload, Sliders, CheckCircle2, Play, Download, RefreshCw, Loader2, Ear, Rewind, RotateCcw, BrainCircuit, Activity } from 'lucide-react';
import { REMASTER_STYLES } from '../constants';
import { useToast } from '../context/ToastContext';
import { processAudio, AudioFilterConfig, getAudioSnippet } from '../utils/audioHelpers';
import { analyzeAudioTrack, AudioAnalysis } from '../services/geminiService';

export const RemasterTrack: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  
  // New state for vibe preservation
  const [intensity, setIntensity] = useState<number>(0.8);
  
  const [progress, setProgress] = useState(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<'remastered' | 'original'>('remastered');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { addToast } = useToast();

  // Cleanup URLs on unmount or file change
  useEffect(() => {
    return () => {
        if (originalUrl) URL.revokeObjectURL(originalUrl);
        if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 50 * 1024 * 1024) {
        addToast("File size too large. Max 50MB.", 'error');
        return;
      }
      setFile(selectedFile);
      setOriginalUrl(URL.createObjectURL(selectedFile));
      setResultBlob(null);
      setResultUrl(null);
      setProgress(0);
      setAnalysis(null);
      setCompareMode('remastered');
      
      // Auto-Analyze on upload
      await runAnalysis(selectedFile);
    }
  };

  const runAnalysis = async (audioFile: File) => {
    setAnalyzing(true);
    addToast("WesAI is listening to your track...", 'info');
    try {
        const snippetBase64 = await getAudioSnippet(audioFile);
        const result = await analyzeAudioTrack(snippetBase64);
        setAnalysis(result);
        setSelectedStyle(result.suggestedPreset);
        addToast(`Detected ${result.genre}. Suggested: ${result.suggestedPreset}`, 'success');
    } catch (e) {
        console.error("Analysis failed", e);
        addToast("Analysis failed, please select style manually.", 'error');
    } finally {
        setAnalyzing(false);
    }
  };

  const getFilterConfig = (style: string): AudioFilterConfig => {
    const baseConfig = (() => {
        switch (style) {
            case "Modern Clarity (AI Clean)": return { lowGain: -2, midGain: 2, highGain: 6 };
            case "Vintage Tape Saturation": return { lowGain: 3, midGain: -2, highGain: -5 };
            case "Warm Tube Amp": return { lowGain: 5, midGain: 3, highGain: -2 };
            case "Bass Boosted & Punchy": return { lowGain: 12, midGain: -1, highGain: 2 };
            case "Vocal Isolation": return { lowGain: -20, midGain: 10, highGain: -5 };
            default: return { lowGain: 0, midGain: 0, highGain: 0 };
        }
    })();
    
    // Mix preserves original vibe by blending dry signal
    return { ...baseConfig, mix: intensity };
  };

  const handleRemaster = async (style: string) => {
    if (!file) return;
    setProcessing(true);
    setProgress(10);
    setSelectedStyle(style);
    addToast(`Applying "${style}" filters...`, 'loading');
    
    try {
        const config = getFilterConfig(style);
        
        // Use a short timeout to allow UI to render the loading state before the heavy thread work
        setTimeout(async () => {
            try {
                const processedBlob = await processAudio(file, config, (p) => setProgress(p));
                const url = URL.createObjectURL(processedBlob);
                
                setResultBlob(processedBlob);
                setResultUrl(url);
                setProcessing(false);
                setCompareMode('remastered');
                addToast("Remaster complete! Audio engine has rendered the file.", 'success');
            } catch (err) {
                console.error(err);
                setProcessing(false);
                addToast("Error processing audio. File might be corrupted.", 'error');
            }
        }, 500);

    } catch (e) {
        setProcessing(false);
        addToast("Critical Engine Failure", 'error');
    }
  };

  const handleDownload = () => {
      if (resultUrl && file) {
          const a = document.createElement('a');
          a.href = resultUrl;
          a.download = `remastered_${file.name.replace(/\.[^/.]+$/, "")}.wav`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
      }
  };

  const toggleCompare = () => {
      if (!audioRef.current || !originalUrl || !resultUrl) return;
      
      const currentTime = audioRef.current.currentTime;
      const isPaused = audioRef.current.paused;
      
      const newMode = compareMode === 'remastered' ? 'original' : 'remastered';
      setCompareMode(newMode);
      
      // Swap source
      audioRef.current.src = newMode === 'remastered' ? resultUrl : originalUrl;
      audioRef.current.currentTime = currentTime;
      
      if (!isPaused) {
          audioRef.current.play();
      }
  };

  const handleReset = () => {
      setFile(null);
      setResultUrl(null);
      setOriginalUrl(null);
      setAnalysis(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 h-full flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-2">Track Remastering</h2>
        <p className="text-gray-400">Preserve original vibe while improving clarity using Neural DSP.</p>
      </div>

      <div className="w-full max-w-2xl bg-wes-800/30 border border-dashed border-wes-600 rounded-3xl p-12 text-center transition-all hover:bg-wes-800/50 hover:border-wes-purple group relative overflow-hidden">
        
        {!file ? (
          <>
            <div className="w-20 h-20 bg-wes-700/50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Upload className="w-10 h-10 text-gray-400 group-hover:text-wes-purple" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Drop your old audio here</h3>
            <p className="text-gray-500 mb-6">Supports MP3, WAV, FLAC (Max 50MB)</p>
            <label className="bg-white text-black px-6 py-3 rounded-full font-bold cursor-pointer hover:bg-gray-200 transition">
              Browse Files
              <input type="file" className="hidden" accept="audio/*" onChange={handleFileChange} />
            </label>
          </>
        ) : !resultUrl ? (
          <div className="space-y-8 animate-in fade-in zoom-in duration-300">
             {/* Header */}
             <div className="flex items-center justify-center space-x-4">
                <div className="w-12 h-12 bg-wes-purple/20 rounded-lg flex items-center justify-center">
                    <Activity className="w-6 h-6 text-wes-purple" />
                </div>
                <div className="text-left">
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button 
                    onClick={handleReset} 
                    className="p-2 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-full transition"
                >
                    <RefreshCw size={16} />
                </button>
             </div>

             {/* AI Analysis Result */}
             {analyzing ? (
                <div className="p-6 bg-wes-900/50 rounded-xl border border-wes-700/50 flex flex-col items-center animate-pulse">
                     <BrainCircuit className="w-8 h-8 text-wes-purple animate-pulse mb-3" />
                     <p className="text-sm text-gray-300">Analyzing audio fingerprint...</p>
                </div>
             ) : analysis && (
                <div className="bg-gradient-to-r from-wes-800 to-indigo-900/40 p-5 rounded-xl border border-wes-600 text-left relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Activity size={100} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center space-x-2 mb-3">
                            <BrainCircuit className="w-5 h-5 text-wes-purple" />
                            <span className="text-xs font-bold uppercase tracking-wider text-white">WesAI Analysis</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase">Genre</p>
                                <p className="text-white font-medium">{analysis.genre}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase">Est. BPM</p>
                                <p className="text-white font-medium">{analysis.bpm}</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-300 italic mb-4">"{analysis.reasoning}"</p>
                        <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                             <span className="text-xs text-gray-400 ml-2">Recommended:</span>
                             <span className="text-xs font-bold text-wes-purple px-2">{analysis.suggestedPreset}</span>
                        </div>
                    </div>
                </div>
             )}

             {!processing && !analyzing && (
                 <> 
                    {/* Intensity Slider for Vibe Preservation */}
                    <div className="bg-wes-900/50 p-4 rounded-xl border border-wes-700">
                        <div className="flex justify-between items-center mb-2">
                             <label className="text-xs text-gray-400 uppercase font-bold">Effect Intensity</label>
                             <span className="text-xs font-mono text-wes-purple">{Math.round(intensity * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.1" 
                            value={intensity}
                            onChange={(e) => setIntensity(parseFloat(e.target.value))}
                            className="w-full h-2 bg-wes-700 rounded-lg appearance-none cursor-pointer accent-wes-purple"
                        />
                        <p className="text-[10px] text-gray-500 mt-2 text-center">Lower intensity preserves more of the original recording's character.</p>
                    </div>

                    <p className="text-sm text-gray-400 uppercase tracking-widest font-bold">Processing Chain</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                        {REMASTER_STYLES.map((style) => {
                            const isRecommended = analysis?.suggestedPreset === style;
                            return (
                                <button 
                                    key={style} 
                                    onClick={() => handleRemaster(style)}
                                    className={`p-4 rounded-xl border transition flex items-center justify-between group relative overflow-hidden ${
                                        selectedStyle === style 
                                        ? 'border-wes-purple bg-wes-purple/10' 
                                        : 'border-wes-700 hover:border-gray-500 hover:bg-wes-700/30'
                                    }`}
                                >
                                    {isRecommended && (
                                        <div className="absolute top-0 right-0 bg-wes-purple text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                                            AI PICK
                                        </div>
                                    )}
                                    <span className={`text-sm font-medium ${selectedStyle === style ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>{style}</span>
                                    <div className={`w-4 h-4 rounded-full border ${selectedStyle === style ? 'border-wes-purple bg-wes-purple' : 'border-gray-500 group-hover:border-white'}`}></div>
                                </button>
                            );
                        })}
                    </div>
                 </>
             )}

             {processing && (
                 <div className="py-12">
                     <Loader2 className="w-12 h-12 text-wes-purple animate-spin mx-auto mb-4" />
                     <p className="text-white font-mono animate-pulse">RENDERING AUDIO...</p>
                     <div className="w-full max-w-sm mx-auto bg-wes-900 rounded-full h-2 mt-4 overflow-hidden">
                        <div className="h-full bg-wes-purple transition-all duration-300" style={{width: `${progress}%`}}></div>
                     </div>
                 </div>
             )}
          </div>
        ) : (
            <div className="text-center animate-in fade-in zoom-in duration-300 space-y-8">
                <div className="flex items-center justify-between px-4">
                    <div className="flex items-center space-x-3">
                         <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                             <h3 className="text-lg font-bold text-white">Complete</h3>
                             <p className="text-xs text-gray-400">Mastered with {selectedStyle}</p>
                        </div>
                    </div>
                     <button 
                        onClick={handleReset} 
                        className="text-xs text-red-400 hover:underline flex items-center"
                     >
                        <RotateCcw className="w-3 h-3 mr-1" /> New Project
                     </button>
                </div>

                <div className="bg-wes-900/80 p-6 rounded-2xl border border-wes-700 backdrop-blur-sm relative">
                    <div className="absolute top-4 right-4 z-10">
                        <button
                            onClick={toggleCompare}
                            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-lg ${
                                compareMode === 'original' 
                                ? 'bg-gray-700 text-gray-300 border border-gray-500' 
                                : 'bg-wes-purple text-white border border-wes-400 shadow-purple-900/50'
                            }`}
                        >
                            <Ear className="w-3 h-3" />
                            <span>{compareMode === 'original' ? 'Hearing Original' : 'Hearing Remaster'}</span>
                        </button>
                    </div>

                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-mono text-left pl-2">
                        {compareMode === 'original' ? 'SOURCE AUDIO' : 'PROCESSED AUDIO'}
                    </p>
                    <audio 
                        ref={audioRef} 
                        src={resultUrl || ""} 
                        controls 
                        className="w-full"
                    />
                </div>

                <div className="flex items-center justify-center space-x-4">
                     <button 
                        onClick={toggleCompare}
                        className="px-6 py-3 rounded-lg border border-wes-700 text-gray-300 hover:text-white hover:bg-wes-800 transition flex items-center"
                    >
                         <Rewind className="w-4 h-4 mr-2" />
                        Toggle A/B
                    </button>
                    <button 
                        onClick={handleDownload}
                        className="px-6 py-3 rounded-lg bg-white text-black font-bold hover:bg-gray-200 transition flex items-center shadow-lg hover:shadow-white/20"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download WAV
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};