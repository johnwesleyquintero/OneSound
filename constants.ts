import { Song } from './types';

export const APP_NAME = "OneSound";
export const APP_VERSION = "v1.0.0-beta";

// Supabase Configuration
export const SUPABASE_URL = "https://ttrfuqzxdwuheocgrubt.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_hHrpsK_bGbKIPGU5zV5gMQ_gbGv9Hpr";

// Fallback image if generation fails or for placeholders
export const PLACEHOLDER_COVER = "https://picsum.photos/400/400";

export const GENRES = [
  "Lo-Fi Hip Hop",
  "Cyberpunk Synthwave",
  "Orchestral Cinematic",
  "Indie Pop",
  "Trap / Drill",
  "Ambient Soundscape",
  "Heavy Metal",
  "Jazz Fusion"
];

export const MOODS = [
  "Melancholic",
  "Energetic",
  "Chill",
  "Dark",
  "Euphoric",
  "Focus",
  "Romantic"
];

export const REMASTER_STYLES = [
  "Modern Clarity (AI Clean)",
  "Vintage Tape Saturation",
  "Warm Tube Amp",
  "Bass Boosted & Punchy",
  "Vocal Isolation"
];

export const MOCK_HISTORY: Song[] = [
  {
    id: '1',
    title: 'Neon Horizons',
    artist: 'WesAI',
    genre: 'Synthwave',
    mood: 'Energetic',
    lyrics: ["[Instrumental Intro]", "Driving through the night...", "Neon lights reflecting in your eyes."],
    coverArtUrl: "https://picsum.photos/seed/neon/400/400",
    duration: 184,
    createdAt: new Date(),
    status: 'ready',
    bpm: 120,
    instruments: ["Synthesizer", "Drum Machine"],
    type: 'original'
  }
];