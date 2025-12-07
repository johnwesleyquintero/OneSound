
import React, { useState, useRef, useEffect } from 'react';
import { Upload, CheckCircle2, Play, Download, RefreshCw, Loader2, Ear, Rewind, RotateCcw, BrainCircuit, Activity, Pause, SlidersHorizontal, Zap, Waves, MicOff } from 'lucide-react';
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
      saturation: false,
      spatialMix: 0,
      noiseGate: false
  });
  
  const [progress, setProgress] = useState(0);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  
  // Audio Context & Graph Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bypass, setBypass] = useState(false);

  // Web Audio Graph Nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const lowShelfRef = useRef<BiquadFilterNode | null>(null);
  const midPeakRef = useRef<BiquadFilterNode | null>(null);
  const highShelfRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const { addToast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
        if (originalUrl) URL.revokeObjectURL(originalUrl);
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
    };
  }, []);

  // Initialize Audio Graph
  const initAudioGraph = () => {
    if (!audioRef.current || audioContextRef.current) return;

    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        // Create Nodes
        const source = ctx.createMediaElementSource(audioRef.current);
        sourceNodeRef.current = source;

        // EQ Nodes
        const low = ctx.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.value = 200;
        lowShelfRef.current = low;

        const mid = ctx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = 1800;
        mid.Q.value = 0.8;
        midPeakRef.current = mid;

        const high = ctx.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = 8000;
        highShelfRef.current = high;

        // Dynamics
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -24;
        comp.knee.value = 30;
        comp.ratio.value = 12;
        comp.attack.value = 0.003;
        comp.release.value = 0.25;
        compressorRef.current = comp;

        // Output Gain
        const gain = ctx.createGain();
        gainRef.current = gain;

        // Analyser
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048; // Higher res for remastering view
        analyser.smoothingTimeConstant = 0.85;
        analyserRef.current = analyser;

        // Initial Routing (Wet Chain)
        source.connect(low);
        low.connect(mid);
        mid.connect(high);
        high.connect(comp);
        comp.connect(gain);
        gain.connect(analyser);
        analyser.connect(ctx.destination);

    } catch (e) {
        console.error("Audio Graph Init Error:", e);
    }
  };

  // Live Parameter Updates
  useEffect(() => {
      if (!audioContextRef.current) return;

      const now = audioContextRef.current.currentTime;
      const rampTime = 0.1; // Smooth transitions

      if (lowShelfRef.current) lowShelfRef.current.gain.linearRampToValueAtTime(eqSettings.lowGain || 0, now + rampTime);
      if (midPeakRef.current) midPeakRef.current.gain.linearRampToValueAtTime(eqSettings.midGain || 0, now + rampTime);
      if (highShelfRef.current) highShelfRef.current.gain.linearRampToValueAtTime(eqSettings.highGain || 0, now + rampTime);
      
      // Makeup gain logic
      if (gainRef.current) {
          let makeup = 1.0;
          if ((eqSettings.lowGain || 0) > 4) makeup -= 0.2; // reduce output if bass is huge
          if ((eqSettings.mix || 1) < 1) makeup = 1.0; // Reset if dry/wet (not fully implemented in live graph yet, simplified)
          gainRef.current.gain.linearRampToValueAtTime(makeup, now + rampTime);
      }

      // Saturation/Tube emulation via Compressor tweaking (Live simplification)
      if (compressorRef.current) {
          if (eqSettings.saturation) {
            compressorRef.current.ratio.linearRampToValueAtTime(20, now + rampTime); // Harder compression
            compressorRef.current.threshold.linearRampToValueAtTime(-30, now + rampTime);
          } else {
            compressorRef.current.ratio.linearRampToValueAtTime(12, now + rampTime);
            compressorRef.current.threshold.linearRampToValueAtTime(-24, now + rampTime);
          }
      }

  }, [eqSettings]);

  // Handle Bypass Logic
  useEffect(() => {
      if (!audioContextRef.current || !sourceNodeRef.current || !analyserRef.current) return;

      // Disconnect everything
      sourceNodeRef.current.disconnect();
      if (gainRef.current) gainRef.current.disconnect();

      if (bypass) {
          // Dry Path: Source -> Analyser -> Dest
          sourceNodeRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
      } else {
          // Wet Path: Source -> EQ -> Comp -> Gain -> Analyser -> Dest
          if (lowShelfRef.current) {
              sourceNodeRef.current.connect(lowShelfRef.current);
              // Ensure the rest of the chain is connected (it should stay connected to itself)
              if (gainRef.current) gainRef.current.connect(analyserRef.current);
              analyserRef.current.connect(audioContextRef.current.destination);
          }
      }
  }, [bypass]);


  const handlePlayPause = () => {
      if (!audioRef.current) return;
      
      // Ensure graph is built
      if (!audioContextRef.current) {
          initAudioGraph();
      }
      
      // Resume context if suspended
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
      setProgress(0);
      setAnalysis(null);
      setBypass(false);
      setIsPlaying(false);
      
      // Reset settings
      setEqSettings({ lowGain: 0, midGain: 0, highGain: 0, mix: 1.0, saturation: false, spatialMix: 0, noiseGate: false });
      
      // Auto-Analyze
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
        
        if (result.suggestedPreset) {
            handleApplyPreset(result.suggestedPreset);
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
        case "Modern Clarity (AI Clean)": return { lowGain: -2, midGain: 3, highGain: 5, mix: 0.9, saturation: false, spatialMix: 0.1, noiseGate: true };
        case "Vintage Tape Saturation": return { lowGain: 4, midGain: -2, highGain: -4, mix: 0.8, saturation: true, spatialMix: 0, noiseGate: false };
        case "Warm Tube Amp": return { lowGain: 6, midGain: 2, highGain: -2, mix: 0.85, saturation: true, spatialMix: 0.2, noiseGate: false };
        case "Bass Boosted & Punchy": return { lowGain: 10, midGain: -2, highGain: 3, mix: 1.0, saturation: false, spatialMix: 0, noiseGate: true };
        case "Vocal Isolation": return { lowGain: -20, midGain: 12, highGain: -5, mix: 1.0, saturation: false, spatialMix: 0, noiseGate: true };
        default: return { lowGain: 0, midGain: 0, highGain: 0, mix: 1.0, saturation: false };
    }
  };

  const handleApplyPreset = (style: string) => {
      setSelectedStyle(style);
      const config = getPresetConfig(style);
      setEqSettings(config);
      setBypass(false); // Enable wet mode to hear preset
  };

  const handleManualAdjustment = (key: keyof AudioFilterConfig, value: number | boolean) => {
      setEqSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleDownloadRender = async () => {
      if (!file) return;
      setProcessing(true);
      setProgress(0);
      addToast("Rendering final master...", 'loading');

      try {
          // Pause playback during render to save resources
          if (audioRef.current && !audioRef.current.paused) {
             handlePlayPause();
          }

          const processedBlob = await processAudio(file, eqSettings, (p) => setProgress(p));
          const url = URL.createObjectURL(processedBlob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `mastered_${file.name.replace(/\.[^/.]+$/, "")}.wav`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          setTimeout(() => URL.revokeObjectURL(url), 10000); // Cleanup later
          addToast("Download started!", 'success');

      } catch (err) {
          console.error(err);
          addToast("Error rendering audio.", 'error');
      } finally {
          setProcessing(false);
          setProgress(0);
      }
  };

  const handleReset = () => {
      setFile(null);
      setOriginalUrl(null);
      setAnalysis(null);
      setIsPlaying(false);
      setEqSettings({ lowGain: 0, midGain: 0, highGain: 0, mix: 1.0, saturation: false, spatialMix: 0, noiseGate: false });
  };

  const Knob = ({ label, value, min, max, onChange, color = "text-wes-purple" }: any) => (
      <div className="flex flex-col items-center group">
          <div className="h-24 w-8 bg-wes-900 rounded-full relative border border-wes-700 overflow-hidden cursor-pointer hover:border-gray-500 transition-colors">
              <input 
                  type="range" 
                  min={min} 
                  max={max} 
                  step={0.1}
                  value={value}
                  onChange={(e) => onChange(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  title={label}
                  {...({ orient: "vertical" } as any)}
              />
              <div 
                  className={`absolute bottom-0 left-0 w-full transition-all duration-100 ease-linear ${value > 0 ? 'bg-wes-purple' : 'bg-gray-600'}`}
                  style={{ height: `${((value - min) / (max - min)) * 100}%` }}
              ></div>
          </div>
          <span className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-wider">{label}</span>
          <span className={`text-xs font-mono font-bold ${color}`}>
            {value.toFixed(1)}{label === 'Spatial' ? '' : 'dB'}
          </span>
      </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 h-full flex flex-col min-h-[80vh]">
      <div className="flex items-center justify-between mb-8">
        <div>
            <h2 className="text-3xl font-bold text-white mb-1">Mastering Console</h2>
            <p className="text-gray-400">Real-time neural analysis and DSP monitoring.</p>
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
                <div className="bg-gradient-to-br from-wes-800 to-indigo-950/50 rounded-xl border border-wes-700/50 p-5 relative overflow-hidden animate-in fade-in slide-in-from-left-4">
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
                            analyser={analyserRef.current} 
                            isPlaying={isPlaying} 
                            color={bypass ? '#6b7280' : '#8b5cf6'} 
                            barCount={128}
                        />
                    </div>
                    
                    {/* Processing Overlay */}
                    {processing && (
                        <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
                            <Loader2 className="w-12 h-12 text-wes-purple animate-spin mb-4" />
                            <p className="text-white font-mono tracking-widest animate-pulse">RENDERING MASTER FILE...</p>
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
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-mono flex items-center space-x-2">
                                    <span className={`w-2 h-2 rounded-full ${bypass ? 'bg-gray-500' : 'bg-green-500 animate-pulse'}`}></span>
                                    <span>{bypass ? 'BYPASS MODE (ORIGINAL)' : 'LIVE PROCESSING ACTIVE'}</span>
                                </p>
                            </div>
                            <div className="flex items-center space-x-3">
                                 <button
                                    onClick={() => setBypass(!bypass)}
                                    className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                                        bypass 
                                        ? 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700' 
                                        : 'bg-wes-purple text-white border-wes-500 shadow-lg shadow-purple-900/50 hover:bg-wes-600'
                                    }`}
                                >
                                    <Ear className="w-3 h-3" />
                                    <span>{bypass ? 'Enable FX' : 'Bypass FX'}</span>
                                </button>
                            </div>
                         </div>
                         
                         <div className="flex items-center justify-center space-x-8">
                            <button 
                                onClick={() => { if(audioRef.current) audioRef.current.currentTime = 0; }}
                                className="text-gray-500 hover:text-white transition"
                            >
                                <Rewind size={24} />
                            </button>
                            <button 
                                onClick={handlePlayPause}
                                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-lg hover:shadow-white/20"
                            >
                                {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" className="ml-1" />}
                            </button>
                            <button 
                                onClick={handleDownloadRender}
                                className="w-10 h-10 rounded-full bg-wes-800 text-white flex items-center justify-center border border-wes-700 hover:bg-wes-700 transition"
                                title="Render & Download"
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
                
                {/* Source Audio Element */}
                <audio 
                    ref={audioRef} 
                    src={originalUrl || ""} 
                    onEnded={() => setIsPlaying(false)}
                    crossOrigin="anonymous"
                    className="hidden"
                />
            </div>

            {/* EQ & Dynamics Console */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* EQ Section */}
                <div className="bg-wes-900/50 border border-wes-800 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-2">
                            <SlidersHorizontal className="w-5 h-5 text-blue-500" />
                            <h3 className="text-white font-bold uppercase tracking-wider text-sm">Parametric EQ</h3>
                        </div>
                        {bypass && <span className="text-[10px] text-red-500 font-bold border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded">BYPASSED</span>}
                    </div>
                    
                    <div className={`grid grid-cols-3 gap-4 ${!file || bypass ? 'opacity-50 pointer-events-none grayscale' : ''} transition-all duration-300`}>
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
                    </div>
                </div>

                {/* Spatial & Dynamics Section */}
                <div className="bg-wes-900/50 border border-wes-800 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-wes-purple/50 to-transparent"></div>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-2">
                            <Waves className="w-5 h-5 text-wes-purple" />
                            <h3 className="text-white font-bold uppercase tracking-wider text-sm">Spatial & Dynamics</h3>
                        </div>
                        {bypass && <span className="text-[10px] text-red-500 font-bold border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded">BYPASSED</span>}
                    </div>
                    
                    <div className={`grid grid-cols-3 gap-4 ${!file || bypass ? 'opacity-50 pointer-events-none grayscale' : ''} transition-all duration-300`}>
                        
                        {/* Spatial Width Knob */}
                        <Knob 
                            label="Spatial" 
                            min={0} 
                            max={1} 
                            value={eqSettings.spatialMix || 0} 
                            onChange={(v: number) => handleManualAdjustment('spatialMix', v)} 
                            color="text-indigo-400"
                        />

                        {/* Saturation Toggle */}
                        <div className="flex flex-col items-center justify-end h-full pb-1">
                            <button 
                                onClick={() => handleManualAdjustment('saturation', !eqSettings.saturation)}
                                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all mb-2 ${
                                    eqSettings.saturation 
                                    ? 'border-red-500 bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                                    : 'border-gray-600 bg-wes-800 text-gray-500 hover:border-gray-400'
                                }`}
                            >
                                <Zap size={20} fill={eqSettings.saturation ? "currentColor" : "none"} />
                            </button>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tube</span>
                        </div>

                         {/* Noise Gate Toggle */}
                         <div className="flex flex-col items-center justify-end h-full pb-1">
                            <button 
                                onClick={() => handleManualAdjustment('noiseGate', !eqSettings.noiseGate)}
                                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all mb-2 ${
                                    eqSettings.noiseGate 
                                    ? 'border-green-500 bg-green-500/20 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
                                    : 'border-gray-600 bg-wes-800 text-gray-500 hover:border-gray-400'
                                }`}
                            >
                                <MicOff size={20} />
                            </button>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Gate</span>
                        </div>

                    </div>
                </div>

            </div>

        </div>
      </div>
    </div>
  );
};
