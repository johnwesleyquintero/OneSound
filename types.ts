export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  lyrics: string[]; // Array of lines
  coverArtUrl?: string; // Base64
  audioUrl?: string; // Blob URL for the generated audio
  duration: number; // in seconds
  createdAt: Date;
  status: 'generating' | 'ready' | 'failed';
  bpm?: number;
  instruments?: string[];
  description?: string;
  type: 'original' | 'remaster';
}

export interface UserState {
  credits: number;
  history: Song[];
  currentTrackId: string | null;
  settings: {
    defaultVoice: string;
  };
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
}

export interface RemasterParams {
  file: File | null;
  style: string; // e.g., "Clarity", "Tape", "Vinyl"
}
