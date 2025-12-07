import React, { useState, useEffect, useRef } from 'react';
import { Song } from '../types';
import { Play, Pause, SkipBack, SkipForward, Volume2, Mic2, Maximize2, ChevronDown, Users, MicOff, Clapperboard, Loader2 } from 'lucide-react';
import { Visualizer } from './Visualizer';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { generateMusicVideo } from '../services/geminiService';
import { useToast } from '../context/ToastContext';
import { uploadAsset } from '../utils/uploadHelper'; // We will assume a helper or just inline basic logic
import { supabase } from '../services/supabaseClient';

interface PlayerProps {
  currentTrack: Song | null;
  onUpdateTrack: (trackId: string, updates: Partial<Song>) => void;
}

export const Player: React.FC<PlayerProps> = ({ currentTrack, onUpdateTrack }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { addToast } = useToast();
  
  // Determine which URL to play based on mode
  const activeUrl = karaokeMode && currentTrack?.backingUrl ? currentTrack.backingUrl : currentTrack?.audioUrl;
  
  // Custom Hook for Audio Engine
  const { isPlaying, progress, currentTime, duration, togglePlay, analyser } = useAudioPlayer(activeUrl, currentTrack?.duration || 0);

  // Sync Video with Audio Play/Pause
  useEffect(() => {
    if (videoRef.current) {
        if (isPlaying) videoRef.current.play();
        else videoRef.current.pause();
    }
  }, [isPlaying]);

  const handleGenerateVideo = async () => {
    if (!currentTrack) return;
    setGeneratingVideo(true);
    addToast("Directing scene with Veo... This may take a moment.", "loading", 10000);

    try {
        const videoUrl = await generateMusicVideo(currentTrack);
        
        // Optimistic update
        onUpdateTrack(currentTrack.id, { videoUrl });
        addToast("Music Video Generated!", "success");

        // Try to upload to cloud for persistence
        try {
            const res = await fetch(videoUrl);
            const blob = await res.blob();
            const { data, error } = await supabase.storage.from('audio').upload(`${currentTrack.id}_video.mp4`, blob, { upsert: true });
            if (!error) {
                const { data: { publicUrl } } = supabase.storage.from('audio').getPublicUrl(`${currentTrack.id}_video.mp4`);
                // Update DB
                await supabase.from('tracks').update({ video_url: publicUrl }).eq('id', currentTrack.id);
                // Update Local State with perm link
                onUpdateTrack(currentTrack.id, { videoUrl: publicUrl });
            }
        } catch (uploadErr) {
            console.warn("Could not persist video to cloud, keeping local session url", uploadErr);
        }

    } catch (error: any) {
        console.error(error);
        if (error.message?.includes("API key")) {
             addToast(error.message, "error", 8000);
        } else {
             addToast("Video generation failed.", "error");
        }
    } finally {
        setGeneratingVideo(false);
    }
  };

  if (!currentTrack) return null;

  return (
    <>
    {/* Full Screen Immersive Player */}
    {isExpanded && (
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
                    <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] mb-8 border border-white/10 relative group">
                         {currentTrack.videoUrl ? (
                             <video 
                                src={currentTrack.videoUrl} 
                                className="w-full h-full object-cover" 
                                muted 
                                loop
                                autoPlay
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
                                    onClick={handleGenerateVideo}
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
                            onClick={togglePlay}
                            className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-lg hover:shadow-white/20"
                        >
                            {isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-2" />}
                        </button>
                        <button className="text-gray-400 hover:text-white transition"><SkipForward size={32} /></button>
                    </div>

                    {/* Stem Toggles */}
                    <div className="mt-8 flex items-center space-x-4 bg-white/5 p-2 rounded-xl border border-white/5">
                        <button 
                            onClick={() => currentTrack.backingUrl ? setKaraokeMode(!karaokeMode) : null}
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
    )}

    {/* Mini Player Bar */}
    <div className={`fixed bottom-0 left-0 w-full bg-wes-900 border-t border-wes-800 z-40 p-3 pl-72 pr-8 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-transform duration-300 ${isExpanded ? 'translate-y-full' : 'translate-y-0'}`}>
      
      {/* Track Info */}
      <div className="flex items-center space-x-4 w-1/4 group cursor-pointer" onClick={() => setIsExpanded(true)}>
        <div className="w-12 h-12 rounded-lg overflow-hidden relative">
           {currentTrack.videoUrl ? (
               <video src={currentTrack.videoUrl} className="w-full h-full object-cover" muted />
           ) : (
               <img 
                 src={currentTrack.coverArtUrl || "https://picsum.photos/200"} 
                 alt={currentTrack.title} 
                 className="w-full h-full object-cover"
               />
           )}
           <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
               <Maximize2 size={16} className="text-white" />
           </div>
        </div>
        <div>
          <h4 className="text-white font-semibold truncate text-sm flex items-center">
             {currentTrack.title}
             {currentTrack.isDuet && <Users size={10} className="ml-2 text-wes-purple" />}
          </h4>
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
         {currentTrack.backingUrl && (
             <button 
                onClick={() => setKaraokeMode(!karaokeMode)} 
                className={`transition ${karaokeMode ? 'text-yellow-500' : 'text-gray-400 hover:text-white'}`}
                title="Toggle Karaoke Mode"
             >
                 {karaokeMode ? <Mic2 size={16} /> : <MicOff size={16} />}
             </button>
         )}
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