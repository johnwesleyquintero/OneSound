import React, { useState, useEffect, useRef } from 'react';
import { Song } from '../types';
import { Play, Pause, SkipBack, SkipForward, Volume2, Mic2, Maximize2, Minimize2, ChevronDown } from 'lucide-react';
import { Visualizer } from './Visualizer';

interface PlayerProps {
  currentTrack: Song | null;
}

export const Player: React.FC<PlayerProps> = ({ currentTrack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Audio Engine Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  // Initialize Audio Context & Analyser
  useEffect(() => {
    if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass({ sampleRate: 24000 });
        audioContextRef.current = ctx;

        // Create Analyser
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
    }
  }, []);

  // Load Track
  useEffect(() => {
    const loadAudio = async () => {
        stopAudio();
        setProgress(0);
        setCurrentTime(0);
        setDuration(currentTrack?.duration || 0);
        
        if (currentTrack?.audioUrl && audioContextRef.current) {
            try {
                let buffer: AudioBuffer;

                if (currentTrack.audioUrl.startsWith('http')) {
                    // Fetch from Supabase / URL
                    const response = await fetch(currentTrack.audioUrl);
                    const arrayBuffer = await response.arrayBuffer();
                    buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
                } else {
                    // Fallback for legacy Base64 (if any exists in local state)
                    const binaryString = atob(currentTrack.audioUrl);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const dataInt16 = new Int16Array(bytes.buffer);
                    const channelCount = 1;
                    const sampleRate = 24000; 
                    const frameCount = dataInt16.length;
                    buffer = audioContextRef.current.createBuffer(channelCount, frameCount, sampleRate);
                    const channelData = buffer.getChannelData(0);
                    for (let i = 0; i < frameCount; i++) {
                        channelData[i] = dataInt16[i] / 32768.0;
                    }
                }
                
                audioBufferRef.current = buffer;
                setDuration(buffer.duration);
                
                // Auto play
                playAudio(0);
            } catch (e) {
                console.error("Audio decoding error", e);
            }
        } else {
            // Mock simulation for tracks without audio
            setIsPlaying(true);
        }
    };

    if (currentTrack) {
        loadAudio();
    }

    return () => stopAudio();
  }, [currentTrack]);

  // Playback Loop
  useEffect(() => {
    const updateUI = () => {
        if (!audioContextRef.current) return;
        
        if (currentTrack?.audioUrl && isPlaying) {
            const now = audioContextRef.current.currentTime;
            const elapsed = now - startTimeRef.current + pauseTimeRef.current;
            
            if (elapsed >= duration) {
                setIsPlaying(false);
                setCurrentTime(duration);
                setProgress(100);
                stopAudio(); 
            } else {
                setCurrentTime(elapsed);
                setProgress((elapsed / duration) * 100);
                animationFrameRef.current = requestAnimationFrame(updateUI);
            }
        } else if (!currentTrack?.audioUrl && isPlaying) {
            // Simulation
            setCurrentTime(prev => {
                const next = prev + 0.05; 
                if (next >= (currentTrack?.duration || 180)) {
                   setIsPlaying(false);
                   return 0;
                }
                setProgress((next / (currentTrack?.duration || 180)) * 100);
                return next;
            });
             animationFrameRef.current = requestAnimationFrame(updateUI);
        }
    };

    if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateUI);
    }

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isPlaying, duration, currentTrack]);

  const playAudio = (offset: number) => {
    if (!audioContextRef.current || !audioBufferRef.current || !analyserRef.current) {
        setIsPlaying(true);
        return;
    }
    
    if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e){}
        sourceNodeRef.current.disconnect();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;
    
    // Connect Source -> Analyser -> Destination
    source.connect(analyserRef.current);
    analyserRef.current.connect(audioContextRef.current.destination);
    
    source.start(0, offset);
    
    sourceNodeRef.current = source;
    startTimeRef.current = audioContextRef.current.currentTime;
    setIsPlaying(true);
  };

  const pauseAudio = () => {
    if (sourceNodeRef.current && audioContextRef.current) {
        sourceNodeRef.current.stop();
        pauseTimeRef.current += audioContextRef.current.currentTime - startTimeRef.current;
        setIsPlaying(false);
    } else {
        setIsPlaying(false); 
    }
  };

  const togglePlay = () => {
     if (isPlaying) {
         pauseAudio();
     } else {
         playAudio(pauseTimeRef.current);
     }
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e){}
    }
    pauseTimeRef.current = 0;
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    cancelAnimationFrame(animationFrameRef.current);
  };

  if (!currentTrack) return null;

  return (
    <>
    {/* Full Screen Immersive Player */}
    {isExpanded && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white overflow-hidden animate-in slide-in-from-bottom duration-500">
            {/* Dynamic Background */}
            <div className="absolute inset-0 z-0">
                <img src={currentTrack.coverArtUrl} className="w-full h-full object-cover opacity-30 blur-3xl scale-125" alt="Background" />
                <div className="absolute inset-0 bg-black/40"></div>
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-6">
                <button onClick={() => setIsExpanded(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                    <ChevronDown className="w-8 h-8 text-gray-300" />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">Playing from OneSound</span>
                    <span className="font-semibold text-sm">{currentTrack.genre} Station</span>
                </div>
                <button className="p-2 hover:bg-white/10 rounded-full transition">
                    <MoreHorizontalIcon />
                </button>
            </div>

            {/* Content Grid */}
            <div className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-center p-8 gap-12 max-w-7xl mx-auto w-full">
                
                {/* Left: Art & Controls */}
                <div className="flex-1 flex flex-col items-center max-w-lg w-full">
                    <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] mb-8 border border-white/10">
                        <img src={currentTrack.coverArtUrl} className="w-full h-full object-cover" alt="Cover" />
                    </div>
                    
                    <div className="w-full space-y-2 mb-6">
                        <h2 className="text-3xl font-bold truncate">{currentTrack.title}</h2>
                        <p className="text-xl text-gray-400">{currentTrack.artist}</p>
                    </div>

                    {/* Scrubber */}
                    <div className="w-full group cursor-pointer mb-6">
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-wes-purple shadow-[0_0_15px_rgba(139,92,246,0.8)]" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-2 font-mono">
                             <span>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
                             <span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
                        </div>
                    </div>

                    {/* Main Controls */}
                    <div className="flex items-center justify-between w-full max-w-xs">
                        <button className="text-gray-400 hover:text-white transition"><SkipBack size={32} /></button>
                        <button 
                            onClick={togglePlay}
                            className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-lg hover:shadow-white/20"
                        >
                            {isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-2" />}
                        </button>
                        <button className="text-gray-400 hover:text-white transition"><SkipForward size={32} /></button>
                    </div>
                </div>

                {/* Right: Lyrics & Visualizer */}
                <div className="flex-1 w-full h-full max-h-[60vh] flex flex-col gap-6">
                    {/* Visualizer Panel */}
                    <div className="h-32 w-full bg-black/20 rounded-xl border border-white/5 backdrop-blur-sm overflow-hidden p-4">
                        <Visualizer analyser={analyserRef.current} isPlaying={isPlaying} color="#a78bfa" />
                    </div>

                    {/* Lyrics Panel */}
                    <div className="flex-1 bg-black/20 rounded-2xl border border-white/5 backdrop-blur-sm p-8 overflow-y-auto custom-scrollbar relative">
                         {currentTrack.lyrics.length > 0 ? (
                             <div className="space-y-6">
                                {currentTrack.lyrics.map((line, idx) => {
                                   const totalLines = currentTrack.lyrics.length;
                                   const activeLineIndex = Math.floor((progress / 100) * totalLines);
                                   const isActive = idx === activeLineIndex;

                                   return (
                                     <p key={idx} className={`text-2xl font-bold transition-all duration-500 cursor-pointer hover:text-white ${isActive ? 'text-white scale-105 ml-4' : 'text-white/30'}`}>
                                       {line}
                                     </p>
                                   )
                                })}
                             </div>
                         ) : (
                             <div className="flex items-center justify-center h-full text-gray-500">
                                 <p>Instrumental • No Lyrics Available</p>
                             </div>
                         )}
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* Mini Player Bar */}
    <div className={`fixed bottom-0 left-0 w-full bg-wes-900 border-t border-wes-800 z-40 p-3 pl-72 pr-8 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-transform duration-300 ${isExpanded ? 'translate-y-full' : 'translate-y-0'}`}>
      
      {/* Track Info */}
      <div className="flex items-center space-x-4 w-1/4 group cursor-pointer" onClick={() => setIsExpanded(true)}>
        <div className="w-12 h-12 rounded-lg overflow-hidden relative">
           <img 
             src={currentTrack.coverArtUrl || "https://picsum.photos/200"} 
             alt={currentTrack.title} 
             className="w-full h-full object-cover"
           />
           <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
               <Maximize2 size={16} className="text-white" />
           </div>
        </div>
        <div>
          <h4 className="text-white font-semibold truncate text-sm">{currentTrack.title}</h4>
          <p className="text-xs text-gray-400">{currentTrack.artist}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center flex-1 px-8">
        <div className="flex items-center space-x-6">
          <button className="text-gray-400 hover:text-white transition"><SkipBack size={18} /></button>
          <button 
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition active:scale-95"
          >
            {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ml-0.5" />}
          </button>
          <button className="text-gray-400 hover:text-white transition"><SkipForward size={18} /></button>
        </div>
        
        <div className="w-full flex items-center space-x-3 mt-1">
          <span className="text-[10px] text-gray-500 font-mono">
            {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
          </span>
          <div className="flex-1 h-1 bg-wes-700 rounded-full overflow-hidden relative">
             <div className="h-full bg-wes-purple" style={{ width: `${progress}%` }}></div>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">
             {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Extra Controls */}
      <div className="flex items-center space-x-4 w-1/4 justify-end">
         <button className="text-gray-400 hover:text-white"><Mic2 size={16} /></button>
         <button className="text-gray-400 hover:text-white"><Volume2 size={16} /></button>
         <button onClick={() => setIsExpanded(true)} className="text-gray-400 hover:text-wes-purple transition" title="Expand">
             <Maximize2 size={16} />
         </button>
      </div>
    </div>
    </>
  );
};

const MoreHorizontalIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
);
