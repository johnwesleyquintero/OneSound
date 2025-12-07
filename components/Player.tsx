
import React, { useState } from 'react';
import { Song } from '../types';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { generateMusicVideo } from '../services/geminiService';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabaseClient';

// Sub-components
import { MiniPlayer } from './MiniPlayer';
import { FullScreenPlayer } from './FullScreenPlayer';

interface PlayerProps {
  currentTrack: Song | null;
  onUpdateTrack: (trackId: string, updates: Partial<Song>) => void;
}

export const Player: React.FC<PlayerProps> = ({ currentTrack, onUpdateTrack }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  
  const { addToast } = useToast();
  
  // Determine which URL to play based on mode
  const activeUrl = karaokeMode && currentTrack?.backingUrl ? currentTrack.backingUrl : currentTrack?.audioUrl;
  
  // Custom Hook for Audio Engine
  const { isPlaying, progress, currentTime, duration, togglePlay, analyser } = useAudioPlayer(activeUrl, currentTrack?.duration || 0);

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

  const handleToggleKaraoke = () => {
      if (currentTrack?.backingUrl) {
          setKaraokeMode(!karaokeMode);
      }
  };

  if (!currentTrack) return null;

  return (
    <>
      {isExpanded && (
        <FullScreenPlayer 
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            progress={progress}
            currentTime={currentTime}
            duration={duration}
            analyser={analyser}
            karaokeMode={karaokeMode}
            generatingVideo={generatingVideo}
            onTogglePlay={togglePlay}
            onToggleKaraoke={handleToggleKaraoke}
            onCollapse={() => setIsExpanded(false)}
            onGenerateVideo={handleGenerateVideo}
        />
      )}

      <MiniPlayer 
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        progress={progress}
        currentTime={currentTime}
        duration={duration}
        karaokeMode={karaokeMode}
        onTogglePlay={togglePlay}
        onToggleKaraoke={handleToggleKaraoke}
        onExpand={() => setIsExpanded(true)}
        isExpanded={isExpanded}
      />
    </>
  );
};
