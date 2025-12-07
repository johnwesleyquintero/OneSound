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
        duration: t.duration,
        createdAt: new Date(t.created_at),
        status: t.status,
        bpm: t.bpm,
        instruments: t.instruments,
        type: t.type,
        description: t.description
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

  return { history, loading, refreshLibrary: fetchTracks, addTrack };
};