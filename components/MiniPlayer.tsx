
import React from 'react';
import { Song } from '../types';
import { Play, Pause, SkipBack, SkipForward, Volume2, Maximize2, Mic2, MicOff, Users } from 'lucide-react';

interface MiniPlayerProps {
  currentTrack: Song;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  karaokeMode: boolean;
  onTogglePlay: () => void;
  onToggleKaraoke: () => void;
  onExpand: () => void;
  isExpanded: boolean;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  progress,
  currentTime,
  duration,
  karaokeMode,
  onTogglePlay,
  onToggleKaraoke,
  onExpand,
  isExpanded
}) => {
  return (
    <div className={`fixed bottom-0 left-0 w-full bg-wes-900 border-t border-wes-800 z-40 p-3 pl-72 pr-8 flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-transform duration-300 ${isExpanded ? 'translate-y-full' : 'translate-y-0'}`}>
      
      {/* Track Info */}
      <div className="flex items-center space-x-4 w-1/4 group cursor-pointer" onClick={onExpand}>
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
            onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
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
                onClick={(e) => { e.stopPropagation(); onToggleKaraoke(); }}
                className={`transition ${karaokeMode ? 'text-yellow-500' : 'text-gray-400 hover:text-white'}`}
                title="Toggle Karaoke Mode"
             >
                 {karaokeMode ? <Mic2 size={16} /> : <MicOff size={16} />}
             </button>
         )}
         <button className="text-gray-400 hover:text-white"><Volume2 size={16} /></button>
         <button onClick={onExpand} className="text-gray-400 hover:text-wes-purple transition" title="Expand">
             <Maximize2 size={16} />
         </button>
      </div>
    </div>
  );
};
