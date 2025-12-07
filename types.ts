export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  lyrics: string[]; // Array of lines
  coverArtUrl?: string; // Base64
  audioUrl?: string; // Blob URL for the generated audio (Full Mix)
  backingUrl?: string; // Blob URL for the instrumental
  duration: number; // in seconds
  createdAt: Date;
  status: 'concept' | 'generating' | 'ready' | 'failed';
  bpm?: number;
  instruments?: string[];
  description?: string;
  type: 'original' | 'remaster';
  isDuet?: boolean;
  secondaryVoiceName?: string;
  musicalElements?: {
    key: string;
    scale: string;
    chordProgression: string[];
  };
}

export interface UserProfile {
  name: string;
  email: string;
  picture: string;
  sub: string; // Google ID
}

export interface UserState {
  credits: number;
  history: Song[];
  currentTrackId: string | null;
  settings: {
    defaultVoice: string;
  };
  profile: UserProfile | null;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  CREATE = 'CREATE',
  REMASTER = 'REMASTER',
  LIBRARY = 'LIBRARY',
  SETTINGS = 'SETTINGS'
}

export interface GenerationParams {
  genre: string;
  mood: string;
  description: string;
  customLyrics?: string;
  hasVocals: boolean;
  voiceName?: string;
  isDuet: boolean;
  secondaryVoiceName?: string;
}

export interface RemasterParams {
  file: File | null;
  style: string; // e.g., "Clarity", "Tape", "Vinyl"
}