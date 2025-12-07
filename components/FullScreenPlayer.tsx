
import React, { useRef, useEffect, useState } from 'react';
import { Song } from '../types';
import { Play, Pause, SkipBack, SkipForward, Mic2, ChevronDown, Users, Clapperboard, Loader2, MoreHorizontal, Download } from 'lucide-react';
import { Visualizer } from './Visualizer';
import { useToast } from '../context/ToastContext';

interface FullScreenPlayerProps {
  currentTrack: Song;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  analyser: AnalyserNode | null;
  karaokeMode: boolean;
  generatingVideo: boolean;
  onTogglePlay: () => void;
  onToggleKaraoke: () => void;
  onCollapse: () => void;
  onGenerateVideo: () => void;
}

export const FullScreenPlayer: React.FC<FullScreenPlayerProps> = ({
  currentTrack,
  isPlaying,
  progress,
  currentTime,
  duration,
  analyser,
  karaokeMode,
  generatingVideo,
  onTogglePlay,
  onToggleKaraoke,
  onCollapse,
  onGenerateVideo
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showDownloads, setShowDownloads] = useState(false);
  const { addToast } = useToast();

  // Sync Video with Audio Play/Pause state from parent
  useEffect(() => {
    if (videoRef.current) {
        if (isPlaying) videoRef.current.play().catch(() => {});
        else videoRef.current.pause();
    }
  }, [isPlaying]);

  const downloadAsset = (url: string | undefined, filename: string) => {
      if (!url) {
          addToast("Asset not available.", "error");
          return;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setShowDownloads(false);
      addToast(`Downloading ${filename}...`, "success");
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white overflow-hidden animate-in slide-in-from-bottom duration-500">
        {/* Dynamic Background (Video or Image) */}
        <div className="absolute inset-0 z-0">
            {currentTrack.videoUrl ? (
                <video 
                    ref={videoRef}
                    src={currentTrack.videoUrl} 
                    className="w-full h-full object-cover opacity-60" 
                    loop 
                    muted 
                    playsInline
                />
            ) : (
                <img src={currentTrack.coverArtUrl} className="w-full h-full object-cover opacity-30 blur-3xl scale-125" alt="Background" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60"></div>
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between p-6">
            <button onClick={onCollapse} className="p-2 hover:bg-white/10 rounded-full transition">
                <ChevronDown className="w-8 h-8 text-gray-300" />
            </button>
            <div className="flex flex-col items-center">
                <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">Playing from OneSound</span>
                <span className="font-semibold text-sm">{currentTrack.genre} Station</span>
            </div>
            
            {/* Download Menu */}
            <div className="relative">
                <button 
                    onClick={() => setShowDownloads(!showDownloads)}
                    className="p-2 hover:bg-white/10 rounded-full transition"
                >
                    <Download className="w-6 h-6 text-gray-300" />
                </button>
                
                {showDownloads && (
                    <div className="absolute right-0 top-12 w-48 bg-wes-900 border border-wes-700 rounded-xl shadow-2xl p-2 flex flex-col space-y-1 animate-in fade-in slide-in-from-top-2 z-50">
                        <button 
                            onClick={() => downloadAsset(currentTrack.audioUrl, `${currentTrack.title}_FullMix.wav`)}
                            className="text-left px-4 py-2 hover:bg-wes-800 rounded-lg text-sm text-white"
                        >
                            Download Full Mix
                        </button>
                        <button 
                            onClick={() => downloadAsset(currentTrack.backingUrl, `${currentTrack.title}_Instrumental.wav`)}
                            disabled={!currentTrack.backingUrl}
                            className={`text-left px-4 py-2 hover:bg-wes-800 rounded-lg text-sm ${currentTrack.backingUrl ? 'text-gray-300' : 'text-gray-600 cursor-not-allowed'}`}
                        >
                            Instrumental Only
                        </button>
                        {/* Note: Vocals aren't stored as a separate URL in the main Song type yet, so we just have Inst and Full for now unless mixed live. 
                            However, usually users want the instrumental stem most. 
                        */}
                         <button 
                            onClick={() => downloadAsset(currentTrack.videoUrl, `${currentTrack.title}_Video.mp4`)}
                            disabled={!currentTrack.videoUrl}
                            className={`text-left px-4 py-2 hover:bg-wes-800 rounded-lg text-sm ${currentTrack.videoUrl ? 'text-gray-300' : 'text-gray-600 cursor-not-allowed'}`}
                        >
                            Download Video
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Content Grid */}
        <div className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-center p-8 gap-12 max-w-7xl mx-auto w-full">
            
            {/* Left: Art & Controls */}
            <div className="flex-1 flex flex-col items-center max-w-lg w-full">
                <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] mb-8 border border-white/10 relative group">
                        {currentTrack.videoUrl ? (
                            <video 
                            src={currentTrack.videoUrl} 
                            className="w-full h-full object-cover" 
                            muted 
                            loop
                            // We don't autoPlay here to prevent double audio or fighting with the background video logic
                            ref={el => {
                                // Sync this video element with play state if needed, 
                                // though usually the background one is enough for 'vibe'.
                                // For simplicity, let's just show it playing if global is playing.
                                if (el) {
                                    if(isPlaying) el.play().catch(()=>{});
                                    else el.pause();
                                }
                            }}
                            />
                        ) : (
                            <img src={currentTrack.coverArtUrl} className="w-full h-full object-cover" alt="Cover" />
                        )}

                    {/* Overlays */}
                    {currentTrack.isDuet && (
                        <div className="absolute top-4 right-4 bg-wes-purple/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center space-x-1 shadow-lg z-20">
                            <Users className="w-3 h-3 text-white" />
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Duet</span>
                        </div>
                    )}
                    
                    {/* Generate Video Button (Only if no video) */}
                    {!currentTrack.videoUrl && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                                <button 
                                onClick={onGenerateVideo}
                                disabled={generatingVideo}
                                className="bg-white text-black px-6 py-3 rounded-full font-bold flex items-center space-x-2 hover:scale-105 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {generatingVideo ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Clapperboard className="w-5 h-5" />
                                    )}
                                    <span>{generatingVideo ? 'Generating...' : 'Create Music Video'}</span>
                                </button>
                            </div>
                    )}
                </div>
                
                <div className="w-full space-y-2 mb-6 text-center md:text-left">
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
                        onClick={onTogglePlay}
                        className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-lg hover:shadow-white/20"
                    >
                        {isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-2" />}
                    </button>
                    <button className="text-gray-400 hover:text-white transition"><SkipForward size={32} /></button>
                </div>

                {/* Stem Toggles */}
                <div className="mt-8 flex items-center space-x-4 bg-white/5 p-2 rounded-xl border border-white/5">
                    <button 
                        onClick={onToggleKaraoke}
                        disabled={!currentTrack.backingUrl}
                        className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                            karaokeMode 
                            ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' 
                            : 'hover:bg-white/10 text-gray-400'
                        } ${!currentTrack.backingUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Mic2 size={18} />
                        <span className="text-sm font-bold">Karaoke</span>
                    </button>
                </div>
            </div>

            {/* Right: Lyrics & Visualizer */}
            <div className="flex-1 w-full h-full max-h-[60vh] flex flex-col gap-6">
                {/* Visualizer Panel */}
                <div className="h-32 w-full bg-black/20 rounded-xl border border-white/5 backdrop-blur-sm overflow-hidden p-4">
                    <Visualizer analyser={analyser} isPlaying={isPlaying} color={karaokeMode ? '#eab308' : '#a78bfa'} />
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
  );
};
