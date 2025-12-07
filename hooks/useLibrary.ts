import { useState, useEffect, useCallback } from 'react';
import { Song, UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';

export const useLibrary = (user: UserProfile | null) => {
  const [history, setHistory] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTracks = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching tracks:", error);
    } else if (data) {
      const mappedSongs: Song[] = data.map((t: any) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        genre: t.genre,
        mood: t.mood,
        lyrics: t.lyrics,
        coverArtUrl: t.cover_art_url,
        audioUrl: t.audio_url,
        backingUrl: t.backing_url, // Ensure backing_url is mapped
        duration: t.duration,
        createdAt: new Date(t.created_at),
        status: t.status,
        bpm: t.bpm,
        instruments: t.instruments,
        type: t.type,
        description: t.description,
        isDuet: t.is_duet, // Ensure duet flags are mapped if column exists
        secondaryVoiceName: t.secondary_voice_name
      }));
      setHistory(mappedSongs);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const addTrack = (track: Song) => {
      setHistory(prev => [track, ...prev]);
  };

  const deleteTrack = async (trackId: string): Promise<boolean> => {
    try {
        // 1. Attempt to clean up storage (Audio, Instrumental, Cover)
        // We use "best effort" here - if files don't exist, we continue to delete the row.
        await supabase.storage.from('audio').remove([`${trackId}.wav`, `${trackId}_inst.wav`]);
        await supabase.storage.from('covers').remove([`${trackId}.png`]);

        // 2. Delete the database record
        const { error } = await supabase
            .from('tracks')
            .delete()
            .eq('id', trackId);

        if (error) throw error;

        // 3. Update local state
        setHistory(prev => prev.filter(track => track.id !== trackId));
        return true;
    } catch (error) {
        console.error("Error deleting track:", error);
        return false;
    }
  };

  return { history, loading, refreshLibrary: fetchTracks, addTrack, deleteTrack };
};