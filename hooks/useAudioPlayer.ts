import { useState, useEffect, useRef, useCallback } from 'react';
import { decodePCM } from '../utils/audioHelpers';

export const useAudioPlayer = (audioUrl: string | undefined, durationInSeconds: number) => {
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
       // We typically don't close context on unmount to prevent harsh cuts if re-mounting, 
       // but for this app architecture it's safer to close or at least suspend.
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

  // Load Track when URL changes
  useEffect(() => {
    const loadAudio = async () => {
        stopAudio();
        setProgress(0);
        setCurrentTime(0);
        setDuration(durationInSeconds || 0);
        
        if (audioUrl && audioContextRef.current) {
            try {
                let buffer: AudioBuffer;

                // Support both remote URLs (http/https) and local Blob URLs (blob:)
                if (audioUrl.startsWith('http') || audioUrl.startsWith('blob')) {
                    const response = await fetch(audioUrl);
                    const arrayBuffer = await response.arrayBuffer();
                    buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
                } else {
                    // Handle raw PCM base64 (fallback for older tracks or direct PCM data)
                    const float32Data = decodePCM(audioUrl);
                    buffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
                    // Explicitly cast to 'any' to bypass strict ArrayBuffer vs ArrayBufferLike mismatch in Vercel build
                    buffer.copyToChannel(float32Data as any, 0);
                }
                
                audioBufferRef.current = buffer;
                setDuration(buffer.duration);
                
                // If it was playing, maybe we want to auto-play (optional, disabled for now)
            } catch (e) {
                console.error("Audio decoding error", e);
            }
        } else {
            // Mock simulation for tracks without audio (or failed generation)
            // If explicit URL is missing, we don't play.
        }
    };

    if (audioUrl) {
        loadAudio();
    } else {
        stopAudio();
    }

  }, [audioUrl, durationInSeconds, stopAudio]);

  // Playback Loop
  useEffect(() => {
    const updateUI = () => {
        if (!audioContextRef.current) return;
        
        if (audioUrl && isPlaying) {
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
        }
    };

    if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateUI);
    }

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isPlaying, duration, audioUrl, stopAudio]);

  const playAudio = (offset: number) => {
    if (!audioContextRef.current || !audioBufferRef.current || !analyserRef.current) {
        // Fallback for simulation if no buffer but logic requires play
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