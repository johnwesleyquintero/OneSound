import React, { useState, useRef, useEffect } from 'react';
import { Upload, CheckCircle2, Play, Download, RefreshCw, Loader2, Ear, Rewind, RotateCcw, BrainCircuit, Activity, Pause, SlidersHorizontal, Zap } from 'lucide-react';
import { REMASTER_STYLES } from '../constants';
import { useToast } from '../context/ToastContext';
import { processAudio, AudioFilterConfig, getAudioSnippet } from '../utils/audioHelpers';
import { analyzeAudioTrack, AudioAnalysis } from '../services/geminiService';
import { Visualizer } from './Visualizer';

export const RemasterTrack: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  
  // Mastering Console State
  const [eqSettings, setEqSettings] = useState<AudioFilterConfig>({
      lowGain: 0,
      midGain: 0,
      highGain: 0,
      mix: 1.0,
      saturation: false
  });
  
  const [progress, setProgress] = useState(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState<'remastered' | 'original'>('remastered');
  
  // Audio Context & Visualizer State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const { addToast } = useToast();

  // Cleanup URLs on unmount or file change
  useEffect(() => {
    return () => {
        if (originalUrl) URL.revokeObjectURL(originalUrl);
        if (resultUrl) URL.revokeObjectURL(resultUrl);
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
    };
  }, []);

  // Initialize Audio Context for Visualizer when result is ready
  useEffect(() => {
      if (resultUrl && audioRef.current && !audioContextRef.current) {
          try {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              const ctx = new AudioContextClass();
              const analyserNode = ctx.createAnalyser();
              analyserNode.fftSize = 256;
              
              const source = ctx.createMediaElementSource(audioRef.current);
              source.connect(analyserNode);
              analyserNode.connect(ctx.destination);
              
              audioContextRef.current = ctx;
              setAnalyser(analyserNode);
          } catch (e) {
              console.error("Audio Context Init Error:", e);
          }
      }
  }, [resultUrl]);

  const handlePlayPause = () => {
      if (!audioRef.current) return;
      
      // Resume context if suspended (browser policy)
      if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
      }

      if (audioRef.current.paused) {
          audioRef.current.play();
          setIsPlaying(true);
      } else {
          audioRef.current.pause();
          setIsPlaying(false);
      }
  };

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
      setIsPlaying(false);
      setEqSettings({ lowGain: 0, midGain: 0, highGain: 0, mix: 1.0, saturation: false });
      
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
        addToast(`Detected ${result.genre}. Suggested: ${result.suggestedPreset}`, 'success');
        
        // Auto-select the suggested style
        if (result.suggestedPreset) {
            handleApplyPreset(result.suggestedPreset, false);
        }

    } catch (e) {
        console.error("Analysis failed", e);
        addToast("Analysis failed, please select style manually.", 'error');
    } finally {
        setAnalyzing(false);
    }
  };

  const getPresetConfig = (style: string): AudioFilterConfig => {
    switch (style) {
        case "Modern Clarity (AI Clean)": return { lowGain: -2, midGain: 3, highGain: 5, mix: 0.9, saturation: false };
        case "Vintage Tape Saturation": return { lowGain: 4, midGain: -2, highGain: -4, mix: 0.8, saturation: true };
        case "Warm Tube Amp": return { lowGain: 6, midGain: 2, highGain: -2, mix: 0.85, saturation: true };
        case "Bass Boosted & Punchy": return { lowGain: 10, midGain: -2, highGain: 3, mix: 1.0, saturation: false };
        case "Vocal Isolation": return { lowGain: -20, midGain: 12, highGain: -5, mix: 1.0, saturation: false };
        default: return { lowGain: 0, midGain: 0, highGain: 0, mix: 1.0, saturation: false };
    }
  };

  const handleApplyPreset = (style: string, autoRender: boolean = true) => {
      setSelectedStyle(style);
      const config = getPresetConfig(style);
      setEqSettings(config);
      
      if (autoRender && file) {
          triggerRender(config);
      }
  };

  const triggerRender = async (config: AudioFilterConfig) => {
      if (!file) return;
      setProcessing(true);
      setProgress(10);
      
      // Stop playback if playing
      if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          setIsPlaying(false);
      }

      try {
        setTimeout(async () => {
            try {
                const processedBlob = await processAudio(file, config, (p) => setProgress(p));
                const url = URL.createObjectURL(processedBlob);
                
                // If we have an existing URL, revoke it to save memory
                if (resultUrl) URL.revokeObjectURL(resultUrl);

                setResultBlob(processedBlob);
                setResultUrl(url);
                setProcessing(false);
                setCompareMode('remastered');
                
                // Auto-play snippet
                setTimeout(() => {
                    if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play();
                        setIsPlaying(true);
                    }
                }, 100);

            } catch (err) {
                console.error(err);
                setProcessing(false);
                addToast("Error processing audio.", 'error');
            }
        }, 100); // Slight delay for UI update
      } catch (e) {
          setProcessing(false);
      }
  };

  // Debounce the slider changes to avoid rendering on every pixel drag
  const handleManualAdjustment = (key: keyof AudioFilterConfig, value: number | boolean) => {
      setEqSettings(prev => ({ ...prev, [key]: value }));
  };

  const commitManualChanges = () => {
      triggerRender(eqSettings);
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
      const wasPlaying = !audioRef.current.paused;
      
      const newMode = compareMode === 'remastered' ? 'original' : 'remastered';
      setCompareMode(newMode);
      
      // Swap source
      audioRef.current.src = newMode === 'remastered' ? resultUrl : originalUrl;
      audioRef.current.currentTime = currentTime;
      
      if (wasPlaying) {
          audioRef.current.play().catch(e => console.error("Play error during swap", e));
      }
  };

  const handleReset = () => {
      setFile(null);
      setResultUrl(null);
      setOriginalUrl(null);
      setAnalysis(null);
      setIsPlaying(false);
      setEqSettings({ lowGain: 0, midGain: 0, highGain: 0, mix: 1.0, saturation: false });
  };

  const Knob = ({ label, value, min, max, onChange, color = "text-wes-purple" }: any) => (
      <div className="flex flex-col items-center group">
          <div className="h-24 w-8 bg-wes-900 rounded-full relative border border-wes-700 overflow-hidden cursor-pointer hover:border-gray-500 transition-colors">
              <input 
                  type="range" 
                  min={min} 
                  max={max} 
                  step={0.5}
                  value={value}
                  onChange={(e) => onChange(parseFloat(e.target.value))}
                  onMouseUp={commitManualChanges}
                  onTouchEnd={commitManualChanges}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  title={label}
                  {...({ orient: "vertical" } as any)}
              />
              <div 
                  className={`absolute bottom-0 left-0 w-full transition-all duration-200 ${value > 0 ? 'bg-wes-purple' : 'bg-gray-600'}`}
                  style={{ height: `${((value - min) / (max - min)) * 100}%` }}
              ></div>
          </div>
          <span className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-wider">{label}</span>
          <span className={`text-xs font-mono font-bold ${color}`}>{value > 0 ? `+${value}` : value}dB</span>
      </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 h-full flex flex-col min-h-[80vh]">
      <div className="flex items-center justify-between mb-8">
        <div>
            <h2 className="text-3xl font-bold text-white mb-1">Mastering Console</h2>
            <p className="text-gray-400">Neural analysis with manual parametric control.</p>
        </div>
        {file && (
             <button 
                onClick={handleReset} 
                className="px-4 py-2 bg-wes-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 rounded-lg transition-colors flex items-center text-sm font-medium"
            >
                <RefreshCw size={14} className="mr-2" /> Reset Project
            </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        
        {/* LEFT: CONTROLS & ANALYSIS */}
        <div className="lg:col-span-4 space-y-6">
            
            {/* Upload Area */}
            {!file && (
                 <div className="w-full h-64 bg-wes-800/30 border border-dashed border-wes-600 rounded-3xl flex flex-col items-center justify-center p-8 text-center transition-all hover:bg-wes-800/50 hover:border-wes-purple group cursor-pointer relative">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="audio/*" onChange={handleFileChange} />
                    <div className="w-16 h-16 bg-wes-700/50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-gray-400 group-hover:text-wes-purple" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Upload Track</h3>
                    <p className="text-xs text-gray-500 mt-2">WAV, MP3, FLAC (Max 50MB)</p>
                </div>
            )}

            {file && (
                <>
                {/* Analysis Card */}
                <div className="bg-gradient-to-br from-wes-800 to-indigo-950/50 rounded-xl border border-wes-700/50 p-5 relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Activity size={80} />
                     </div>
                     <div className="flex items-center space-x-2 mb-4">
                        <BrainCircuit className={`w-5 h-5 ${analyzing ? 'text-wes-purple animate-pulse' : 'text-wes-purple'}`} />
                        <span className="text-xs font-bold uppercase tracking-wider text-white">Gemini Analysis</span>
                    </div>
                    
                    {analyzing ? (
                        <div className="flex flex-col items-center justify-center py-4">
                            <Loader2 className="w-8 h-8 text-wes-purple animate-spin mb-2" />
                            <p className="text-xs text-gray-400">Analyzing audio fingerprint...</p>
                        </div>
                    ) : analysis ? (
                         <div className="space-y-3 relative z-10">
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="text-gray-400 text-xs">Genre</span>
                                <span className="text-white font-medium text-xs">{analysis.genre}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="text-gray-400 text-xs">BPM</span>
                                <span className="text-white font-medium text-xs">{analysis.bpm}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="text-gray-400 text-xs">Char.</span>
                                <span className="text-white font-medium text-xs truncate max-w-[150px]">{analysis.sonicCharacteristics}</span>
                            </div>
                            <div className="mt-2 bg-black/20 p-2 rounded text-xs text-gray-300 italic">
                                "{analysis.reasoning}"
                            </div>
                         </div>
                    ) : null}
                </div>

                {/* Presets Grid */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">AI Presets</label>
                    <div className="space-y-2">
                        {REMASTER_STYLES.map((style) => {
                            const isRecommended = analysis?.suggestedPreset === style;
                            const isSelected = selectedStyle === style;
                            return (
                                <button 
                                    key={style} 
                                    onClick={() => handleApplyPreset(style)}
                                    className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between group ${
                                        isSelected
                                        ? 'bg-wes-purple/10 border-wes-purple text-white shadow-[0_0_15px_rgba(124,58,237,0.2)]' 
                                        : 'bg-wes-800 border-wes-800 hover:bg-wes-700 text-gray-400'
                                    }`}
                                >
                                    <div className="flex items-center">
                                        <div className={`w-2 h-2 rounded-full mr-3 ${isSelected ? 'bg-wes-purple shadow-[0_0_8px_currentColor]' : 'bg-gray-600'}`}></div>
                                        <span className="text-sm font-medium">{style}</span>
                                    </div>
                                    {isRecommended && (
                                        <Zap className="w-3 h-3 text-yellow-500" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
                </>
            )}
        </div>

        {/* RIGHT: CONSOLE & VISUALIZER */}
        <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Visualizer / Player Screen */}
            <div className="flex-1 bg-black rounded-3xl border border-wes-800 overflow-hidden relative shadow-2xl flex flex-col justify-end min-h-[300px]">
                {file ? (
                    <>
                    <div className="absolute inset-0 z-0">
                         <Visualizer 
                            analyser={analyser} 
                            isPlaying={isPlaying} 
                            color={compareMode === 'original' ? '#6b7280' : '#8b5cf6'} 
                            barCount={128}
                        />
                    </div>
                    
                    {/* Processing Overlay */}
                    {processing && (
                        <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
                            <Loader2 className="w-12 h-12 text-wes-purple animate-spin mb-4" />
                            <p className="text-white font-mono tracking-widest animate-pulse">RENDERING AUDIO ENGINE...</p>
                            <div className="w-64 h-1 bg-wes-900 rounded-full mt-4 overflow-hidden">
                                <div className="h-full bg-wes-purple transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}

                    {/* Controls Overlay */}
                    <div className="relative z-10 bg-gradient-to-t from-black via-black/80 to-transparent p-8">
                         <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-white font-bold text-xl">{file.name}</h3>
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-mono">
                                    {compareMode === 'original' ? 'SOURCE AUDIO' : 'MASTERED OUTPUT'}
                                </p>
                            </div>
                            <div className="flex items-center space-x-3">
                                 <button
                                    onClick={toggleCompare}
                                    disabled={!resultUrl}
                                    className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                                        compareMode === 'original' 
                                        ? 'bg-gray-800 text-gray-300 border-gray-600' 
                                        : 'bg-wes-purple text-white border-wes-500 shadow-lg shadow-purple-900/50'
                                    }`}
                                >
                                    <Ear className="w-3 h-3" />
                                    <span>{compareMode === 'original' ? 'Bypass' : 'Active'}</span>
                                </button>
                            </div>
                         </div>
                         
                         <div className="flex items-center justify-center space-x-8">
                            <button className="text-gray-500 hover:text-white transition"><Rewind size={24} /></button>
                            <button 
                                onClick={handlePlayPause}
                                disabled={!resultUrl}
                                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-lg hover:shadow-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" className="ml-1" />}
                            </button>
                            <button 
                                onClick={handleDownload}
                                disabled={!resultUrl}
                                className="w-10 h-10 rounded-full bg-wes-800 text-white flex items-center justify-center border border-wes-700 hover:bg-wes-700 transition"
                                title="Download"
                            >
                                <Download size={18} />
                            </button>
                         </div>
                    </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                        <Activity size={48} className="opacity-20" />
                    </div>
                )}
                
                {/* Hidden Audio */}
                <audio 
                    ref={audioRef} 
                    src={resultUrl || ""} 
                    onEnded={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="hidden"
                />
            </div>

            {/* EQ Console */}
            <div className="bg-wes-900/50 border border-wes-800 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-wes-purple/50 to-transparent"></div>
                <div className="flex items-center space-x-2 mb-6">
                    <SlidersHorizontal className="w-5 h-5 text-wes-purple" />
                    <h3 className="text-white font-bold uppercase tracking-wider text-sm">Parametric EQ & Dynamics</h3>
                </div>
                
                <div className={`grid grid-cols-4 gap-8 ${!file || processing ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <Knob 
                        label="Low" 
                        min={-12} 
                        max={12} 
                        value={eqSettings.lowGain} 
                        onChange={(v: number) => handleManualAdjustment('lowGain', v)} 
                    />
                    <Knob 
                        label="Mid" 
                        min={-12} 
                        max={12} 
                        value={eqSettings.midGain} 
                        onChange={(v: number) => handleManualAdjustment('midGain', v)} 
                    />
                    <Knob 
                        label="High" 
                        min={-12} 
                        max={12} 
                        value={eqSettings.highGain} 
                        onChange={(v: number) => handleManualAdjustment('highGain', v)} 
                    />
                    
                    {/* Saturation Toggle/Knob */}
                    <div className="flex flex-col items-center justify-end h-full pb-1">
                        <button 
                            onClick={() => {
                                const newVal = !eqSettings.saturation;
                                handleManualAdjustment('saturation', newVal);
                                setTimeout(commitManualChanges, 100);
                            }}
                            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all mb-2 ${
                                eqSettings.saturation 
                                ? 'border-red-500 bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                                : 'border-gray-600 bg-wes-800 text-gray-500 hover:border-gray-400'
                            }`}
                        >
                            <Zap size={20} fill={eqSettings.saturation ? "currentColor" : "none"} />
                        </button>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Drive</span>
                        <span className={`text-xs font-mono font-bold ${eqSettings.saturation ? 'text-red-500' : 'text-gray-600'}`}>
                            {eqSettings.saturation ? 'ON' : 'OFF'}
                        </span>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};