import { useState, useEffect, useRef, useCallback } from 'react';
import { Song } from '../types';
import { decodePCM } from '../utils/audioHelpers';

export const useAudioPlayer = (currentTrack: Song | null) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Audio Engine Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

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

    return () => {
       cancelAnimationFrame(animationFrameRef.current);
       if (sourceNodeRef.current) {
           try { sourceNodeRef.current.stop(); } catch(e){}
       }
       if (audioContextRef.current?.state !== 'closed') {
           audioContextRef.current?.close();
       }
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e){}
    }
    pauseTimeRef.current = 0;
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    cancelAnimationFrame(animationFrameRef.current);
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
                    // Handle raw PCM base64
                    const float32Data = decodePCM(currentTrack.audioUrl);
                    buffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
                    buffer.copyToChannel(float32Data, 0);
                }
                
                audioBufferRef.current = buffer;
                setDuration(buffer.duration);
                
                // Auto play
                playAudio(0);
            } catch (e) {
                console.error("Audio decoding error", e);
            }
        } else {
            // Mock simulation for tracks without audio (or failed generation)
            setIsPlaying(true);
        }
    };

    if (currentTrack) {
        loadAudio();
    }

    return () => stopAudio();
  }, [currentTrack, stopAudio]);

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
  }, [isPlaying, duration, currentTrack, stopAudio]);

  const playAudio = (offset: number) => {
    if (!audioContextRef.current || !audioBufferRef.current || !analyserRef.current) {
        setIsPlaying(true);
        return;
    }
    
    // Ensure context is running (browsers suspend it sometimes)
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
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

  return {
      isPlaying,
      progress,
      currentTime,
      duration,
      togglePlay,
      analyser: analyserRef.current
  };
};